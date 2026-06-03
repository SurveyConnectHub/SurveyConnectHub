# Production Readiness Audit — System Classification

## Legend

| Status | Meaning |
|---|---|
| **NOT FULLY BUILT** | Major missing pieces — feature incomplete |
| **BUILT / NEEDS CRITICAL FIX** | Exists but has issues that will break in production, cause data loss, or expose security vulnerabilities |
| **BUILT / NEEDS HIGH FIX** | Exists but has functional bugs that degrade the user experience or could cause incorrect behavior |
| **BUILT / NEEDS LOW FIX** | Exists and works but needs polish, code cleanup, or minor UX improvements |
| **PRODUCTION READY** | Good to deploy as-is |

---

## System-by-System Assessment

### 1. Authentication & Authorization System
**Status: BUILT / NEEDS HIGH FIX**

**Critical issues (0):** None

**High issues (2):**
- Middleware (`middleware.ts:4-7`) — Uses `!` non-null assertions on `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY`; no try/catch on `supabase.auth.getUser()`. If env vars are missing or Supabase is down, the entire app crashes/hard-blocks on every request.
- Auth pages (`jobs/page.tsx`, `professionals/page.tsx`, `dashboard/*/contracts/page.tsx`, `dashboard/client/jobs/page.tsx`) — 5 pages call `supabase.auth.getUser()` without try/catch. A single Supabase outage crashes these routes.

**Low issues (2):**
- `messages/[contractId]/page.tsx` — `contractId` cast directly `as string` with no validation
- Missing inline types — uses ad-hoc `{ role?: string | null }` instead of importing from `types/database.ts`

---

### 2. Payment System (Paystack)
**Status: BUILT / NEEDS CRITICAL FIX**

**Critical issues (3):**
- `app/api/paystack/initialize/route.ts:64-66` — Exchange rate hardcoded to `v6.exchangerate-api.com` free tier (1500 requests/month). In production with even moderate traffic, rate limits will hit within days, breaking all payment initialization.
- `app/api/paystack/initialize/route.ts:65` — No timeout on `exchangeResponse` fetch. If the exchange API hangs, the request hangs indefinitely, blocking the user and leaving the DB in an inconsistent state (amount already persisted).
- `app/api/paystack/initialize/route.ts` — Amount persistence (inserting into `payment_initiations`) happens BEFORE Paystack initialization succeeds. If Paystack returns an error or the request fails, the DB has a dangling row representing an amount that was never actually sent to Paystack.

**High issues (3):**
- `app/api/paystack/initialize/route.ts` — PII logged to console: raw `email` variable included in console.log output. Production logging would expose user emails in log files.
- `app/api/paystack/transfer/route.ts:30` — Fee disclosure mismatch: `platform_fee = agreedBudget * 0.10` (10%) but UI states "5% commission". Users are being told one fee and charged another.
- `app/api/paystack/verify/route.ts` — Multiple DB writes not wrapped in a transaction. If one write fails mid-way (e.g., contract activation succeeds but notification fails), state is inconsistent.
- `app/api/paystack/transfer/route.ts:31` — `payment_released_at` set in DB BEFORE the actual Paystack transfer is initiated. If transfer fails after DB write, the system thinks payment was released but no money moved.
- `app/api/webhooks/paystack/route.ts:35` — Webhook handler doesn't handle `transfer.success` fully (just logs it). Transfer failed/reversed handler doesn't update contract status in DB.

---

### 3. Job Listing System
**Status: BUILT / NEEDS HIGH FIX**

**Critical issues (0):** None

**High issues (2):**
- `app/jobs/page.tsx:43` — Effect dependency bug: `useEffect` depends on `pageIndex` but `fetchJobs` doesn't re-run when search query or profession filter changes unless the page index also changes. Users can change filters and see no results update.
- `app/jobs/page.tsx` — No try/catch on `supabase.auth.getUser()`. If auth fails, the entire jobs listing page crashes with a white screen.

