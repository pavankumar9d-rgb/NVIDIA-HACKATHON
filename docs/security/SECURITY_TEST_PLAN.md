# ProofLedger AI — Security & Privacy Test Plan

This document outlines non-destructive, repeatable local security tests for developers, security reviewers, and DevSecOps pipelines. All tests run locally using the included Vitest and Node.js testing harnesses with zero cloud spending.

---

## 1. Quick Test Execution (All Automated Gates)

Run the entire automated verification suite in sequence:

```bash
# 1. Run all 155 unit and security integration tests
npm run test

# 2. Strict static TypeScript typecheck
npm run typecheck

# 3. Static code analysis and linting
npm run lint

# 4. Dependency security audit
pnpm audit

# 5. Production bundle build
npm run build
```

---

## 2. Test Suite 1: Guest Mode Isolation & Volatile Storage Verification

**Objective:** Verify that Guest Mode financial data is strictly confined to volatile application memory, never written to durable browser storage or the cloud, and understand its explicit network transfer boundaries.

**Execution:**
```bash
npx vitest run tests/history-privacy.test.ts
```

**Verified Test Cases & Privacy Invariants:**
1. `verifies that Guest Mode saves zero financial data to localStorage or indexedDB`:
   - Inspects `localStorage` and `indexedDB`; asserts no financial keys (`bank`, `ledger`, `transaction`, `snapshot`) exist.
2. `strictly confines guest session flag to non-sensitive boolean in sessionStorage`:
   - Asserts `proofledger_guest_mode` is a boolean flag with zero financial data.
3. `fails gracefully when attempting DB operations without configuration`:
   - Asserts that unauthenticated or unconfigured calls to `saveReconciliationToHistory()` return an explicit rejection error and save nothing.
4. **Network vs. Storage Boundary:**
   - *Zero Persistent Storage:* Guest session rows are held strictly in React component state (RAM) and wiped on sign-out or session end.
   - *Zero Ingestion Network Transfer:* Core CSV reconciliation is 100% client-side; raw CSVs never touch the network.
   - *Opt-In AI Investigation Network Transfer:* Triggering AI investigation transmits a single sanitized exception payload to `/api/investigate`. The server evaluates this in RAM without database persistence. With `ALLOW_LIVE_AI=false`, zero external inference calls are made.

---

## 3. Test Suite 2: Supabase PostgreSQL RLS & Keyset Privacy

**Objective:** Verify that database row-level security constraints prevent cross-tenant data access, IDOR attacks, and ownership spoofing.

**Execution:**
```bash
npx vitest run tests/auth-ui.test.tsx
```

**Manual SQL Policy Verification (for Supabase Local / Staging):**
```sql
-- 1. Verify RLS is enabled and forced
select relname, relrowsecurity, relforcerowsecurity 
from pg_class 
where relname = 'reconciliation_history';
-- Expected: relrowsecurity = true, relforcerowsecurity = true

-- 2. Verify anonymous users have zero permissions
select grantee, privilege_type 
from information_schema.role_table_grants 
where table_name = 'reconciliation_history' and grantee = 'anon';
-- Expected: 0 rows returned

-- 3. Verify user ownership policy definition
select policyname, cmd, qual, with_check 
from pg_policies 
where tablename = 'reconciliation_history';
-- Expected:
-- reconciliation_history_select_own: (auth.uid() = user_id)
-- reconciliation_history_insert_own: (auth.uid() = user_id)
-- reconciliation_history_update_own: (auth.uid() = user_id)
-- reconciliation_history_delete_own: (auth.uid() = user_id)
```

---

## 4. Test Suite 3: Server API Gateway, Schema Validation & Consent Enforcement

**Objective:** Verify that the backend Express gateway rejects unauthorized origins, enforces request body size limits, mandates user consent, sanitizes narration, and emits defensive HTTP security headers.

**Execution:**
```bash
npx vitest run tests/server-api.test.ts
```

**Key Verified Assertions:**
1. `enforces defensive HTTP security headers on all responses and disables X-Powered-By`:
   - `X-Content-Type-Options` is `nosniff`.
   - `X-Frame-Options` is `DENY`.
   - `Referrer-Policy` is `strict-origin-when-cross-origin`.
   - `X-XSS-Protection` is `0`.
   - `Permissions-Policy` disables camera, microphone, geolocation.
   - `Content-Security-Policy` limits script/style/frame/connect sources.
   - `x-powered-by` is omitted.
2. `enforces Cache-Control: no-store on sensitive /api/ai/status and /api/investigate endpoints`:
   - Verifies downstream proxy and browser cache suppression.
