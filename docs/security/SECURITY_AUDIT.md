# ProofLedger AI — Zero-Cost Security Hardening & Privacy Audit

**Audit Target:** ProofLedger AI (Enterprise Financial Reconciliation & Forensic Investigation Workspace)
**Repository:** `https://github.com/pavankumar9d-rgb/ProofLedger-AI`
**Production URL:** `https://proofledger-ai.onrender.com`
**Base Commit Examined:** `5208a2799783cc8482321556a9b56354923bd671`
**Audit Date:** October 21, 2026
**Auditor Mode:** Senior Application Security Engineer & DevSecOps Reviewer
**Budget Consumed:** ₹0.00 (Zero paid cloud resources, cards, or external credits)

---

## 1. Executive Summary & Assessment Scope

ProofLedger AI was audited across its full architectural attack surface: backend Express gateway (`server/index.ts`), Supabase PostgreSQL database migration & RLS definitions (`supabase/migrations/`), client state & session boundary management (`src/App.tsx`, `src/lib/supabase/`), CSV ingestion & export engines (`src/lib/csv/`, `src/lib/export/`), and build/bundling configurations (`vite.config.ts`, `package.json`).

The architecture demonstrates strong security-by-design foundations:
1. **Mathematical Isolation & Ingestion:** Core financial reconciliation, balance derivations, and 1-to-1 matching execute client-side using deterministic integer arithmetic (paise minor units), completely eliminating floating-point drift. Uploaded CSV statement rows are processed in browser memory and are **never uploaded to any server or remote service during normal ingestion**.
2. **Volatile Memory Execution (Zero Persistent Storage in Guest Mode):** In Guest Mode, financial records exist strictly in ephemeral browser memory. Zero raw statement rows or unredacted financial tokens are persisted to localStorage, IndexedDB, or server databases.
3. **Data Boundary for Guest Mode Investigations (Network Transfer vs. Persistent Storage):**
   - Core CSV ingestion and reconciliation entail **zero network transfer**.
   - When a user explicitly triggers an AI investigation on a discrepancy via `handleRunAIInvestigation`, a minimized exception payload **is transmitted over HTTPS to the hosted Express gateway (`/api/investigate`)**.
   - The gateway processes this payload entirely in volatile RAM with **zero database persistence**. However, network transfer to the host (Render/Cloudflare) is present for this specific opt-in feature.
   - PII regex masking (Aadhaar, PAN, Card, Account numbers) is applied before transmission and re-verified on the server. However, regex masking does not guarantee mathematical non-identifiability (unique amounts or transaction timings could theoretically be correlated).
   - While `ALLOW_LIVE_AI=false`, the server responds deterministically without contacting upstream inference APIs (**zero external AI inference**).
4. **Defense-in-Depth AI Gateway:** The server strictly rejects raw financial files, accepts only single-exception payloads conforming to strict Zod schemas with mandatory boolean consent (`consentGranted: z.literal(true)`), enforces sliding-window IP rate limiting, caps payloads at 32 KB, and independently re-sanitizes narration text on the server.
5. **Hardened RLS:** PostgreSQL forced row-level security (`alter table ... force row level security`) ensures that even table owners cannot bypass policy evaluation. Anonymous (`anon`) role access is completely revoked, and authenticated operations are strictly bound to `(select auth.uid()) = user_id`.

Four justified, zero-risk defensive hardenings were identified, implemented, and verified with dedicated regression tests.

---

## 2. Review of Required Security References & Tooling Feasibility

### A. Keygraph Shannon (`https://github.com/KeygraphHQ/shannon`)
- **Architecture & Workflow:** Autonomous white-box penetration testing tool combining static AST code analysis with dynamic exploit execution inside Docker containers.
- **Safety Guidance:** Official documentation explicitly states: *"Never point Shannon at production systems. Only run against locally hosted or isolated staging environments."*
- **Prerequisites & Cost:** Requires a running Docker engine, container orchestration, and external paid LLM provider API keys (OpenAI / Anthropic / Gemini) to power the autonomous reasoning loop.
- **Execution Status:** **NOT RUN**. In accordance with the ₹0 budget constraint, absence of local Docker daemon / local model runtime (Ollama/vLLM) in this execution environment, and prohibition against executing offensive agents against production, Shannon was not run.
- **Distinction from Manual Testing:** Manual threat modeling, architecture review, and unit/integration regression tests were conducted. However, manual checks are distinct from and do not constitute an automated or completed penetration test.