**Low issues (3):**
- `app/jobs/post/page.tsx:49` — `finalCountry` computed from `formData.location_country` and `customCountry` — no validation when `location_country === "Other"`, `customCountry` could be empty string
- `app/jobs/[id]/apply/page.tsx:52` — `id` from `useParams()` manually handled in two normalization spots; no AbortController on file upload
- Hardcoded `"en-GB"` locale throughout

---

### 4. Professionals Directory System
**Status: BUILT / NEEDS HIGH FIX**

**Critical issues (0):** None

**High issues (2):**
- `app/professionals/page.tsx:60-62` — Bug: filter-change effect (resets page to 1) depends on `currentPage`, causing it to ALSO fire on page changes. This creates a feedback loop where changing pages triggers a filter reset which triggers another page change. Also, `fetch()` doesn't re-run when `search` changes independently.

**Medium issues (1):**
- `app/professionals/page.tsx:62`, `app/professionals/[id]/page.tsx:65` — `profiles.email` queried from DB but never displayed — unnecessary PII exposure in API responses.

---

### 5. Portfolio System
**Status: BUILT / NEEDS LOW FIX** (mostly PRODUCTION READY)

**High issues (0):** None

**Low issues (4):**
- `app/api/portfolio/route.ts`, `app/api/portfolio/[id]/route.ts` — `sanitizeIframeHtml` duplicated verbatim across both files (should be extracted to shared lib)
- No server-side file size validation (client-side exists, but API could accept oversized files)
- `app/dashboard/professional/portfolio/page.tsx` — No image compression on upload; `buildSignedUrl` called per-item instead of batched
- `app/onboarding/professional/page.tsx:81` — `confirmPortfolioDelete` only checks `response.ok` — no error handling for non-ok responses

**Production-ready aspects:**
- Rate limited ✓
- CSRF protected ✓
- Iframe sanitization ✓

---

### 6. Messaging System
**Status: BUILT / NEEDS CRITICAL FIX + PARTIALLY NOT FULLY BUILT**

**Critical issues (1):**
- `app/messages/[contractId]/page.tsx:87` — `handleSend` does NOT check if the current user is authorized to send on this contract. Any authenticated user can send messages to any contract they have the ID for. This is a data access control vulnerability.

**Not fully built (3 missing features):**
- No notification sent to message recipient when a message is delivered
- No file/image sharing capability (critical for sharing plans, maps, survey data)
- No typing indicators or read receipts beyond marking messages read

**Low issues (1):**
- `contractId` cast `as string` without validation — could crash if `params.contractId` is undefined

---

### 7. Notification System
**Status: BUILT / LOW FIX** (mostly PRODUCTION READY)

**High issues (0):** None

**Low issues (2):**
- `components/notifications/NotificationBellDropdown.tsx:96` — Unread count computed from stale closure; optimistic mark-as-read doesn't update count until re-fetch
- `app/notifications/page.tsx:100` — `loadNotifications` called in two separate effects instead of consolidated

**Production-ready aspects:**
- API properly rate limited ✓
- Optimistic mark-as-read reverts on failure ✓
- DB query filters by `user_id` — no data leak ✓

---

### 8. Email System
**Status: BUILT / NEEDS CRITICAL FIX**

**Critical issues (2):**
- `lib/email/notify.ts:110` — `from: "SurveyConnectHub <notifications@resend.dev>"`. This is the Resend dev sandbox domain — **emails will not deliver to real recipients in production**. Must be changed to a verified custom domain.
- `app/api/notify/route.ts:117` — `/api/notify` endpoint is callable by ANY authenticated user with no ownership validation. User A can send a notification to any `recipientId` including User B's users. This is a privilege escalation / data manipulation vulnerability.

**Medium issues (1):**
- `lib/email/notify.ts:114` — No unsubscribe link in any email (potentially violating CAN-SPAM / Nigerian spam regulations)

**Low issues (3):**
- HTML templates are inline strings — no React Email / MJML; hard to maintain
- `sendNotificationEmail` creates a new `Resend` instance on every call
- No rate limiting on `/api/notify`

---

### 9. Dashboard System
**Status: BUILT / NEEDS HIGH FIX**

**Critical issues (0):** None

