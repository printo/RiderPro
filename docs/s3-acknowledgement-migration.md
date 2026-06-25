# S3 Migration — Acknowledgement Media (RiderPro + POPS/PIA)

Single source of truth for moving RiderPro's delivery-acknowledgement artifacts (photo, signature, signed PDF) off local disk onto **S3 + CloudFront**, and updating the POPS UI to show both photo & signature in a modal with a working download. Covers the why, the locked decisions, and the phased build checklist for both repos.

---

## 1. Why

Today the files live **only on RiderPro's disk** (`/media/`, prod volume `/var/www/riderpro-media`). POPS stores just the URL string (`Order.acknowledgement_url`, a `CharField(max_length=400)`) and its UI `<img src>` loads the image **straight from RiderPro**. Problems:
- **Single point of failure** — measured **8,326 files / 9.5 GB** on one volume (prod, 2026-06-25). Lose/prune it → every POPS acknowledgement image becomes a dead link. No copy on the POPS side.
- **Download can't work cross-origin** from the POPS UI without CORS, which disk+nginx doesn't give us cleanly.
- POPS only renders the **photo**; the **signature** already arrives (in `callback_response`) but isn't shown.

## 2. Hard constraints (drive every decision)
1. **POPS field is `CharField(max_length=400)`** → the URL synced to POPS must be a **short, permanent public URL** (CloudFront custom domain). **No presigned URLs** — too long + they expire.
2. **Reads must stay auth-free** — POPS renders a plain `<img src>` with no auth header. Keep objects public via CloudFront. *No worse than today* (RiderPro `/media/` is already public-by-URL).
3. **Mirror every new `S3_*` env var into BOTH `docker-compose.yml` and `docker-compose.prod.yml`** (prod compose is standalone).

## 3. Locked decisions

| Decision | Choice |
|---|---|
| S3 auth | **Access key + secret** — server `localsettings.py`/env only (never repo/chat) |
| Bucket | **`pia-oms-uploads`** (shared PIA/OMS bucket), region **`ap-southeast-1`** |
| Object isolation | RiderPro objects under key prefix **`riderpro/media/`** |
| Public URL | **CloudFront custom domain `cdn.riderpro.printo.in`** (fits POPS 400-char field) |
| POPS/PIA scope | **Display-only** — UI + CORS download; no POPS storage/model change |
| Backfill | **Forward-only deploy first, then a deliberate backfill** of the 8,326 files / 9.5 GB |

## 4. Parameters / env vars (RiderPro)
```
USE_S3=true
S3_BUCKET=pia-oms-uploads
S3_REGION=ap-southeast-1
S3_LOCATION=riderpro/media          # key prefix inside the shared bucket
S3_CDN_DOMAIN=cdn.riderpro.printo.in
AWS_ACCESS_KEY_ID=${set on server only}
AWS_SECRET_ACCESS_KEY=${set on server only}
```
Object key: `riderpro/media/photos/<uuid>.jpg` → URL `https://cdn.riderpro.printo.in/riderpro/media/photos/<uuid>.jpg` (~90 chars, well under 400).

## 5. ⚠️ Security preconditions (do first)
- [ ] **Rotate** the access key shared during planning; generate a fresh pair in IAM.
- [ ] Put the new secret **only** in the prod server's gitignored `backend/riderpro/localsettings.py` (or server `.env`). Never commit; never paste in chat.
- [ ] IAM policy scoped to the prefix:
  ```json
  { "Effect": "Allow",
    "Action": ["s3:PutObject","s3:GetObject","s3:DeleteObject"],
    "Resource": "arn:aws:s3:::pia-oms-uploads/riderpro/*" }
  ```

---

## Phase 0 — AWS infra (bucket already exists)
- [ ] **0.1** Keep `pia-oms-uploads` **private** (Block Public Access on).
- [ ] **0.2** CloudFront distribution with **Origin Access Control (OAC)** → `pia-oms-uploads`; add the OAC bucket policy so only CloudFront reads. Distribution **public** (no signed URLs/cookies).
- [ ] **0.3** Custom domain `cdn.riderpro.printo.in` + ACM cert (`us-east-1` for CloudFront) + DNS CNAME → distribution.
- [ ] **0.4** (Isolation, optional) CloudFront behavior for path pattern `riderpro/media/*`; else the default behavior serves the whole bucket via this domain (harmless, less tidy).
- [ ] **0.5 CORS (enables the POPS download button).** Attach a CORS **response-headers policy** to the behavior and **add `Origin` to the cache key**. (If ever serving S3 directly, set the bucket CORS rule too):
  ```json
  [{ "AllowedOrigins": ["https://pops.printo.in","http://localhost:3000"],
     "AllowedMethods": ["GET","HEAD"], "AllowedHeaders": ["*"],
     "ExposeHeaders": ["Content-Length","Content-Disposition"], "MaxAgeSeconds": 3600 }]
  ```
  Use the real POPS UI origin(s); avoid `*`.