### B. UseStrix Strix (`https://github.com/usestrix/strix`)
- **Architecture & Workflow:** Autonomous AI penetration testing agent (`strix-agent`) that executes dynamic vulnerability checks using an isolated Docker container with HTTP proxies and terminal sandboxes.
- **Prerequisites & Cost:** Requires Docker daemon installation, containerized runtime permissions, and external paid LLM reasoning credits.
- **Execution Status:** **NOT RUN**. Excluded due to Docker prerequisites and external credit requirements. Manual code auditing and regression testing performed in this review are not equivalent to a completed penetration test.

---

## 3. Vulnerability Findings & Hardening Implemented

| ID | Title | Severity | OWASP / CWE | Status |
| :--- | :--- | :---: | :---: | :---: |
| **SEC-01** | Missing Defensive HTTP Security Headers & Express Fingerprinting | Medium | CWE-693 / OWASP A05 | **FIXED (Verified Locally)** |
| **SEC-02** | Reverse Proxy Trust Unconfigured for Rate Limiting | Medium | CWE-770 / OWASP A04 | **FIXED (Simulated Locally; Production UNVERIFIED)** |
| **SEC-03** | In-Memory Financial Data Retention Across Remote Session Expiration | Low | CWE-613 / OWASP A07 | **FIXED (Verified Locally)** |
| **SEC-04** | Missing Cache-Control Directives on Sensitive API Endpoints | Informational | CWE-525 / OWASP A05 | **FIXED (Verified Locally)** |
| **SEC-05** | Account Deletion Endpoint & Data Erasure Workflow | Medium | CWE-284 / OWASP A01 / GDPR Art 17 | **IMPLEMENTED (Verified Locally; Fail-Closed)** |
| **SEC-06** | Upstream AI Spending Reservation & Defect Fix | High | CWE-400 / CWE-770 / OWASP A04 | **FIXED (Verified Locally)** |

---

### Detailed Findings & Remediations

#### [SEC-01] Missing Defensive HTTP Security Headers & Express Fingerprinting
- **Severity:** Medium
- **Location:** `server/index.ts`
- **Root Cause:** Express by default emits the `X-Powered-By: Express` header, aiding attacker reconnaissance. Furthermore, no defensive headers (`X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`) were set on HTTP responses.
- **Remediation:**
  1. Disabled Express fingerprinting via `app.disable('x-powered-by')`.
  2. Implemented lightweight, dependency-free security headers middleware:
     - `X-Content-Type-Options: nosniff` (prevents MIME type confusion attacks).
     - `X-Frame-Options: DENY` (prevents UI clickjacking).
     - `Referrer-Policy: strict-origin-when-cross-origin` (prevents path leakage in outbound referrers).
     - `Permissions-Policy: camera=(), microphone=(), geolocation=()` (disables sensitive hardware APIs).
     - `X-XSS-Protection: 0` (modern standard disabling legacy buggy browser XSS auditors).
     - `Content-Security-Policy`: Restricts scripts, objects, connections (`connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.tokenfactory.nebius.com`), styles (`'self' 'unsafe-inline'`), images (`'self' data: https:`), and enforces `frame-ancestors 'none'`.
     - `Strict-Transport-Security: max-age=31536000; includeSubDomains` (enforced when in production).