3. `CORS Origin Matrix: verifies allowed origins, blocked origins, and production rejection of localhost`:
   - Production mode accepts only exact configured origins and rejects localhost origins and third-party attackers.
   - Development mode permits localhost loopbacks.
   - Absent Origin headers (direct non-browser HTTP clients) do not emit CORS response headers; `null` (sandboxed iframe / opaque origins) and empty string origins are strictly rejected.
   - Clarifies that CORS does not authenticate clients: direct non-browser requests without an Origin header remain bound by rate limiting, Zod schema validation, and consent checks.
4. `Proxy Trust Note`:
   - `app.set('trust proxy', 1)` is configured in Express. Local simulations confirm Express evaluates single reverse proxy hops as intended; production header forwarding across Render's actual edge network remains an operational assumption until verified via server telemetry. No public endpoint is added to reflect client IP or headers.
   - `Content-Security-Policy` restricts script-src and connect-src.
   - `X-Powered-By` header is completely omitted.
2. `enforces Cache-Control: no-store on sensitive /api/ai/status and /api/investigate endpoints`:
   - Asserts responses contain `no-store, no-cache, must-revalidate`.
3. `POST /api/investigate rejects requests missing explicit user consent with 400`:
   - Asserts payload with `consentGranted: false` is rejected with HTTP 400 `INVALID_PAYLOAD`.
4. `POST /api/investigate rejects request with unpermitted extra properties`:
   - Asserts extra unknown keys trigger strict Zod rejection.
5. `POST /api/investigate returns truthful LOCAL_MODE when live AI is disabled`:
   - Asserts server never simulates live inference when `ALLOW_LIVE_AI=false`.
6. `POST /api/investigate rate limiter enforces 15 requests per minute per IP`:
   - Asserts 16th request receives HTTP 429 `RATE_LIMIT_EXCEEDED`.
7. `POST /api/account/delete enforces authentication, authorization & fail-closed behavior`:
   - Missing or malformed `Authorization: Bearer <token>` returns HTTP 401 `UNAUTHORIZED`.
   - Missing `SUPABASE_SERVICE_ROLE_KEY` fails closed with HTTP 503 `SERVICE_ROLE_UNCONFIGURED`.
   - Valid caller with configured service role deletes user records from `reconciliation_history` and purges auth identity via `auth.admin.deleteUser`.
   - Enforces `Cache-Control: no-store` and dedicated IP rate limiting.
8. `POST /api/investigate spending budget upfront reservation & non-refundable slots`:
   - Failed upstream attempts (502), timeouts (504), and malformed model outputs (422) consume budget slots upfront; subsequent requests are rejected with 429 `LIVE_BUDGET_EXHAUSTED`.
   - Concurrent requests are bounded and cannot exceed the configured process budget.
   - Non-numeric or negative budget configurations fail safely by rejecting live calls (HTTP 429) rather than permitting unlimited requests.
9. `POST /api/account/delete handles partial failure gracefully`:
   - If reconciliation records are purged but administrative user identity deletion fails, returns HTTP 502 `ADMIN_DELETE_FAILED` with an actionable error.

---

## 5. Test Suite 4: CSV Ingestion, Formula Injection (CWE-1236) & Export Safety

**Objective:** Verify that CSV imports sanitize formula characters and prevent spreadsheet formula injection vulnerabilities upon export.

**Execution:**
```bash
npx vitest run tests/csv-import.test.ts tests/export-consistency.test.ts
```

**Key Verified Assertions:**
1. `sanitizeCellForCSV prepends apostrophe to dangerous prefixes`:
   - Cells beginning with `=`, `+`, `-`, `@`, `\t`, `\r`, `|`, `%` are escaped with a leading apostrophe (`'`).
2. `sanitizeCellForCSV preserves legitimate signed numbers in numeric columns`:
   - Legitimate negative balances (`-500.00`) in numeric columns are not distorted.
3. `parseDeterministicDate rejects invalid calendar dates`:
   - Leap year validation correctly accepts `2024-02-29` and rejects non-leap `2025-02-29`.
4. `generateMarkdownReport preserves truthful model attribution`:
   - Explicitly records `LOCAL_MODE` when local rules execute.

---

## 6. Test Suite 5: Secrets Hygiene & Repository Audit

**Objective:** Verify that no private credentials, OAuth secrets, or service-role keys enter version control.

**Execution Script:**
```bash
# Verify no service-role or secret key patterns in git history
python -c "
import subprocess
for pattern in ['service_role', 'sb_secret_', 'ghp_', 'AKIA']:
    res = subprocess.run(['git', 'log', '-S', pattern, '--oneline'], capture_output=True, text=True)
    commits = res.stdout.strip().splitlines() if res.stdout.strip() else []
    print(f'Pattern {pattern}: {len(commits)} commits')
"
```

**Assertion:** Zero live secret keys appear in any tracked commit or file.