- [ ] **0.6** Leave objects **inline** (no `Content-Disposition`) so `<img>` viewing works; download is forced client-side (Phase 2).
- **Acceptance:** a test object at `s3://pia-oms-uploads/riderpro/media/test.jpg` loads at `https://cdn.riderpro.printo.in/riderpro/media/test.jpg`, and a cross-origin `fetch()` from the POPS origin succeeds (CORS header present).

## Phase 1 — RiderPro backend

**1.1 Deps** — `backend/requirements.txt`: `boto3>=1.34`, `django-storages>=1.14`.

**1.2 Settings** — `backend/riderpro/settings.py` (keep existing `MEDIA_URL`/`MEDIA_ROOT` as local-dev fallback):
```python
USE_S3 = env_bool("USE_S3", False)
if USE_S3:
    STORAGES = {
        "default": {
            "BACKEND": "storages.backends.s3.S3Storage",
            "OPTIONS": {
                "bucket_name": os.environ["S3_BUCKET"],
                "region_name": os.environ["S3_REGION"],
                "location": os.environ.get("S3_LOCATION", "riderpro/media"),
                "custom_domain": os.environ["S3_CDN_DOMAIN"],
                "querystring_auth": False,   # CRITICAL: public URLs, never presigned
                "file_overwrite": False,
                "default_acl": None,         # OAC/CloudFront, no object ACLs
            },
        },
        "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
    }
    # creds from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in env/localsettings
```
> `localsettings.py` is imported last → prod forces `USE_S3=True` + creds there.

**1.3** `localsettings.example.py` — document `USE_S3`, `S3_BUCKET`, `S3_REGION`, `S3_LOCATION`, `S3_CDN_DOMAIN`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`.

**1.4 Compose** — add those vars to the `django` service `environment:` in **both** `docker-compose.yml` and `docker-compose.prod.yml` (values from gitignored `.env`).

**1.5 Save helpers** — `backend/apps/shipments/views.py`, refactor `_save_base64_image` (L232) + `_save_uploaded_file` (L269) to write through storage:
```python
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

def _store_bytes(self, raw: bytes, folder_name: str, ext: str) -> str:
    name = f"{folder_name}/{uuid.uuid4()}{ext}"          # photos/<uuid>.jpg
    saved = default_storage.save(name, ContentFile(raw))  # → S3 when USE_S3, else local
    return default_storage.url(saved)                     # absolute CDN URL (S3) or /media/.. (local)
```
- `_save_base64_image`: decode base64 → `_store_bytes(raw, folder, ext)`.
- `_save_uploaded_file`: `_store_bytes(uploaded_file.read(), folder, splitext(name)[1] or '.png')`.
- (If PR #4 merges, route its `_save_file_bytes` through `_store_bytes` too.)
- Keep folders: `photos/`, `signatures/`, `signed_pdfs/`.

**1.6 URL builder** — `_build_absolute_media_url` (L309): pass-through for absolute URLs, keep `request.build_absolute_uri` only for legacy relative `/media/...`:
```python
if url and (url.startswith("http://") or url.startswith("https://")):
    return url
return request.build_absolute_uri(url) if url else url
```

**1.7 No model change** — `Shipment.{photo_url,signature_url,signed_pdf_url}` + `Acknowledgment.{photo_url,signature_url}` are `TextField`; **no migration**. `_sync_shipment_to_pops` unchanged (now emits the short CDN URL; verify <400 chars).

- **Acceptance:** with `USE_S3=true`, a new acknowledgement POST lands under `s3://pia-oms-uploads/riderpro/media/...`; DB stores the `cdn.riderpro.printo.in` URL; POPS sync sends it; `py_compile` clean.