#### [SEC-02] Reverse Proxy Trust & Rate Limiting Configuration
- **Severity:** Medium
- **Location:** `server/index.ts` (line 35, line 136)
- **Root Cause:** The sliding-window rate limiter resolves client IP via `req.ip || req.socket.remoteAddress`. When deployed behind Render, Express requires `trust proxy` configuration; otherwise, `req.ip` resolves to the immediate TCP socket (the reverse proxy's internal network IP). This causes all users to share a single rate-limiting bucket (DoS risk for legitimate users).
- **Remediation & Architectural Boundary:** Added `app.set('trust proxy', 1)` to trust a single reverse proxy hop.
  - **Browser Origin Restriction (CORS) vs. Authentication/Authorization:** CORS is strictly a browser-enforced origin restriction preventing unauthorized third-party web pages from reading responses or sending cross-origin credentials. **CORS does not authenticate callers or authorize requests.** Direct HTTP clients (like curl, automated bots, or backend integrations) do not send an Origin header and are not evaluated by CORS. Server endpoints enforce independent, layered security controls: rate limiting (15 req/min per IP), strict Zod payload validation (`InvestigationRequestSchema`), mandatory explicit user consent (`consentGranted: z.literal(true)`), server-side PII re-sanitization, provenance cross-checks against input rows, and live call budget exhaustion limits.
  - **Endpoint Access Model & Authentication Boundary for `/api/investigate`:** The `/api/investigate` endpoint is intentionally designed as an unauthenticated gateway endpoint for the application's zero-retention architecture. It enables Guest Mode users (who have no database account and store no data in Supabase) to utilize the reconciliation analysis engine. **The boolean consent field (`consentGranted: true`) is a privacy and telemetry consent gate, NOT a caller authentication mechanism.** Because the endpoint is publicly reachable, it does not trust caller data and enforces strict defense-in-depth:
    1. Origin check (`originValidator`) prevents unauthorized cross-origin web applications from utilizing the endpoint.
    2. Absent-origin requests do not bypass validation: they must still satisfy rate limiting, body size limits, and Zod schemas.
    3. Server-side `ALLOW_LIVE_AI` gate cannot be bypassed by client parameters: when `ALLOW_LIVE_AI=false` (or when `NEBIUS_API_KEY` is unset), the server unconditionally short-circuits to deterministic local analysis, returning `status: 'LOCAL_MODE'`.
    4. Payloads are capped at 32 KB, rejecting oversized requests with HTTP 413 `PAYLOAD_TOO_LARGE`.
  - **Prerequisites for Future Live AI Enablement:** Because `/api/investigate` is intentionally unauthenticated for Guest Mode, any future activation of live upstream inference (`ALLOW_LIVE_AI=true`) must not occur without a separate formal security review and operational hardening:
    1. *Abuse Controls & Sybil Mitigation:* Evaluate proof-of-work, turnstile, or authenticated quotas before allowing live token expenditure.
    2. *Strict Token & Concurrency Bounds:* Audit upstream max_tokens, concurrency throttling, and per-IP or per-session expenditure limits to prevent financial denial-of-wallet.
    3. *Fail-Closed Upstream Handling:* Verify that upstream model timeouts, errors, or malformed responses fail cleanly without leaking server stack traces, keys, or hanging node sockets.
  - **In-Memory Rate Limiter Limitations:** The rate limiter uses an in-memory sliding-window map (`ipRequestWindow`) limited to a single Node.js process. **Limitations:**
    1. *Process Restarts:* Server restarts or cold starts clear the in-memory window, resetting rate counts.
    2. *Multi-Instance Topology:* If Render scales horizontally across multiple worker instances, rate limits are tracked independently per instance rather than globally (unless backed by a shared Redis cluster, which was rejected under the ₹0 zero-dependency budget).
    3. *Guest Mode Compatibility:* This local in-memory design maintains zero latency and ₹0 cost without requiring external paid database services or compromising guest-mode privacy.
  - **Local Simulation:** In local Express test simulations with synthetic headers (`X-Forwarded-For: 198.51.100.1, 203.0.113.195`), Express with `trust proxy = 1` treats the last hop as the proxy and evaluates the preceding hop as the client IP.
  - **Production Reality:** **UNVERIFIED in Production**. The exact header manipulation behavior of Render's live edge proxy architecture has NOT been verified against live production traffic, because introducing a public debugging endpoint that echoes client IP or forwarding headers would itself present an information disclosure vulnerability. Rate limiting behavior behind Render remains a runtime assumption until verified via authorized operational logging.

#### [SEC-03] In-Memory Financial Data Retention Across Remote Session Expiration
- **Severity:** Low
- **Location:** `src/App.tsx` (`onAuthStateChange` listener)
- **Root Cause:** While manual user sign-out (`handleSignOut`) explicitly purged in-memory reconciliation rows and session state, the Supabase background `onAuthStateChange` listener only updated the `currentUser` state upon background `SIGNED_OUT` events or token revocations without wiping the loaded financial data arrays in memory.
- **Remediation:** Updated `onAuthStateChange` so that when `event === 'SIGNED_OUT'` or `session === null`, all in-memory financial data (`bankRows`, `ledgerRows`, `reconciliationResult`, `selectedItem`, `sessionName`, `isSynthetic`) is immediately wiped.

#### [SEC-04] Missing Cache-Control Directives on Sensitive API Endpoints
- **Severity:** Informational
- **Location:** `server/index.ts` (`/api/ai/status`, `/api/investigate`, and `/api/account/delete`)
- **Root Cause:** API responses did not explicitly instruct downstream proxies or shared browser caches not to store investigation results, budget configurations, or account operations.
- **Remediation:** Added `res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')` to `/api/ai/status`, `/api/investigate`, and `/api/account/delete`.

#### [SEC-05] Account Deletion Endpoint & Data Erasure Workflow
- **Severity:** Medium
- **Location:** `server/index.ts` (`POST /api/account/delete`), `src/lib/supabase/client.ts` (`deleteUserAccount`), `src/components/DeleteAccountModal.tsx`
- **Root Cause:** While users could manually clear session data or delete individual reconciliation entries, there was no auditable server-side account erasure workflow to support user-directed data deletion.
- **Remediation:**
  1. Implemented authenticated `POST /api/account/delete` endpoint in `server/index.ts`.
  2. Requires a valid user Bearer JWT token in the `Authorization` header. Server verifies caller identity against Supabase Auth (`supabaseAuth.auth.getUser(token)`).
  3. Fails closed with HTTP 503 `SERVICE_ROLE_UNCONFIGURED` if `SUPABASE_SERVICE_ROLE_KEY` is not configured on the server, avoiding partial or unconfirmed deletions.
  4. When configured, purges all user-owned reconciliation records (`reconciliation_history.delete().eq('user_id', user.id)`) using the service role client and deletes the auth identity (`auth.admin.deleteUser(user.id)`).
  5. Implemented rate limiting (15 requests / 15 minutes per IP) to prevent brute-force or abuse.
  6. Provided client-side modal requiring explicit typing of the confirmation phrase (`DELETE MY ACCOUNT`) before triggering the workflow, accompanied by automatic client session sign-out upon success.

#### [SEC-06] Upstream AI Spending Reservation & Defect Fix
- **Severity:** High
- **Location:** `server/index.ts` (`getMaxLiveCalls`, `liveCallsCount`, `POST /api/investigate`)
- **Root Cause:** In earlier iterations, `liveCallsCount` was incremented only after a complete, successful, schema-validated response from Nebius Token Factory. This created a denial-of-wallet / resource exhaustion loophole: failed upstream requests, 502 bad gateways, 504 timeouts, network aborts, malformed model JSON, and schema rejections never consumed the cap, permitting unbounded billable upstream dispatch attempts. Furthermore, `getMaxLiveCalls()` used naive `parseInt` without checking `NaN` or negative values, which could fail open and allow unlimited requests on malformed configuration.
- **Remediation:**
  1. **Upfront Slot Reservation:** Every attempted upstream AI request reserves one slot synchronously before `fetch(...)` begins.
  2. **Non-Refundable Failures:** Timeouts (504), network errors (500), upstream provider errors (502), and model schema rejections (422) permanently consume their reserved slot.
  3. **Zero Retries:** The server implements no automated retries that could generate duplicate billable requests.
  4. **Strict Concurrency Bound:** Synchronous slot reservation in the Node.js event loop ensures that simultaneous concurrent requests cannot exceed the process cap.
  5. **Fail-Closed Configuration:** `getMaxLiveCalls()` verifies `!Number.isNaN(parsed) && parsed >= 0`; invalid or negative configurations default to `0` (disallowing calls).
  6. **Safe Fallback:** Safe local deterministic fallback remains active whenever `ALLOW_LIVE_AI` is not `'true'` or `NEBIUS_API_KEY` is absent.

---

## 4. Secret-Scanning & Sensitive Data Audit

- **Dedicated Scanner Feasibility:** Dedicated external tools (`gitleaks`, `trufflehog`, `git-secrets`) are not installed in the local environment and were not installed (in compliance with strict no-unapproved-tools constraints).
- **Pattern-Based Repository & Git History Audit:**
  - Performed pattern-targeted Git history scans (`git log -p -G"(api_key|secret|password|bearer|authorization)"`) and client bundle searches.
  - Scanned for private JWT patterns (`eyJ...`), service-role strings, and private key headers (`-----BEGIN`).
  - **Findings:**
    - The client bundle contains the string literal `"service_role"` only inside a security rejection guard ([src/lib/supabase/client.ts#L42](../src/lib/supabase/client.ts#L42)) that actively terminates initialization if a secret key is mistakenly provided.
    - Git commit `f260cd1` added `.env.example` containing only dummy placeholders.
    - Git commit `9a580fa` added fallback support for Render public environment variables without committing any secrets.
  - **Confidence Boundary:** Pattern matching across Git commits and bundle outputs provides targeted confidence against known keyword conventions, but **does not constitute exhaustive secret scanning**. Comprehensive assurance requires running dedicated entropy-based scanners in CI/CD.

---

## 5. Verification Evidence & Quality Gates

All checks were executed locally without external spending:

1. **Vitest Unit & Integration Suite:**
   ```bash
   npm run test
   ```
   **Result:** 11 test suites passed, 155 tests passed (including HTTP security headers, cache controls, CORS matrix tests, upfront AI spending budget reservations, timeout/error slot consumption, concurrency caps, safe invalid configuration fallback, and account deletion partial failure workflows).
2. **TypeScript Strict Typecheck:**
   ```bash
   npm run typecheck
   ```
   **Result:** `tsc --noEmit` exited 0 with 0 errors.
3. **Oxlint Static Code Analysis:**
   ```bash
   npm run lint
   ```
   **Result:** 0 warnings, 0 errors across 53 files.
4. **Dependency Vulnerability Audit:**
   ```bash
   pnpm audit
   ```
   **Result:** `No known vulnerabilities found` across 383 packages.
5. **Production Build:**
   ```bash
   npm run build
   ```
   **Result:** Production bundle generated in ~5.2s without errors.

---

## 6. Manual Checks & External Action Checklist (UNVERIFIED)

The following items cannot be altered or proven autonomously from local code review and remain **UNVERIFIED** until inspected directly in cloud consoles:

- [ ] **Render Dashboard:** Confirm that `ALLOW_LIVE_AI` remains `false`, `NEBIUS_API_KEY` is not exposed, and no unreviewed environment variables exist.
- [ ] **Supabase Dashboard (RLS):** Verify in the Supabase Table Editor that Row Level Security is enabled and enforced for `reconciliation_history`, and that anonymous access has 0 permissions.
- [ ] **Google Cloud Console:** Verify OAuth 2.0 Client ID authorized redirect URIs match `https://proofledger-ai.onrender.com` and `https://<supabase-project>.supabase.co/auth/v1/callback`.
- [ ] **GitHub Repository:** Confirm branch protection rules on `main` and verify that GitHub secret scanning / push protection is active.

