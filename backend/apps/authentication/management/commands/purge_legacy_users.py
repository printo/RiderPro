"""
purge_legacy_users — clean the RiderPro auth DB down to "POPS-sourced riders +
Google-SSO staff admins", removing the legacy/duplicate rows left behind by the
now-retired PIA/password login.

WHY THIS IS DELICATE
--------------------
Route / mileage / reimbursement history (RouteSession, RouteTracking, and a
handful of other tables) links to a person by the STRING ``employee_id`` (=
``User.username`` = ``RiderAccount.rider_id``), NOT by a foreign key. Deleting a
User or RiderAccount does NOT cascade that history — it ORPHANS it. So before we
remove anything we must REASSIGN its string-keyed history to the surviving
("canonical") record, re-verify the stale record has ZERO remaining links, and
only then hard-delete.

WHAT IT REMOVES (and what it KEEPS)
-----------------------------------
Removal candidates  : Users with ``auth_source='pops'`` whose username is an
                      emp-id (no ``@``), that have NO backing RiderAccount and
                      are NOT a live POPS rider_id — i.e. the old PIA-login
                      shadows. A candidate is only ACTED ON when a *canonical*
                      identity for the same person is resolved (a Google-SSO
                      email User, or a live POPS RiderAccount). Candidates with
                      no canonical are reported for manual review, never deleted.
Always kept         : Google-SSO admins (email username), and any
                      rider/RiderAccount mapping to a live POPS rider.

SAFETY MODEL
------------
* Dry-run is the DEFAULT. ``--apply`` performs changes inside a single
  ``transaction.atomic()`` block.
* Any destructive action REQUIRES a healthy POPS rider pull (succeeded AND at
  least ``--min-pops-riders`` entries). If POPS can't be pulled (or looks
  truncated) the command drops to report-only — we never treat "not in POPS" as
  grounds for deletion off an incomplete pull.
* Canonical identity is resolved from explicit ``--map STALE=CANONICAL``
  entries first; ``--auto-match`` additionally allows acting on an *unambiguous*
  full-name match. Suggestions are always printed so the owner can build a map.
* Each removal is reassign -> re-verify zero links -> delete. If anything is
  still linked, the record is left for manual review (never force-deleted).
* RiderAccount de-dup (e.g. the misspelled ``Sheshagiri_300099`` ->
  ``Seshagiri_300099``) reassigns history and SOFT-ARCHIVES the dup by default;
  hard-delete is opt-in (``--delete-riders``) and still gated on zero links.

USAGE (run on the server, against prod)
---------------------------------------
    docker compose -f docker-compose.prod.yml exec django \
        python manage.py purge_legacy_users --dry-run

    # after reviewing, supply the canonical mapping(s) and apply:
    docker compose -f docker-compose.prod.yml exec django \
        python manage.py purge_legacy_users --apply \
        --map 12180=kanna.p@printo.in \
        --map Sheshagiri_300099=Seshagiri_300099
"""
from __future__ import annotations

from django.apps import apps
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

User = get_user_model()


# ---------------------------------------------------------------------------
# String references to a person, keyed by username / rider_id (NOT foreign
# keys). These are what orphan on delete, so these are what we reassign. The
# route tables are reimbursement-critical and come first.
# ---------------------------------------------------------------------------
STRING_EMP_REFS = [
    ("shipments.RouteSession", "employee_id"),          # reimbursement-critical
    ("shipments.RouteTracking", "employee_id"),         # reimbursement-critical
    ("shipments.Shipment", "employee_id"),
    ("shipments.Shipment", "acknowledgment_captured_by"),
    ("shipments.Acknowledgment", "acknowledgment_captured_by"),
    ("shipments.OrderEvent", "triggered_by"),
    ("shipments.OverlapIgnore", "created_by"),
    ("authentication.VehicleChangeRequest", "reviewed_by"),
]

# Route-history tables only — used by --delete-history-for (stray test runs).
ROUTE_HISTORY = [
    ("shipments.RouteTracking", "employee_id"),
    ("shipments.RouteSession", "employee_id"),
]

# Policy for reverse FK relations that point AT a User row. Anything not listed
# here is treated as BLOCKING (we refuse to delete and flag for manual review).
USER_FK_POLICY = {
    "token_blacklist.OutstandingToken": "delete",   # JWT bookkeeping
    "authentication.UserSession": "delete",         # session rows
    "authentication.BlackListedToken": "delete",    # logout/revocation rows
    "admin.LogEntry": "repoint_or_delete",          # admin audit log
    "shipments.AcknowledgmentSettings": "repoint_or_null",
}


def _model(label):
    try:
        return apps.get_model(*label.split("."))
    except LookupError:
        return None


def _has_field(model, field_name):
    return any(
        getattr(f, "name", None) == field_name for f in model._meta.get_fields()
    )


class PopsState:
    """Result of pulling the current rider roster from POPS."""

    def __init__(self):
        self.ok = False
        self.error = None
        self.count = 0
        self.rider_ids = set()        # set[str]  current POPS rider_id values
        self.pks = set()              # set[int]  current POPS rider primary keys
        self.pk_to_rider_id = {}      # int -> str  POPS pk -> rider_id
        self.dup_rider_ids = {}       # rider_id -> [pk, pk, ...] (POPS-side dups)

    @property
    def healthy_for(self):
        return self.ok and self.count

    def absorb(self, riders):
        self.ok = True
        self.count = len(riders)
        seen = {}
        for r in riders:
            rid = r.get("rider_id") or (str(r.get("id")) if r.get("id") else None)
            pk = r.get("id")
            if rid:
                self.rider_ids.add(str(rid))
                seen.setdefault(str(rid), []).append(pk)
            if pk is not None:
                self.pks.add(pk)
                if rid:
                    self.pk_to_rider_id[pk] = str(rid)
        self.dup_rider_ids = {k: v for k, v in seen.items() if len(v) > 1}