## Phase 2 — POPS / PIA UI (display-only)
File: `pops-prod-ui/src/views/deliveryq/PackageUpdate.js` ("Acknowledgement Details" block, ~L1201).
- [ ] **2.1** Render up to three artifacts conditionally:
  - **Photo** ← `orderDetail.acknowledgement_url`
  - **Signature** ← `orderDetail.callback_response?.riderpro_acknowledgment?.signature_url` (already arrives — no new field/flow)
  - **Challan PDF** (optional) ← `orderDetail.acknowledgement_submission_file`
- [ ] **2.2** Thumbnails with `cursor: zoom-in`; click → MUI `Dialog` modal (full image + **Download**); `onError` fallback.
- [ ] **2.3** Download handler (blob-fetch → forces filename; relies on Phase 0.5 CORS):
  ```js
  const res = await fetch(url); const blob = await res.blob();
  const o = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href:o, download:`acknowledgement_${orderId}.jpg` }).click();
  URL.revokeObjectURL(o);
  ```
- [ ] **2.4** No POPS backend/model/migration change — `CharField(400)` already holds the CDN URL.
- **Acceptance:** an order with both artifacts shows two thumbnails; modal opens; Download saves the file (no CORS error).

## Phase 3 — Backfill of existing files
- **Measured (prod, 2026-06-25):** **8,326 files / 9.5 GB** on `/var/www/riderpro-media`.
- **Approach (locked):** forward-only deploy first (Phase 1 covers new uploads), then run this as a separate deliberate step. Required — don't leave 8.3k files on one disk volume.
- [ ] **3.1 Copy** (resumable; re-run for stragglers): `aws s3 sync /var/www/riderpro-media s3://pia-oms-uploads/riderpro/media/`. ~9.5 GB → run in `tmux`.
- [ ] **3.1b Verify:** `aws s3 ls --recursive s3://pia-oms-uploads/riderpro/media/ | wc -l` ≈ 8326.
- [ ] **3.2 Rewrite DB URLs** — management command `backfill_media_urls` (dry-run default, `--apply` in a transaction): `https://riderpro.printo.in/media/<x>` → `https://cdn.riderpro.printo.in/riderpro/media/<x>` across `Shipment.{photo_url,signature_url,signed_pdf_url}` + `Acknowledgment.{photo_url,signature_url}`.
- [ ] **3.3 Re-point POPS** (re-PATCH `acknowledgement_url` + `callback_response` for existing orders) — **blocked/partial** until the POPS write-permission issue is resolved; likely scope to recent/open orders.
- [ ] **3.4** Verify a sample renders in POPS from the CDN; keep the local volume for a retention window before decommissioning.

---

## Rollout sequence
1. Phase 0 (infra) → 2. Phase 1 (`./deploy.sh backend`, `USE_S3=true`) → verify a new ack in POPS → 3. Phase 2 (POPS UI; independent, can parallelize) → 4. Phase 3 backfill + DB rewrite → 5. POPS re-point (when write access fixed) → 6. decommission local volume.

## Rollback
Flip `USE_S3=false` + recreate the backend container → new uploads return to local disk; already-S3 URLs (absolute) keep resolving via CDN. No DB rollback needed (URLs are absolute either way). Local volume retained until sign-off.

## Risks & gotchas
- **400-char cap** → short CDN URL only, never presigned (breaks POPS silently).
- **Public-read** = same exposure as today; tighter privacy would break `<img>` rendering (separate redesign).
- **POPS write access still broken** → Phase 3.3 re-point is partial until resolved (new uploads fine).
- **CloudFront CORS caching** → must vary on `Origin`, else intermittently-missing ACAO header.
- **Shared bucket** → `riderpro/media/` prefix isolates from OMS; a dedicated bucket would give cleaner IAM/lifecycle boundaries if preferred.
- **Secrets** → never commit AWS keys; mirror compose vars into both files.

## Test checklist
- [ ] New photo+signature upload → both in S3 under `riderpro/media/`, DB has CDN URLs, POPS payload <400 chars.
- [ ] POPS shows both thumbnails; modal opens; download works (no CORS error).
- [ ] Legacy (pre-migration) order still renders via fallback until backfilled.
- [ ] `USE_S3=false` dev path still saves to local `/media/`.
- [ ] No AWS secret in repo, compose, or logs.
