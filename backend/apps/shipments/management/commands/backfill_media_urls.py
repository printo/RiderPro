"""
Backfill on-disk acknowledgement media to S3 and repoint stored URLs to the CDN.

Before the S3 migration, photos/signatures were saved to local disk and the DB
stored root-relative paths like "/media/photos/<uuid>.jpg". New uploads now go
straight to S3 (USE_S3). This command migrates the EXISTING records:

  1. For each stored "/media/..." URL, upload the local file to S3 (preserving the
     same key) if it isn't there already.
  2. Rewrite the DB field to the absolute CloudFront URL.

Dry-run by default; pass --apply to actually upload + rewrite. Idempotent — re-runs
skip files already on S3 and rows already pointing at the CDN.

IMPORTANT: writes use QuerySet.update() (NOT obj.save()) so the Shipment post_save
callback signal does NOT fire — a backfill must never trigger thousands of POPS
callbacks.

Run inside the django container on the server (it has /app/media, the S3 creds, and
the DB):
    docker compose -f docker-compose.prod.yml exec django \
        python manage.py backfill_media_urls            # dry-run
    docker compose -f docker-compose.prod.yml exec django \
        python manage.py backfill_media_urls --apply    # execute
"""
import os

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q

from apps.shipments.models import Acknowledgment, Shipment

MEDIA_PREFIX = "/media/"

# Model -> URL-bearing TextFields to migrate.
TARGETS = {
    Shipment: ["photo_url", "signature_url", "signed_pdf_url"],
    Acknowledgment: ["photo_url", "signature_url"],
}


class Command(BaseCommand):
    help = (
        "Upload on-disk acknowledgement media to S3 and repoint stored URLs to the "
        "CloudFront CDN. Dry-run by default; --apply to execute."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Actually upload files + rewrite URLs (default is a dry-run).",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Process at most N records per model (0 = all). Useful for a test pass.",
        )

    def handle(self, *args, **opts):
        apply = opts["apply"]
        limit = opts["limit"]

        if not getattr(settings, "USE_S3", False):
            self.stderr.write(
                self.style.ERROR(
                    "USE_S3 is not enabled — default storage is local disk, so this "
                    "would not write to S3. Aborting."
                )
            )
            return

        media_root = str(settings.MEDIA_ROOT)
        mode = "APPLY" if apply else "DRY-RUN"
        self.stdout.write(self.style.WARNING(f"backfill_media_urls [{mode}] — MEDIA_ROOT={media_root}"))

        stats = {
            "scanned_fields": 0,
            "rewritten": 0,
            "uploaded": 0,
            "already_cdn": 0,
            "missing_local": 0,
            "skipped_empty": 0,
        }
        samples = []
        missing = []

        for model, fields in TARGETS.items():
            # Only rows whose fields still hold a "/media/..." path are candidates.
            media_filter = Q()
            for field in fields:
                media_filter |= Q(**{f"{field}__startswith": MEDIA_PREFIX})

            qs = model.objects.filter(media_filter).order_by("pk")
            if limit:
                qs = qs[:limit]

            model_updated = 0
            for obj in qs.iterator():
                updates = {}
                for field in fields:
                    value = getattr(obj, field, None)
                    if not value or not isinstance(value, str):
                        stats["skipped_empty"] += 1
                        continue
                    stats["scanned_fields"] += 1

                    if value.startswith(("http://", "https://")):
                        stats["already_cdn"] += 1
                        continue
                    if not value.startswith(MEDIA_PREFIX):
                        continue

                    rel = value[len(MEDIA_PREFIX):]  # e.g. "photos/<uuid>.jpg"
                    local_path = os.path.join(media_root, rel)
                    if not os.path.exists(local_path):
                        stats["missing_local"] += 1
                        if len(missing) < 20:
                            missing.append(f"{model.__name__}#{obj.pk}.{field}: {value}")
                        continue

                    # Ensure the object is on S3 (preserve the exact key).
                    if not default_storage.exists(rel):
                        if apply:
                            with open(local_path, "rb") as fh:
                                default_storage.save(rel, ContentFile(fh.read()))
                        stats["uploaded"] += 1

                    new_url = default_storage.url(rel)
                    updates[field] = new_url
                    stats["rewritten"] += 1
                    if len(samples) < 12:
                        samples.append(f"{model.__name__}#{obj.pk}.{field}: {value} -> {new_url}")

                if updates and apply:
                    # update() bypasses post_save signals — no POPS callbacks fired.
                    with transaction.atomic():
                        model.objects.filter(pk=obj.pk).update(**updates)
                if updates:
                    model_updated += 1

            self.stdout.write(f"  {model.__name__}: {model_updated} record(s) {'updated' if apply else 'to update'}")

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(f"=== {mode} summary ==="))
        for key, val in stats.items():
            self.stdout.write(f"  {key}: {val}")

        if samples:
            self.stdout.write("\n  sample rewrites:")
            for s in samples:
                self.stdout.write(f"    {s}")
        if missing:
            self.stdout.write(self.style.WARNING("\n  missing local files (cannot migrate — left as-is):"))
            for m in missing:
                self.stdout.write(f"    {m}")

        if not apply:
            self.stdout.write(self.style.WARNING("\nDry-run only — no files uploaded, no rows changed. Re-run with --apply to execute."))
