# Security Summary

**Reviewed Files**: 36
**Issues Resolved**: 6

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| Outbound Image Fetch Validation | `api/resolve-image.js`, `server.ts` | 1–33 | The `/api/resolve-image` route accepted arbitrary user-supplied URLs and performed a server-side `fetch()` without scheme, hostname, or private network checks. | High | Fixed | Added `lib/url-safety.js` (`validateSafeIbbResolveUrl`), restricting requests to HTTPS `ibb.co` / `i.ibb.co`, blocking loopback/private/link-local IPv4 and IPv6 addresses via DNS verification, disabling automatic redirects, enforcing a 5s timeout, and returning HTTP `400` on invalid URLs. Shared the same handler across `api/resolve-image.js` and `server.ts`. |
| Permissive Origin Reflection | `api/admin-auth.js`, `api/data.js`, `api/cloudinary.js`, `api/upload-vehicle-image.js` | 886, 102, 10, 22 | API responses echoed any request `Origin` header directly into `Access-Control-Allow-Origin`, including on authenticated administrative endpoints. | Medium | Fixed | Created `lib/cors.js` (`applyCorsHeaders` + `isAllowedOrigin`) so `Access-Control-Allow-Origin` is emitted only for the active request host, configured `APP_URL`/`VITE_APP_URL`, official production domains, preview subdomains, and local dev hosts. |
| Unbounded Public Submission Fields & Unsafe URLs | `api/data.js`, `src/components/SourceCarPage.tsx` | 476, 118 | `POST /api/leads/submit` and `POST /api/inquiries/submit` spread arbitrary request keys (`...item`) and accepted unvalidated `sourceUrl` / `sourceImage` strings. | Medium | Fixed | Added `sanitizePublicSubmission` in `api/data.js` to allowlist permitted fields, enforce length and budget bounds, validate IDs, require `http://` or `https://` for `sourceUrl`, and restrict `sourceImage` to raster `https://`/`http://`/`data:image/(jpeg|jpg|png|webp|avif)` payloads. |
| Unsafe Image Upload MIME Allowance | `api/cloudinary.js`, `api/upload-vehicle-image.js`, `src/components/SourceCarPage.tsx` | 203, 232, 60 | Upload endpoints checked `mimeType.startsWith('image/')`, which could accept SVG files capable of carrying active script markup. | Medium | Fixed | Replaced prefix checks with explicit raster MIME allowlists (`image/jpeg`, `image/jpg`, `image/png`, `image/webp`, `image/avif`, plus `heic`/`heif` for Cloudinary), returning HTTP `400` for disallowed types. |
| Unvalidated Dynamic Link Rendering | `src/components/admin/AdminLeadsTab.tsx`, `src/components/EditorialContentSection.tsx` | 299, 223 | Submitted listing URLs, screenshot previews, and editorial video links were bound directly to `<a href>` and `<img src>` without checking protocol safety. | Medium | Fixed | Added runtime `http:` / `https:` and safe raster image URL checks before rendering external links or images in both components. |
| Dependency & Repository Hygiene | `package.json`, `vercel.json`, `.gitignore`, `eslint.config.mjs` | — | Vite `6.2.3` had known advisories and duplicate `package.json` entries; Express `4.21.2` needed security patch updates; `vercel.json` used non-standard PCRE rewrite regexes; `data_store/admin_auth.json` was not listed in `.gitignore`. | Medium | Fixed | Upgraded `vite` to `^6.4.6` and `express` to `^4.22.3`, removed unused `nodemailer` packages, normalized `vercel.json` rewrites to valid `path-to-regexp` rules, updated `eslint.config.mjs` ignores, and ignored runtime auth/PII store files in `.gitignore`. |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| Administrator Session & Role Enforcement | `api/admin-auth.js`, `lib/supabase-rest.js` | Verifies server-signed HMAC tokens, Firebase RS256 ID tokens against Firestore `admins`, and Supabase JWTs against `admin_profiles` on every protected request; includes IP brute-force rate limiting and scrypt credential hashing with zero hardcoded passwords. |
| Protected Mutations & Data Access | `api/data.js`, `api/cloudinary.js`, `api/upload-vehicle-image.js`, `server.ts` | All admin reads (`GET /api/leads`, `GET /api/inquiries`, `GET /api/analytics`) and mutations (`POST /api/vehicles/upsert`, `DELETE /api/vehicles/:id`, Cloudinary/Supabase image signing and deletion, settings updates) return HTTP `401` unless `verifyRequestAdmin(req)` succeeds. |
| Secrets & Key Isolation | `.env.example`, `api/cloudinary.js`, `lib/supabase-rest.js` | Private credentials (`CLOUDINARY_API_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`) are read exclusively from server-side `process.env` and never bundled into client `VITE_` variables. |
| Database & Storage Access Rules | `supabase/schema.sql`, `firestore.rules`, `storage.rules` | Supabase Row Level Security restricts `admin_profiles`, `customer_enquiries`, and `inspection_bookings` writes/reads appropriately; Firestore rules enforce `isAuthorizedAdmin()` and restrict public submissions to `status == 'New'`. |