**High issues (5):**
- `app/dashboard/client/contracts/page.tsx:134` — `handleReleasePayment` optimistically updates `payment_released_at` in local state BEFORE checking API response. If the API call fails, the UI shows payment as released but it wasn't.
- `app/dashboard/professional/contracts/page.tsx:138` — `handleMarkComplete` sends notification BEFORE verifying the Supabase update succeeded. If the notification creation fails, the contract is still marked complete with no notification.
- `app/dashboard/client/contracts/page.tsx:139` — No rollback if notification creation fails after contract status change.
- `app/dashboard/client/page.tsx:125` — Real-time subscription created inside `useEffect` but cleanup is conditional (inside `if` block) — if `activeContracts` is empty, the component doesn't subscribe, but the cleanup function is returned from within the `if` block scope, creating a potential memory leak / stale subscription.
- `app/api/paystack/verify/route.ts` — Optimistic DB updates without transaction wrapping.

**Low issues (4):**
- `fetchUnread` and real-time subscription logic duplicated across both dashboards — should be shared hook
- `Number(contract.agreed_budget ?? 0)` shows "$0" instead of "—" for missing values
- `message.includes("success")` for styling — fragile string matching
- No pagination on professional applications page

**Not fully built:**
- No pagination on applications page

---

### 10. Admin System
**Status: BUILT / NEEDS HIGH FIX**

**Critical issues (0):** None

**High issues (2):**
- `app/api/admin/signed-url/route.ts:160` — Path traversal vulnerability in `storagePath` derivation. A malicious or crafted request could potentially access files outside the intended path prefix.
- `app/api/admin/signed-url/route.ts:161` — No error handling on admin profile query.

**Low issues (3):**
- `app/admin/AdminContent.tsx:155` — Verification email sent via `/api/notify` fetch (network hop) instead of calling `sendNotificationEmail` directly
- `app/admin/AdminContent.tsx:156` — License file deletion assumes `parts[1]` is always the storage path; fails on external URLs
- `app/admin/AdminContent.tsx:157` — No confirmation modal for reject action — one click permanently rejects with no undo

---

### 11. Profile & Settings System
**Status: BUILT / NEEDS HIGH FIX**

**Critical issues (0):** None

**High issues (1):**
- `app/profile/page.tsx:166` — `handleSave` resets `paystack_recipient_code` to `null` on every profile save (even when only changing name or phone). This forces the user to re-create their Paystack recipient on every transfer — effectively breaking payouts whenever a user updates any profile field.

**Low issues (2):**
- No phone number validation for Nigerian format (+234...)
- `app/settings/account/page.tsx:171` — Terms and Privacy links are `href="#"` placeholders

---

### 12. Onboarding System
**Status: BUILT / NEEDS HIGH FIX**

**Critical issues (0):** None

**High issues (1):**
- `app/onboarding/professional/page.tsx:179` — "Skip for now" link navigates to `/dashboard/professional`, but middleware will redirect back to onboarding if it's incomplete. This creates a redirect loop that traps the user and cannot be escaped without completing onboarding.

**Medium issues (1):**
- `app/onboarding/professional/page.tsx:177-178` — Step navigation is inconsistent: `handleContinue` saves the next step's data on Continue, but clicking Back calls `setStep(prev => prev - 1)` without saving current step data. Also, `confirmPortfolioDelete` doesn't check API response for errors.

**Low issues (1):**
- Profession dropdown shows raw `snake_case` keys instead of human-readable labels

---

### 13. Verification System
**Status: BUILT / NEEDS LOW FIX**

**Medium issues (1):**
- `app/verification/page.tsx:185` — No upload progress tracking or upload status indicator during file upload

**Low issues (2):**
- No retry mechanism on failed upload
- Admin notification via email uses hardcoded fetch URL (`/api/send-verification-email`)

---

### 14. CSRF & Rate Limiting
**Status: PRODUCTION READY**

- CSRF fail-closed (deny when no origins configured) ✓
- Rate limiting fail-open (allow when Redis is down) ✓
- Multiple allowed origins via `NEXT_PUBLIC_APP_URLS` ✓
- Env validation at module init ✓
- No issues identified

---