class Command(BaseCommand):
    help = (
        "Purge legacy PIA-login duplicate Users (dry-run by default) and de-dup "
        "misspelled RiderAccounts, reassigning route/reimbursement history first."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply", action="store_true",
            help="Actually perform changes (inside a transaction). Default is dry-run.",
        )
        parser.add_argument(
            "--dry-run", action="store_true",
            help="Explicitly request dry-run (the default even without this flag).",
        )
        parser.add_argument(
            "--map", action="append", default=[], metavar="STALE=CANONICAL",
            dest="maps",
            help="Map a stale username / rider_id to its canonical record. Repeatable.",
        )
        parser.add_argument(
            "--auto-match", action="store_true",
            help="Also act on candidates whose full_name UNAMBIGUOUSLY matches one "
                 "canonical record (best-effort; review the dry-run first).",
        )
        parser.add_argument(
            "--delete-history-for", action="append", default=[], metavar="ID",
            dest="delete_history_for",
            help="For these stale ids, DELETE route history instead of reassigning "
                 "it (use only for confirmed stray test runs). Repeatable.",
        )
        parser.add_argument(
            "--delete-riders", action="store_true",
            help="Hard-delete de-duped RiderAccounts instead of soft-archiving "
                 "them (still gated on zero remaining links).",
        )
        parser.add_argument(
            "--delete-orphan-shadow", action="append", default=[], metavar="USERNAME",
            dest="orphan_shadows",
            help="Hard-delete a non-POPS User shadow that has NO canonical to merge "
                 "into — ONLY if it carries zero string/route history and only "
                 "policy-handled FK refs (tokens). Refuses otherwise. For dead "
                 "PIA-login staff shadows. Repeatable.",
        )
        parser.add_argument(
            "--archive-rider", action="append", default=[], metavar="RIDER_ID",
            dest="archive_riders",
            help="Soft-archive a RiderAccount whose pops_rider_id is NOT in the "
                 "current POPS pull — ONLY if it carries zero route/string history "
                 "(else reassign via --map first). Also removes its User shadow if "
                 "clean. Repeatable.",
        )
        parser.add_argument(
            "--rename", action="append", default=[], metavar="OLD=NEW",
            dest="rename_pairs",
            help="Rename a local RiderAccount's rider_id OLD -> NEW to match POPS. "
                 "NEW must equal the rider_id POPS reports for OLD's pops_rider_id "
                 "(authoritative); rewrites the record's route history (employee_id), "
                 "its User-shadow username, and rider_id. Refuses on collision. "
                 "Runs last. Repeatable.",
        )
        parser.add_argument(
            "--min-pops-riders", type=int, default=20,
            help="Minimum rider count for the POPS pull to be trusted complete "
                 "(default 20; a healthy pull has been ~38).",
        )
        parser.add_argument(
            "--pops-json", default=None, metavar="PATH",
            help="Load the POPS rider list from a JSON file instead of a live "
                 "fetch (the file may be a list or a {'results': [...]}/{'riders': [...]} dict).",
        )

    # ------------------------------------------------------------------ #
    # entrypoint
    # ------------------------------------------------------------------ #
    def handle(self, *args, **opts):
        self.apply = bool(opts["apply"])
        self.auto_match = bool(opts["auto_match"])
        self.delete_riders = bool(opts["delete_riders"])
        self.delete_history_for = set(opts["delete_history_for"])
        self.orphan_shadows = list(opts["orphan_shadows"])
        self.archive_riders = list(opts["archive_riders"])
        self.rename_map = self._parse_maps(opts["rename_pairs"])
        self.min_pops = opts["min_pops_riders"]
        self.explicit_map = self._parse_maps(opts["maps"])

        # Filter the static ref tables down to what actually exists in this build.
        self.string_refs = [
            (lbl, fld) for (lbl, fld) in STRING_EMP_REFS
            if _model(lbl) and _has_field(_model(lbl), fld)
        ]

        mode = self.style.ERROR("APPLY (writes enabled)") if self.apply \
            else self.style.WARNING("DRY-RUN (no writes)")
        self._h1(f"purge_legacy_users — mode: {mode}")

        # 1. POPS roster -------------------------------------------------
        pops = self._load_pops(opts["pops_json"])
        self._report_pops(pops)
        destructive_allowed = bool(pops.healthy_for and pops.count >= self.min_pops)
        if not destructive_allowed:
            self.stdout.write(self.style.ERROR(
                "\n  POPS pull unavailable or below the completeness threshold "
                f"(got {pops.count}, need >= {self.min_pops}).\n"
                "  -> Running in REPORT-ONLY mode: no User/RiderAccount will be "
                "removed regardless of --apply.\n"
                "  -> Fix RIDER_PRO_SERVICE_TOKEN / connectivity (or pass --pops-json) "
                "and re-run."
            ))

        # 2. Before snapshot --------------------------------------------
        before = self._snapshot()
        self._report_snapshot("BEFORE", before)

        # 3. POPS-side duplicates + local rider mismatches (flag only) ---
        self._report_pops_side_dups(pops)
        self._report_rider_mismatches(pops)

        # 4. Mutating passes --------------------------------------------
        def _run_passes():
            return (
                self._purge_users(pops, destructive_allowed),
                self._dedup_riders(pops, destructive_allowed),
                self._delete_orphan_shadows(pops, destructive_allowed),
                self._archive_non_pops_riders(pops, destructive_allowed),
                self._rename_riders(pops, destructive_allowed),   # runs LAST
            )

        if self.apply and destructive_allowed:
            with transaction.atomic():
                results = _run_passes()
        else:
            results = _run_passes()
        user_results, rider_results, orphan_results, archive_results, rename_results = results

        # 5. After snapshot + summary -----------------------------------
        if self.apply and destructive_allowed:
            after = self._snapshot()
            self._report_snapshot("AFTER", after)
            self._report_delta(before, after)

        self._report_summary(user_results, rider_results, orphan_results,
                             archive_results, rename_results, destructive_allowed)

    # ------------------------------------------------------------------ #
    # POPS roster
    # ------------------------------------------------------------------ #
    def _load_pops(self, pops_json):
        state = PopsState()
        if pops_json:
            import json
            try:
                with open(pops_json) as fh:
                    data = json.load(fh)
                if isinstance(data, dict):
                    data = data.get("results") or data.get("riders") or []
                if not isinstance(data, list):
                    raise ValueError("expected a list (or {'results': [...]})")
                state.absorb(data)
            except Exception as exc:  # noqa: BLE001 — surface any load problem
                state.error = f"--pops-json load failed: {exc}"
            return state

        token = getattr(settings, "RIDER_PRO_SERVICE_TOKEN", None)
        if not token:
            state.error = "RIDER_PRO_SERVICE_TOKEN not configured (no --pops-json given)."
            return state
        try:
            from utils.pops_client import pops_client
            riders, error = pops_client.fetch_riders(token)
            if riders is None:
                state.error = f"POPS fetch_riders failed: {error}"
                return state
            state.absorb(riders)
        except Exception as exc:  # noqa: BLE001
            state.error = f"POPS fetch error: {exc}"
        return state

    def _report_pops(self, pops):
        self._h2("POPS roster")
        if pops.error:
            self.stdout.write(self.style.ERROR(f"  ! {pops.error}"))
        if pops.ok:
            self.stdout.write(f"  pulled {pops.count} rider(s) from POPS")
            self.stdout.write(f"  distinct rider_id: {len(pops.rider_ids)}")

    def _report_pops_side_dups(self, pops):
        if not pops.dup_rider_ids:
            return
        self._h2("POPS-SIDE duplicates (fix in POPS — NOT touched here)")
        for rid, pks in sorted(pops.dup_rider_ids.items()):
            self.stdout.write(self.style.WARNING(
                f"  rider_id={rid!r} appears under POPS ids {pks} — flag for POPS-side cleanup."
            ))

    def _report_rider_mismatches(self, pops):
        """Flag (report-only) local RiderAccounts that don't line up with the
        current POPS pull: never-synced, removed-from-POPS, or rider_id typos.
        Each gets a copy-pasteable --map suggestion where one is derivable."""
        if not pops.ok:
            return
        RiderAccount = _model("authentication.RiderAccount")
        flagged = []
        for ra in RiderAccount.objects.filter(archived_at__isnull=True).order_by("rider_id"):
            if ra.pops_rider_id is None:
                flagged.append((ra.rider_id,
                                "local-only (never synced to POPS) — review / soft-archive"))
            elif ra.pops_rider_id not in pops.pks:
                flagged.append((ra.rider_id,
                                f"pops_rider_id={ra.pops_rider_id} not in current POPS pull "
                                "— removed from POPS? consider soft-archive"))
            elif ra.rider_id not in pops.rider_ids:
                canon = pops.pk_to_rider_id.get(ra.pops_rider_id)
                flagged.append((ra.rider_id,
                                f"rider_id mismatch — POPS id {ra.pops_rider_id} is {canon!r} "
                                f"(possible local typo):  --map {ra.rider_id}={canon}"))
        if not flagged:
            return
        self._h2("LOCAL RiderAccounts not matching the POPS pull (flag only — pass --map to de-dup)")
        for rid, note in flagged:
            self.stdout.write(self.style.WARNING(f"  {rid!r}: {note}"))

    # ------------------------------------------------------------------ #
    # snapshots
    # ------------------------------------------------------------------ #
    def _snapshot(self):
        RiderAccount = _model("authentication.RiderAccount")
        snap = {"users_total": User.objects.count()}
        for src in ("pops", "rider", "local", "webhook"):
            snap[f"users_{src}"] = User.objects.filter(auth_source=src).count()
        snap["users_email"] = User.objects.filter(username__contains="@").count()
        snap["riders_total"] = RiderAccount.objects.count()
        snap["riders_archived"] = RiderAccount.objects.exclude(archived_at=None).count()
        return snap

    def _report_snapshot(self, label, snap):
        self._h2(f"{label} counts")
        self.stdout.write(
            f"  users: total={snap['users_total']} "
            f"(pops={snap['users_pops']}, rider={snap['users_rider']}, "
            f"local={snap['users_local']}, webhook={snap['users_webhook']}, "
            f"email={snap['users_email']})"
        )
        self.stdout.write(
            f"  riders: total={snap['riders_total']} "
            f"(archived={snap['riders_archived']})"
        )

    def _report_delta(self, before, after):
        self._h2("DELTA (before -> after)")
        for key in before:
            if before[key] != after[key]:
                self.stdout.write(
                    f"  {key}: {before[key]} -> {after[key]} ({after[key] - before[key]:+d})"
                )

    # ------------------------------------------------------------------ #
    # USER purge pass
    # ------------------------------------------------------------------ #
    def _purge_users(self, pops, destructive_allowed):
        self._h1("USER PURGE — legacy PIA-login duplicate shadows")
        RiderAccount = _model("authentication.RiderAccount")

        candidates = []
        for u in User.objects.filter(auth_source="pops").order_by("username"):
            uname = u.username or ""
            if uname in self.orphan_shadows:
                continue  # explicitly handled by the orphan-shadow pass
            if "@" in uname:
                continue  # email-ish; not a bare emp-id PIA shadow
            if RiderAccount.objects.filter(rider_id=uname).exists():
                continue  # backed by a RiderAccount — handled by the rider pass, not here
            if uname in pops.rider_ids:
                continue  # username IS a live POPS rider_id — keep
            candidates.append(u)

        results = {"acted": [], "review": [], "skipped_unsafe": []}
        if not candidates:
            self.stdout.write("  no legacy pops-source candidate users found.")
            return results

        for u in candidates:
            self._purge_one_user(u, pops, destructive_allowed, results)
        return results

    def _purge_one_user(self, u, pops, destructive_allowed, results):
        ident = u.username
        canonical = self._resolve_canonical(u, pops)
        string_counts = self._string_ref_counts(ident)
        fk_counts = self._fk_link_counts(u)

        self.stdout.write("")
        self.stdout.write(self.style.MIGRATE_HEADING(
            f"  USER {ident!r}  (role={u.role}, name={u.full_name!r}, id={u.pk})"
        ))
        self._print_links(string_counts, fk_counts)

        if canonical is None:
            self._print_suggestions(u, pops)
            self.stdout.write(self.style.WARNING(
                "    -> NO canonical resolved -> MANUAL REVIEW (not removed). "
                "Provide --map to act."
            ))
            results["review"].append(ident)
            return

        c_kind, c_id, c_user = canonical
        self.stdout.write(
            f"    canonical: {c_kind} {c_id!r}"
            + (f"  (User#{c_user.pk})" if c_user else "  (no User shadow)")
        )

        delete_history = ident in self.delete_history_for
        # Plan the string-ref handling.
        if delete_history:
            hist = self._route_history_counts(ident)
            self.stdout.write(self.style.WARNING(
                f"    history mode (--delete-history-for): DELETE own route history {hist}; "
                "NULL this id's name-stamp on shipments/events (real records kept, not reassigned)"
            ))

        # Blocking = FK relations we don't have a safe policy for.
        blocking = {
            k: v for k, v in fk_counts.items()
            if k.rsplit(".", 1)[0] not in USER_FK_POLICY
        }

        if not destructive_allowed:
            self.stdout.write(self.style.WARNING(
                "    -> would reassign, but POPS pull not trusted -> REPORT-ONLY (kept)."
            ))
            results["skipped_unsafe"].append(ident)
            return

        if blocking:
            self.stdout.write(self.style.ERROR(
                f"    -> BLOCKING FK refs with no safe policy: {blocking} -> MANUAL REVIEW (kept)."
            ))
            results["review"].append(ident)
            return

        # --- perform / preview string-ref + FK handling ----------------
        if delete_history:
            # Stray account: delete its OWN route history, and NULL its
            # name-stamp on shipment/event records (keeps real records, does
            # NOT reassign to the canonical id) so it leaves no footprint.
            self._delete_route_history(ident, apply=self.apply)
            cleared = self._clear_nonroute_string_refs(ident, c_id, apply=self.apply)
            verb = "cleared" if self.apply else "would clear"
            if cleared:
                self.stdout.write(f"    {verb}: {cleared}")
        else:
            moved = self._reassign_string_refs(ident, c_id, apply=self.apply)
            verb = "reassigned" if self.apply else "would reassign"
            if moved:
                self.stdout.write(f"    {verb}: {moved}  -> {c_id!r}")
        fk_actions = self._handle_user_fk_links(u, c_user, apply=self.apply)
        if fk_actions:
            self.stdout.write(f"    FK handling: {fk_actions}")

        # --- re-verify ZERO links, then delete -------------------------
        if self.apply:
            rem_s = self._string_ref_counts(ident)
            rem_fk = self._fk_link_counts(u)
            if rem_s or rem_fk:
                self.stdout.write(self.style.ERROR(
                    f"    -> STILL LINKED after handling (string={rem_s}, fk={rem_fk}); "
                    "NOT deleted -> MANUAL REVIEW."
                ))
                results["review"].append(ident)
                return
            u.delete()
            self.stdout.write(self.style.SUCCESS(f"    -> DELETED user {ident!r}"))
        else:
            self.stdout.write(self.style.SUCCESS(
                f"    -> WOULD DELETE user {ident!r} (zero links remain after handling)"
            ))
        results["acted"].append(ident)

    # ------------------------------------------------------------------ #
    # canonical resolution
    # ------------------------------------------------------------------ #
    def _resolve_canonical(self, u, pops):
        """Return (kind, canonical_id_str, canonical_user_or_None) or None."""
        RiderAccount = _model("authentication.RiderAccount")
        target = self.explicit_map.get(u.username)
        if target:
            return self._validate_canonical(target, pops, allow_unconfirmed=False)

        if self.auto_match and (u.full_name or "").strip():
            email_matches = list(
                User.objects.filter(full_name__iexact=u.full_name)
                .exclude(pk=u.pk)
                .filter(username__contains="@")
                .values_list("username", flat=True)
            )
            rider_matches = list(
                RiderAccount.objects.filter(full_name__iexact=u.full_name)
                .filter(pops_rider_id__in=pops.pks)
                .values_list("rider_id", flat=True)
            )
            unique = list(dict.fromkeys(email_matches + rider_matches))
            if len(unique) == 1:
                return self._validate_canonical(unique[0], pops, allow_unconfirmed=False)
        return None

    def _validate_canonical(self, target, pops, allow_unconfirmed):
        """Resolve a target string to a confirmed-live canonical record."""
        RiderAccount = _model("authentication.RiderAccount")
        if "@" in target:
            cu = User.objects.filter(username__iexact=target).first()
            if cu and (cu.is_active or allow_unconfirmed):
                return ("google-sso-user", cu.username, cu)
            self.stdout.write(self.style.ERROR(
                f"    canonical {target!r} not a usable active email User — skipping."
            ))
            return None
        ra = RiderAccount.objects.filter(rider_id=target).first()
        if ra and (ra.pops_rider_id in pops.pks or allow_unconfirmed):
            shadow = User.objects.filter(username=ra.rider_id).first()
            return ("live-pops-rider", ra.rider_id, shadow)
        self.stdout.write(self.style.ERROR(
            f"    canonical {target!r} is not a live POPS rider (pops_rider_id not in pull) — skipping."
        ))
        return None

    def _print_suggestions(self, u, pops):
        RiderAccount = _model("authentication.RiderAccount")
        if not (u.full_name or "").strip():
            return
        emails = list(
            User.objects.filter(full_name__iexact=u.full_name)
            .exclude(pk=u.pk).filter(username__contains="@")
            .values_list("username", flat=True)
        )
        riders = list(
            RiderAccount.objects.filter(full_name__iexact=u.full_name)
            .values_list("rider_id", "pops_rider_id")
        )
        if emails or riders:
            self.stdout.write("    full_name suggestions (verify before mapping):")
            for e in emails:
                self.stdout.write(f"        --map {u.username}={e}   (Google-SSO user)")
            for rid, pk in riders:
                live = "live" if pk in pops.pks else "NOT in POPS pull"
                self.stdout.write(f"        --map {u.username}={rid}   (RiderAccount, {live})")

    # ------------------------------------------------------------------ #
    # string-ref helpers
    # ------------------------------------------------------------------ #
    def _string_ref_counts(self, ident):
        counts = {}
        for label, field in self.string_refs:
            n = _model(label).objects.filter(**{field: ident}).count()
            if n:
                counts[f"{label}.{field}"] = n
        return counts

    def _route_history_counts(self, ident):
        return {
            label: _model(label).objects.filter(**{field: ident}).count()
            for label, field in ROUTE_HISTORY
            if _model(label).objects.filter(**{field: ident}).exists()
        }

    def _reassign_string_refs(self, stale, canonical, apply, skip=None):
        skip = set(skip or [])
        moved = {}
        for label, field in self.string_refs:
            if (label, field) in skip:
                continue
            qs = _model(label).objects.filter(**{field: stale})
            n = qs.count()
            if n:
                moved[f"{label}.{field}"] = n
                if apply:
                    qs.update(**{field: canonical})
        return moved

    def _delete_route_history(self, ident, apply):
        if not apply:
            return
        # Delete tracking first, then sessions (sessions cascade their tracking).
        _model("shipments.RouteTracking").objects.filter(employee_id=ident).delete()
        _model("shipments.RouteSession").objects.filter(employee_id=ident).delete()

    def _clear_nonroute_string_refs(self, ident, canonical, apply):
        """For --delete-history-for ids: NULL the non-route string stamps (where
        the field allows null) so the stale id leaves no footprint, WITHOUT
        deleting the underlying shipment/event records. A non-nullable field
        falls back to a reassign to the canonical id. Route history is deleted
        separately by _delete_route_history."""
        route = set(ROUTE_HISTORY)
        actions = {}
        for label, field in self.string_refs:
            if (label, field) in route:
                continue
            model = _model(label)
            qs = model.objects.filter(**{field: ident})
            n = qs.count()
            if not n:
                continue
            nullable = model._meta.get_field(field).null
            if nullable:
                actions[f"{label}.{field}"] = (n, "null")
                if apply:
                    qs.update(**{field: None})
            else:
                actions[f"{label}.{field}"] = (n, f"reassign->{canonical}")
                if apply:
                    qs.update(**{field: canonical})
        return actions

    # ------------------------------------------------------------------ #
    # FK-ref helpers (reverse relations pointing at a User)
    # ------------------------------------------------------------------ #
    def _fk_link_counts(self, user):
        counts = {}
        for rel in user._meta.related_objects:
            model = rel.related_model
            fname = rel.field.name
            n = model.objects.filter(**{fname: user}).count()
            if n:
                counts[f"{model._meta.label}.{fname}"] = n
        return counts

    def _handle_user_fk_links(self, user, canonical_user, apply):
        actions = {}
        for rel in user._meta.related_objects:
            model = rel.related_model
            fname = rel.field.name
            label = model._meta.label
            qs = model.objects.filter(**{fname: user})
            n = qs.count()
            if not n:
                continue
            policy = USER_FK_POLICY.get(label, "block")
            key = f"{label}.{fname}"
            if policy == "delete":
                actions[key] = (n, "delete")
                if apply:
                    qs.delete()
            elif policy == "repoint_or_delete":
                if canonical_user is not None:
                    actions[key] = (n, f"repoint->{canonical_user.username}")
                    if apply:
                        qs.update(**{fname: canonical_user})
                else:
                    actions[key] = (n, "delete")
                    if apply:
                        qs.delete()
            elif policy == "repoint_or_null":
                if canonical_user is not None:
                    actions[key] = (n, f"repoint->{canonical_user.username}")
                    if apply:
                        qs.update(**{fname: canonical_user})
                else:
                    actions[key] = (n, "null")
                    if apply:
                        qs.update(**{fname: None})
            else:
                actions[key] = (n, "BLOCK")
        return actions

    def _print_links(self, string_counts, fk_counts):
        if string_counts:
            self.stdout.write(f"    string refs (history): {string_counts}")
        else:
            self.stdout.write("    string refs (history): none")
        if fk_counts:
            self.stdout.write(f"    FK refs: {fk_counts}")

    # ------------------------------------------------------------------ #
    # RIDER de-dup pass (misspelled RiderAccount -> canonical)
    # ------------------------------------------------------------------ #
    def _dedup_riders(self, pops, destructive_allowed):
        RiderAccount = _model("authentication.RiderAccount")
        # Only --map entries whose STALE side matches a RiderAccount.rider_id.
        rider_maps = {
            stale: target for stale, target in self.explicit_map.items()
            if RiderAccount.objects.filter(rider_id=stale).exists()
        }
        if not rider_maps:
            return {"acted": [], "review": [], "skipped_unsafe": []}

        self._h1("RIDERACCOUNT DE-DUP")
        results = {"acted": [], "review": [], "skipped_unsafe": []}
        for stale, target in rider_maps.items():
            self._dedup_one_rider(stale, target, pops, destructive_allowed, results)
        return results

    def _dedup_one_rider(self, stale, target, pops, destructive_allowed, results):
        RiderAccount = _model("authentication.RiderAccount")
        stale_ra = RiderAccount.objects.filter(rider_id=stale).first()
        canon_ra = RiderAccount.objects.filter(rider_id=target).first()

        self.stdout.write("")
        self.stdout.write(self.style.MIGRATE_HEADING(
            f"  RIDER {stale!r} -> {target!r}"
        ))
        if not canon_ra:
            self.stdout.write(self.style.ERROR(
                f"    canonical RiderAccount {target!r} not found -> MANUAL REVIEW."
            ))
            results["review"].append(stale)
            return
        if canon_ra.pops_rider_id not in pops.pks:
            self.stdout.write(self.style.ERROR(
                f"    canonical {target!r} not in current POPS pull "
                f"(pops_rider_id={canon_ra.pops_rider_id}) -> MANUAL REVIEW."
            ))
            results["review"].append(stale)
            return

        string_counts = self._string_ref_counts(stale)
        self.stdout.write(f"    history under {stale!r}: {string_counts or 'none'}")

        if not destructive_allowed:
            self.stdout.write(self.style.WARNING(
                "    -> POPS pull not trusted -> REPORT-ONLY (kept)."
            ))
            results["skipped_unsafe"].append(stale)
            return

        # 1. Reassign the route/reimbursement history (string-keyed) to canonical.
        moved = self._reassign_string_refs(stale, target, apply=self.apply)
        verb = "reassigned" if self.apply else "would reassign"
        if moved:
            self.stdout.write(f"    {verb}: {moved} -> {target!r}")

        # 2. Soft-archive (default) or hard-delete the stale RiderAccount.
        if self.delete_riders:
            self._hard_delete_rider(stale_ra, stale, results)
        else:
            if self.apply:
                stale_ra.archived_at = timezone.now()
                stale_ra.is_active = False
                stale_ra.save(update_fields=["archived_at", "is_active"])
                self.stdout.write(self.style.SUCCESS(
                    f"    -> SOFT-ARCHIVED RiderAccount {stale!r} (archived_at set, is_active=False)"
                ))
            else:
                self.stdout.write(self.style.SUCCESS(
                    f"    -> WOULD SOFT-ARCHIVE RiderAccount {stale!r}"
                ))
            results["acted"].append(stale)

        # 3. Deactivate (or delete) the rider's User shadow, if any.
        self._handle_rider_user_shadow(stale, results)

    def _hard_delete_rider(self, stale_ra, stale, results):
        # Enumerate FK refs to this RiderAccount; only delete if zero remain.
        fk = {}
        for rel in stale_ra._meta.related_objects:
            model = rel.related_model
            fname = rel.field.name
            n = model.objects.filter(**{fname: stale_ra}).count()
            if n:
                fk[f"{model._meta.label}.{fname}"] = n
        if fk:
            self.stdout.write(self.style.ERROR(
                f"    -> RiderAccount {stale!r} still has FK refs {fk}; NOT hard-deleted "
                "-> soft-archive instead / MANUAL REVIEW."
            ))
            results["review"].append(stale)
            return
        if self.apply:
            stale_ra.delete()
            self.stdout.write(self.style.SUCCESS(f"    -> HARD-DELETED RiderAccount {stale!r}"))
        else:
            self.stdout.write(self.style.SUCCESS(
                f"    -> WOULD HARD-DELETE RiderAccount {stale!r} (zero FK refs)"
            ))
        results["acted"].append(stale)

    def _handle_rider_user_shadow(self, stale, results):
        shadow = User.objects.filter(username=stale).first()
        if not shadow:
            return
        # The dedup reassignment (run just before this) moves EVERY string ref
        # keyed by `stale` to the canonical id, so by construction the shadow has
        # no string-keyed history left. Only an unhandled FK relation can block —
        # judge the decision on that alone so the dry-run preview matches apply.
        fk_counts = self._fk_link_counts(shadow)
        blocking = {
            k: v for k, v in fk_counts.items()
            if k.rsplit(".", 1)[0] not in USER_FK_POLICY
        }
        if blocking:
            self.stdout.write(self.style.WARNING(
                f"    user shadow {stale!r}: BLOCKING FK refs {blocking}; deactivating only."
            ))
            if self.apply:
                shadow.is_active = False
                shadow.save(update_fields=["is_active"])
            results["review"].append(f"{stale} (user shadow)")
            return
        # Clean enough to remove the shadow user too.
        self._handle_user_fk_links(shadow, None, apply=self.apply)
        if self.apply:
            if self._string_ref_counts(stale) or self._fk_link_counts(shadow):
                shadow.is_active = False
                shadow.save(update_fields=["is_active"])
                self.stdout.write(self.style.WARNING(
                    f"    user shadow {stale!r}: links remain -> deactivated (not deleted)."
                ))
            else:
                shadow.delete()
                self.stdout.write(self.style.SUCCESS(f"    -> DELETED user shadow {stale!r}"))
        else:
            self.stdout.write(self.style.SUCCESS(
                f"    -> WOULD DELETE user shadow {stale!r} (zero links after reassign)"
            ))

    # ------------------------------------------------------------------ #
    # ORPHAN shadow removal — non-POPS Users with NO canonical (staff PIA
    # shadows). Safe ONLY when zero-history + only policy-handled FK refs.
    # ------------------------------------------------------------------ #
    def _delete_orphan_shadows(self, pops, destructive_allowed):
        results = {"acted": [], "review": []}
        if not self.orphan_shadows:
            return results
        self._h1("ORPHAN SHADOW REMOVAL (no canonical — zero-history only)")
        for uname in self.orphan_shadows:
            u = User.objects.filter(username=uname).first()
            self.stdout.write("")
            self.stdout.write(self.style.MIGRATE_HEADING(f"  ORPHAN SHADOW {uname!r}"))
            if not u:
                self.stdout.write(self.style.ERROR("    not found -> skip."))
                results["review"].append(uname)
                continue
            if "@" in uname:
                self.stdout.write(self.style.ERROR(
                    "    refusing: looks like an email/Google-SSO account -> skip."))
                results["review"].append(uname)
                continue
            string_counts = self._string_ref_counts(uname)
            fk_counts = self._fk_link_counts(u)
            blocking = {k: v for k, v in fk_counts.items()
                        if k.rsplit(".", 1)[0] not in USER_FK_POLICY}
            self.stdout.write(f"    (role={u.role}, name={u.full_name!r}, src={u.auth_source})")
            self._print_links(string_counts, fk_counts)
            if string_counts:
                self.stdout.write(self.style.ERROR(
                    "    refusing: has history -> reassign via --map first, not an orphan delete."))
                results["review"].append(uname)
                continue
            if blocking:
                self.stdout.write(self.style.ERROR(
                    f"    refusing: BLOCKING FK refs {blocking} -> MANUAL REVIEW."))
                results["review"].append(uname)
                continue
            if not destructive_allowed:
                self.stdout.write(self.style.WARNING(
                    "    -> POPS pull not trusted -> REPORT-ONLY (kept)."))
                continue
            fk_actions = self._handle_user_fk_links(u, None, apply=self.apply)
            if fk_actions:
                self.stdout.write(f"    FK handling: {fk_actions}")
            if self.apply:
                if self._string_ref_counts(uname) or self._fk_link_counts(u):
                    self.stdout.write(self.style.ERROR(
                        "    -> STILL LINKED after handling; NOT deleted -> MANUAL REVIEW."))
                    results["review"].append(uname)
                    continue
                u.delete()
                self.stdout.write(self.style.SUCCESS(f"    -> DELETED orphan shadow {uname!r}"))
            else:
                self.stdout.write(self.style.SUCCESS(
                    f"    -> WOULD DELETE orphan shadow {uname!r} (zero links)"))
            results["acted"].append(uname)
        return results

    # ------------------------------------------------------------------ #
    # NON-POPS rider archive — RiderAccounts whose pops_rider_id is gone from
    # POPS. Soft-archive (preferred) ONLY when zero route/string history.
    # ------------------------------------------------------------------ #
    def _archive_non_pops_riders(self, pops, destructive_allowed):
        results = {"acted": [], "review": []}
        if not self.archive_riders:
            return results
        RiderAccount = _model("authentication.RiderAccount")
        self._h1("NON-POPS RIDER ARCHIVE (pops_rider_id gone from POPS — zero-history only)")
        for rid in self.archive_riders:
            ra = RiderAccount.objects.filter(rider_id=rid).first()
            self.stdout.write("")
            self.stdout.write(self.style.MIGRATE_HEADING(f"  RIDER ARCHIVE {rid!r}"))
            if not ra:
                self.stdout.write(self.style.ERROR("    RiderAccount not found -> skip."))
                results["review"].append(rid)
                continue
            if ra.pops_rider_id in pops.pks:
                self.stdout.write(self.style.ERROR(
                    f"    refusing: STILL a live POPS rider (pops_rider_id={ra.pops_rider_id} in pull) "
                    "-> not archiving."))
                results["review"].append(rid)
                continue
            string_counts = self._string_ref_counts(rid)
            self.stdout.write(
                f"    pops_rider_id={ra.pops_rider_id} (gone from POPS), history: {string_counts or 'none'}")
            if string_counts:
                self.stdout.write(self.style.ERROR(
                    "    refusing: has history -> reassign via --map first."))
                results["review"].append(rid)
                continue
            if not destructive_allowed:
                self.stdout.write(self.style.WARNING(
                    "    -> POPS pull not trusted -> REPORT-ONLY (kept)."))
                continue
            if self.apply:
                ra.archived_at = timezone.now()
                ra.is_active = False
                ra.save(update_fields=["archived_at", "is_active"])
                self.stdout.write(self.style.SUCCESS(f"    -> SOFT-ARCHIVED RiderAccount {rid!r}"))
            else:
                self.stdout.write(self.style.SUCCESS(f"    -> WOULD SOFT-ARCHIVE RiderAccount {rid!r}"))
            results["acted"].append(rid)
            # Its User shadow (zero history) can be removed too.
            self._handle_rider_user_shadow(rid, results)
        return results

    # ------------------------------------------------------------------ #
    # RIDER RENAME — align a local rider_id to the POPS-authoritative value.
    # Rewrites the record's string-keyed history, its User-shadow username, and
    # rider_id. Only renames to exactly what POPS calls OLD's pops_rider_id.
    # ------------------------------------------------------------------ #
    def _rename_riders(self, pops, destructive_allowed):
        results = {"acted": [], "review": []}
        if not self.rename_map:
            return results
        RiderAccount = _model("authentication.RiderAccount")
        self._h1("RIDER RENAME (align local rider_id to the POPS-pulled rider_id)")
        for old, new in self.rename_map.items():
            ra = RiderAccount.objects.filter(rider_id=old).first()
            self.stdout.write("")
            self.stdout.write(self.style.MIGRATE_HEADING(f"  RENAME {old!r} -> {new!r}"))
            if not ra:
                self.stdout.write(self.style.ERROR("    RiderAccount not found -> skip."))
                results["review"].append(old)
                continue
            # NEW must be exactly what POPS reports for THIS record's pops_rider_id.
            pops_name = pops.pk_to_rider_id.get(ra.pops_rider_id)
            if ra.pops_rider_id not in pops.pks or pops_name != new:
                self.stdout.write(self.style.ERROR(
                    f"    refusing: NEW must equal the POPS rider_id for this record's "
                    f"pops_rider_id (pops_rider_id={ra.pops_rider_id} -> POPS says "
                    f"{pops_name!r}, you asked {new!r})."))
                results["review"].append(old)
                continue
            # NEW must be free locally (no other RiderAccount / User holds it).
            clash_ra = RiderAccount.objects.filter(rider_id=new).exclude(pk=ra.pk).first()
            if clash_ra:
                self.stdout.write(self.style.ERROR(
                    f"    refusing: rider_id {new!r} already held by RiderAccount pk={clash_ra.pk} "
                    f"(pops={clash_ra.pops_rider_id}) -> remove/resolve that first."))
                results["review"].append(old)
                continue
            clash_u = User.objects.filter(username=new).exclude(username=old).first()
            if clash_u:
                self.stdout.write(self.style.ERROR(
                    f"    refusing: username {new!r} already held by User pk={clash_u.pk} -> resolve first."))
                results["review"].append(old)
                continue
            moved = self._string_ref_counts(old)
            sh = User.objects.filter(username=old).first()
            self.stdout.write(
                f"    history to rewrite: {moved or 'none'}; "
                f"shadow user: {'pk=%s' % sh.pk if sh else 'none'}")
            if not destructive_allowed:
                self.stdout.write(self.style.WARNING("    -> POPS pull not trusted -> REPORT-ONLY (kept)."))
                continue
            if self.apply:
                for label, field in self.string_refs:
                    _model(label).objects.filter(**{field: old}).update(**{field: new})
                if sh:
                    sh.username = new
                    sh.save(update_fields=["username"])
                ra.rider_id = new
                ra.synced_to_pops = True
                ra.save(update_fields=["rider_id", "synced_to_pops"])
                self.stdout.write(self.style.SUCCESS(
                    f"    -> RENAMED {old!r} -> {new!r} (history + shadow + rider_id)"))
            else:
                self.stdout.write(self.style.SUCCESS(
                    f"    -> WOULD RENAME {old!r} -> {new!r} (history + shadow + rider_id)"))
            results["acted"].append(f"{old}->{new}")
        return results

    # ------------------------------------------------------------------ #
    # summary + formatting
    # ------------------------------------------------------------------ #
    def _report_summary(self, user_results, rider_results, orphan_results,
                         archive_results, rename_results, destructive_allowed):
        self._h1("SUMMARY")
        verb = "DELETED/ARCHIVED" if self.apply else "WOULD remove"
        self.stdout.write(
            f"  users {verb}: {len(user_results['acted'])} "
            f"{user_results['acted'] or ''}"
        )
        self.stdout.write(
            f"  users for MANUAL REVIEW: {len(user_results['review'])} "
            f"{user_results['review'] or ''}"
        )
        if user_results["skipped_unsafe"]:
            self.stdout.write(self.style.WARNING(
                f"  users kept (POPS pull untrusted): {user_results['skipped_unsafe']}"
            ))
        self.stdout.write(
            f"  riders {verb}: {len(rider_results['acted'])} "
            f"{rider_results['acted'] or ''}"
        )
        if rider_results["review"]:
            self.stdout.write(
                f"  riders for MANUAL REVIEW: {rider_results['review']}"
            )
        if self.orphan_shadows:
            self.stdout.write(
                f"  orphan shadows {verb}: {len(orphan_results['acted'])} "
                f"{orphan_results['acted'] or ''}"
            )
            if orphan_results["review"]:
                self.stdout.write(
                    f"  orphan shadows for MANUAL REVIEW: {orphan_results['review']}"
                )
        if self.archive_riders:
            self.stdout.write(
                f"  non-POPS riders {verb}: {len(archive_results['acted'])} "
                f"{archive_results['acted'] or ''}"
            )
            if archive_results["review"]:
                self.stdout.write(
                    f"  non-POPS riders for MANUAL REVIEW: {archive_results['review']}"
                )
        if self.rename_map:
            verb_r = "RENAMED" if self.apply else "WOULD rename"
            self.stdout.write(
                f"  riders {verb_r}: {len(rename_results['acted'])} "
                f"{rename_results['acted'] or ''}"
            )
            if rename_results["review"]:
                self.stdout.write(
                    f"  riders rename SKIPPED (review): {rename_results['review']}"
                )

        if not self.apply:
            self.stdout.write(self.style.WARNING(
                "\n  DRY-RUN only — nothing was changed. Review the above, then re-run "
                "with --apply (and the same flags) to perform the cleanup."
            ))
        elif destructive_allowed:
            self.stdout.write(self.style.SUCCESS("\n  APPLY complete (committed)."))

    def _parse_maps(self, maps):
        out = {}
        for item in maps:
            if "=" not in item:
                raise ValueError(f"--map expects STALE=CANONICAL, got {item!r}")
            stale, target = item.split("=", 1)
            out[stale.strip()] = target.strip()
        return out

    def _h1(self, text):
        self.stdout.write("\n" + self.style.HTTP_INFO("=" * 78))
        self.stdout.write(self.style.HTTP_INFO(text))
        self.stdout.write(self.style.HTTP_INFO("=" * 78))

    def _h2(self, text):
        self.stdout.write("\n" + self.style.MIGRATE_LABEL(f"-- {text} --"))