---

## PoC Verification

### 1. Outbound Image Fetch Validation (`api/resolve-image.js` & `server.ts`)

#### Summary
| Field | Value |
|---|---|
| Issue Type | Unrestricted Server-Side URL Fetch |
| Impact | High |
| Affected File | `api/resolve-image.js:18`, `server.ts:176`, `lib/url-safety.js:41` |
| Test Scenario | `GET /api/resolve-image?url=http://169.254.169.254/latest/meta-data/`, `GET /api/resolve-image?url=http://127.0.0.1:3000/api/vehicles`, and `GET /api/resolve-image?url=https://evil.example.com/a.jpg` |

#### How It Was Fixed
Requests to `/api/resolve-image` now pass through `validateSafeIbbResolveUrl` in `lib/url-safety.js`, which requires HTTPS, rejects embedded credentials or non-443 ports, restricts hostnames strictly to `ibb.co` / `www.ibb.co` / `i.ibb.co`, checks all DNS A/AAAA answers against private/loopback/link-local ranges via `isPrivateOrReservedIp`, and disables open redirect following.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Requests arrive at `GET /api/resolve-image` in `server.ts:176` -> `api/resolve-image.js:1`. | Input enters shared handler |
| 2 | `validateSafeIbbResolveUrl(targetUrl)` parses protocol and hostname in `lib/url-safety.js:41-66`. | `http://169.254.169.254/...` and `http://127.0.0.1:3000/...` fail protocol check; `https://evil.example.com/...` fails hostname allowlist |
| 3 | Live `curl`/Node test returned HTTP `400` JSON (`{"error":"Only HTTPS image URLs are allowed"}` / `{"error":"Only verified ibb.co image links can be resolved"}`) with zero outbound fetch. | **Handled Safely** |

---

### 2. Public Lead Submission Field & URL Validation (`api/data.js` & `AdminLeadsTab.tsx`)

#### Summary
| Field | Value |
|---|---|
| Issue Type | Unsanitized Public Submission Fields & Dynamic URL Binding |
| Impact | Medium |
| Affected File | `api/data.js:116`, `api/data.js:476`, `src/components/admin/AdminLeadsTab.tsx:22` |
| Test Scenario | `POST /api/leads/submit` with `{"id":"lead_test_1","name":"Test User","phone":"08012345678","sourceUrl":"javascript:alert(1)"}` and `sourceImage: "data:image/svg+xml;base64,PHN2Zz4="` |

#### How It Was Fixed
`sanitizePublicSubmission` in `api/data.js` replaced raw object spreading (`...item`) with explicit field allowlisting, type/length enforcement, `http://`/`https://` URL validation (`sanitizePublicHttpUrl`), and raster image validation (`sanitizeImageSrcUrl`). Additionally, `AdminLeadsTab.tsx` validates `sourceUrl` and `sourceImage` before rendering links or images.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Malicious payloads arrive at `POST /api/leads/submit` (`api/data.js:476`). | Input enters submission handler |
| 2 | `sanitizePublicSubmission` executes `sanitizePublicHttpUrl` and `sanitizeImageSrcUrl` (`api/data.js:133-143`, `lib/url-safety.js:84-103`). | Rejects `javascript:` URLs and `image/svg+xml` data URIs |
| 3 | Live test returned HTTP `400` (`{"error":"External listing URL must start with http:// or https://."}` / `{"error":"Attached screenshot must be a valid JPG, PNG, WebP, or AVIF image."}`). | **Handled Safely** |

---

### 3. Origin Header Validation on Admin & Data APIs (`lib/cors.js`)

#### Summary
| Field | Value |
|---|---|
| Issue Type | Permissive Origin Reflection |
| Impact | Medium |
| Affected File | `lib/cors.js:21`, `api/admin-auth.js:886`, `api/data.js:102`, `api/cloudinary.js:20`, `api/upload-vehicle-image.js:22` |
| Test Scenario | `GET /api/admin-auth?action=status` with `Origin: https://evil.example.com` vs `Origin: https://jiteautodeals.vercel.app` |

#### How It Was Fixed
All API handlers now call `applyCorsHeaders` from `lib/cors.js`, which checks the incoming `Origin` against allowed production domains, preview subdomains, active request host, and localhost dev origins before setting `Access-Control-Allow-Origin`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Request with `Origin: https://evil.example.com` hits `setSecurityHeaders` (`api/admin-auth.js:886`). | Origin passed to `applyCorsHeaders` |
| 2 | `isAllowedOrigin` (`lib/cors.js:21-55`) returns `false` for `https://evil.example.com` and `true` for `https://jiteautodeals.vercel.app`. | Untrusted origin omitted from response headers |
| 3 | Live test confirmed `Access-Control-Allow-Origin` was `null` for `https://evil.example.com` and `https://jiteautodeals.vercel.app` for the trusted domain. | **Handled Safely** |