### 15. Database & Types
**Status: NOT FULLY BUILT**

**Not built (3):**
- `types/database.ts:204-209` — Missing TypeScript types for:
  - `messages` table (queries run against it but no interface)
  - `client_profiles` table (queried in client dashboard)
  - `reviews` relationship types

**High issues (from RLS):**
- `supabase/migrations/` — Broad UPDATE policies, missing INSERT WITH CHECK on `professional_profiles`, missing UPDATE handler for `applications_count` trigger (per `changes.text`)

---

### 16. Security: Cross-System Summary

| Severity | Count | Issue | System |
|---|---|---|---|
| **CRITICAL** | 1 | No authorization check on message send — any auth user can message any contract | Messaging |
| **CRITICAL** | 1 | `/api/notify` accessible by any auth user — no ownership validation | Email |
| **CRITICAL** | 1 | Exchange rate API free tier — will break in production under load | Payment |
| **CRITICAL** | 1 | Email sender domain is Resend dev sandbox — emails won't deliver | Email |
| **CRITICAL** | 1 | Amount persisted before Paystack init succeeds — dangling/inconsistent state | Payment |
| **HIGH** | 1 | PII logged in console (email) | Payment |
| **HIGH** | 1 | Fee disclosure mismatch (10% charged, 5% shown in UI) | Payment |
| **HIGH** | 1 | Path traversal in admin signed-url | Admin |
| **HIGH** | 1 | `paystack_recipient_code` nulled on every profile save | Profile |
| **HIGH** | 1 | Onboarding "Skip" creates redirect loop | Onboarding |

---

### 17. UX & Edge Case Issues (Cross-System)
All LOW priority — polish items

| Issue | Systems Affected |
|---|---|
| No loading spinners — just "Loading..." text | Multiple |
| No error boundaries — white screen on any crash | All client pages |
| No "page X of Y" — only prev/next buttons | Jobs, Professionals |
| Budget shows "$0" instead of "—" when undefined | Pro Contracts |
| Hardcoded "en-GB" locale in 10+ files | Multiple |
| Hardcoded Nigerian bank list as fallback | Profile |

### 18. Code Quality & Technical Debt (Cross-System)
All LOW priority — refactoring items

| Issue | Systems Affected |
|---|---|
| `sanitizeIframeHtml` duplicated in 2 files | Portfolio |
| Unread subscription logic duplicated in 2 dashboards | Dashboard |
| `getProfessionLabel` / `softwareToolOptions` duplicated in 5+ files | Multiple |
| Profession options list duplicated in 4+ files | Multiple |
| Inline types instead of importing from `types/database.ts` | Multiple |
| `CardSkeleton` index-based `key={index}` anti-pattern | Multiple |

---

## Summary Table

| # | System | Status | Priority |
|---|---|---|---|
| 1 | Authentication & Authorization | BUILT / NEEDS HIGH FIX | HIGH |
| 2 | Payment (Paystack) | BUILT / NEEDS CRITICAL FIX | CRITICAL |
| 3 | Job Listing | BUILT / NEEDS HIGH FIX | HIGH |
| 4 | Professionals Directory | BUILT / NEEDS HIGH FIX | HIGH |
| 5 | Portfolio | BUILT / NEEDS LOW FIX | LOW |
| 6 | Messaging | BUILT + NOT FULLY BUILT / NEEDS CRITICAL FIX | CRITICAL |
| 7 | Notification | BUILT / NEEDS LOW FIX | LOW |
| 8 | Email | BUILT / NEEDS CRITICAL FIX | CRITICAL |
| 9 | Dashboard | BUILT / NEEDS HIGH FIX | HIGH |
| 10 | Admin | BUILT / NEEDS HIGH FIX | HIGH |
| 11 | Profile & Settings | BUILT / NEEDS HIGH FIX | HIGH |
| 12 | Onboarding | BUILT / NEEDS HIGH FIX | HIGH |
| 13 | Verification | BUILT / NEEDS LOW FIX | LOW |
| 14 | CSRF & Rate Limiting | PRODUCTION READY | — |
| 15 | Database & Types | NOT FULLY BUILT | HIGH |
