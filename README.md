# ProofLedger AI — Reconciliation Investigation Workspace

<div align="center">
  <img src="public/assets/proofledger-wordmark.svg" alt="ProofLedger AI Logo" width="280" />
  <p><strong>Deterministic financial truth, AI-assisted investigation, human-controlled resolution.</strong></p>
  <p>
    <em>Built for the <strong>Best Apps & Agents</strong> track of the <strong>Nebius × NVIDIA Global AI Hackathon 2026</strong></em>
  </p>
  <p>
    <a href="#quickstart"><img src="https://img.shields.io/badge/Status-Built%20%26%20Tested-17845B" alt="Status" /></a>
    <a href="#test-results"><img src="https://img.shields.io/badge/Tests-80%2F80%20Passing-17845B" alt="Tests" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue" alt="License" /></a>
    <img src="https://img.shields.io/badge/Model-NVIDIA%20Nemotron%2070B-D7FF56?labelColor=101A2B" alt="Model" />
    <img src="https://img.shields.io/badge/Platform-Nebius%20Token%20Factory-101A2B" alt="Nebius" />
  </p>
</div>

---

## 1. Executive Summary & Product Thesis

Small-business finance operators face severe friction during month-end closes: comparing bank statement CSVs against accounting ledger CSVs, finding missing entries, unpresented cheques, duplicate transactions, and unexplained fee surcharges.

Generic AI chatbots fail because language models cannot do reliable arithmetic or guarantee row citations. Cloud accounting suites cost thousands per year and ingest unredacted client financial statements into third-party cloud databases—violating data sovereignty and customer privacy.

### The ProofLedger AI Solution:
> **"Deterministic financial truth, AI-assisted investigation, human-controlled resolution."**

ProofLedger AI separates mathematical calculation from natural language reasoning:
1. **Deterministic Financial Engine:** Runs 100% in-browser in pure TypeScript. Computes balances in decimal-safe integer minor units (paise for INR), runs 1-to-1 matching, enforces date clearance tolerances, detects duplicate candidates, and calculates variance. **The AI never touches calculations or confirms ledger matches.**
2. **Targeted AI Investigation Agent:** When a human operator encounters an ambiguous exception (e.g. an unexplained ₹240 payment gateway deduction or a 3-day timing lag), the operator can invoke the **NVIDIA Nemotron** agent via **Nebius Token Factory**. The system sends only a sanitized, anonymized 4-field packet—never raw CSVs or PII.
3. **Human-in-the-Loop Audit Trail:** The agent provides structured hypotheses citing only genuine source row IDs. The human operator explicitly approves, rejects, or defers the suggestion, generating a non-destructive audit log with CSV formula-injection protection (CWE-1236).

---

## 2. Key Architecture & Security Safeguards

```
[ BROWSER CLIENT (React 19 + TypeScript + Vite) ]
  ├── PapaParse In-Browser Parser (Raw CSVs never leave browser)
  ├── Decimal-Safe Minor Unit Math (Integer Paise - Zero Float Drift)
  ├── 1-to-1 Matcher & Ambiguity Guard (No row matched twice)
  ├── PII Redaction Filter (Account numbers, UPI IDs, Phones masked)
  └── Outbound Payload Preview (Explicit consent checkbox required)
            │
            │ HTTPS (Sanitized 4-Field Packet Only)
            ▼
[ PROOFLEDGER SERVER ADAPTER (Node.js + Express) ]
  ├── Rate Limiter (15 req/min) & Body Size Cap (32 KB DoS guard)
  ├── Secure Environment Isolation (NEBIUS_API_KEY in server memory only)
  ├── Zod Runtime Schema Validator & Citation Provenance Verifier
  └── Truthful Local Mode Fallback (Zero fake AI when unconfigured)
            │
            │ OpenAI-Compatible API (Bearer Token)
            ▼
[ NEBIUS TOKEN FACTORY (https://api.tokenfactory.nebius.com/v1/) ]
  └── NVIDIA Llama-3.1-Nemotron-70B-Instruct (Structured JSON Inference)
```

### Security & Privacy Protections
- **Zero Raw Uploads:** Raw bank and ledger CSV files are parsed entirely in the user's browser memory. Zero files are stored on any backend server or database.
- **Pre-Flight Redaction:** Account numbers (`\b\d{11,18}\b`), UPI handles (`user@bank`), and phone numbers are scrubbed with `[REDACTED]` tokens before prompt creation.
- **Citation Provenance Guard:** Every row ID cited by the AI is cross-referenced against active session records. Any hallucinated reference is immediately rejected.
- **Formula Injection Defense (CWE-1236):** All exported CSV cells starting with dangerous spreadsheet prefixes (`=`, `+`, `-`, `@`) have an apostrophe (`'`) prepended to neutralize executable macro injection in Excel. Legitimate negative numbers in numeric columns remain intact.

---

## 3. Quickstart & Local Installation

### Prerequisites
- Node.js `v20.x` or `v24.x` (Tested on Node.js v24.20.0)
- `pnpm` (Preferred), `npm`, or `yarn`

### 1. Clone & Install Dependencies
```powershell
git clone https://github.com/pavankumar9d-rgb/NVIDIA-HACKATHON.git
cd NVIDIA-HACKATHON
pnpm install
```

### 2. Configure Environment (Optional for Local Mode)
Copy `.env.example` to `.env`:
```powershell
cp .env.example .env
```
Default configuration runs in **Local Mode** with 100% deterministic matching active. To activate live cloud inference with NVIDIA Nemotron:
```env
NEBIUS_BASE_URL=https://api.tokenfactory.nebius.com/v1/
NEBIUS_API_KEY=your_nebius_api_key_here
NEBIUS_MODEL_ID=nvidia/Llama-3.1-Nemotron-70B-Instruct
ALLOW_LIVE_AI=true
APP_ALLOWED_ORIGIN=http://localhost:5173
PORT=3001
```

### 3. Run Development Servers
Open two terminal windows (or run concurrently):

**Terminal 1 — Backend Gateway:**
```powershell
pnpm run server
```
*Server runs on `http://localhost:3001`.*

**Terminal 2 — Frontend Application:**
```powershell
pnpm run dev
```
*Client opens on `http://localhost:5173`.*

---

## 4. Test Results & Quality Gates

The test suite contains **80 automated tests** across 7 test suites covering arithmetic precision, matching rules, Zod schemas, provenance guards, duplicate detection, export consistency, production static serving, SPA fallback routing, and formula injection escaping:

```powershell
pnpm test
```

### Actual Test Suite Output:
```
 RUN  v5.0.5 C:/Users/saipa/OneDrive/Desktop/nvidia hackathon

 ✓ tests/money.test.ts (13 tests)
 ✓ tests/reconciliation.test.ts (12 tests)
 ✓ tests/analytics.test.ts (2 tests)
 ✓ tests/privacy-security.test.ts (17 tests)
 ✓ tests/export-consistency.test.ts (7 tests)
 ✓ tests/ai-safety.test.ts (6 tests)
 ✓ tests/server-api.test.ts (23 tests)

 Test Files  7 passed (7)
      Tests  80 passed (80)
```

### Quality Linters & Production Build:
```powershell
pnpm run lint        # Oxlint: 0 warnings, 0 errors across 33 files
pnpm run typecheck   # tsc --noEmit: zero type errors
pnpm run build       # Vite build: production client bundle generated in ~6.5s
```

---

## 5. Production Deployment on Render (Free Plan)

ProofLedger AI is configured as a single full-stack Node.js web service. The Express backend serves the pre-built React/Vite frontend from `dist/`, routes all `/api/*` endpoints, guards against unmatched API requests (returns 404 JSON, not HTML), and falls back safely to `index.html` for client-side SPA routing.

Repository: `https://github.com/pavankumar9d-rgb/NVIDIA-HACKATHON.git`

### 5.1 Option A: Automatic Blueprint Deployment (`render.yaml`)
The repository includes a committed `render.yaml` Blueprint file:
1. Log in to [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** $\to$ **Blueprint**.
3. Connect repository `https://github.com/pavankumar9d-rgb/NVIDIA-HACKATHON.git` on branch `main`.
4. Render will detect `render.yaml` and configure the free Node web service automatically.
5. Click **Apply**.
6. After provisioning, copy your assigned Render service URL (e.g., `https://proofledger-ai.onrender.com`), go to **Environment**, set `APP_ALLOWED_ORIGIN` to this exact URL, and click **Save Changes**.

### 5.2 Option B: Manual Web Service Setup Checklist
If creating the service manually:
1. In Render Dashboard, click **New +** $\to$ **Web Service**.
2. Select **Build and deploy from a Git repository**.
3. Enter repository URL: `https://github.com/pavankumar9d-rgb/NVIDIA-HACKATHON.git`.
4. Configure service settings:
   - **Name:** `proofledger-ai`
   - **Region:** Any preferred region (e.g., Oregon, Frankfurt, Singapore)
   - **Branch:** `main`
   - **Root Directory:** Leave blank (root of repo)
   - **Runtime:** `Node`
   - **Build Command:** `corepack pnpm install --frozen-lockfile && corepack pnpm run build`
   - **Start Command:** `corepack pnpm run server`
   - **Instance Type:** `Free`
5. Open **Advanced** settings:
   - **Health Check Path:** `/api/health`
   - **Auto-Deploy:** `Yes`
6. Add Environment Variables:
   - `ALLOW_LIVE_AI` = `false` *(Strictly mandatory: keeps live model calls disabled on public demo)*
   - `APP_ALLOWED_ORIGIN` = `http://localhost:5173` *(Temporarily set, then updated to Render URL after first deploy)*
7. Click **Create Web Service**.
8. Once the build finishes and the service is live, copy your assigned HTTPS URL (e.g. `https://proofledger-ai.onrender.com`), edit `APP_ALLOWED_ORIGIN` in **Environment** to match this exact origin, and save.

### 5.3 Important Operational Disclosures
- **Free-Tier Sleep Cycle:** Render's free plan spins down web services after 15 minutes of inactivity. When visiting the site after an idle period, expect a ~30 to 50 second cold start delay while the instance wakes up.
- **Hackathon Live Model Requirement Disclosure:** In this deployed demo, live cloud inference calls to NVIDIA Nemotron on Nebius Token Factory remain **disabled** (`ALLOW_LIVE_AI=false`). Live inference requires a verified, funded `NEBIUS_API_KEY` and rate/budget controls to prevent token drainage. The live model integration is fully implemented and tested via mock suites, but pending developer key configuration.
- **Full Local Mode Functionality:** Even with live AI disabled, the application is 100% interactive and functional: loading synthetic client records, integer paise arithmetic, deterministic reconciliation, cash flow charts, evidence drawer, human triage decisions, audit trail recording, and formula-safe CSV/JSON/Markdown exports all function seamlessly in-browser.

---

## 6. Demonstration Walkthrough (Northstar Studio Scenario)

1. Open `http://localhost:5173` (or your deployed Render URL).
2. Notice the top bar: **"Northstar Studio — September Close"** synthetic dataset is loaded automatically.
3. The Executive Overview computes verified accounting positions:
   - **Opening Anchor:** ₹4,50,000.00
   - **Net Bank Period Movement:** +₹26,380.00 (Inflows: ₹1,61,630.00, Outflows: ₹1,35,250.00)
   - **Net Ledger Period Movement:** +₹10,950.00 (Inflows: ₹1,42,000.00, Outflows: ₹1,31,050.00)
   - **Closing Bank Position:** ₹4,76,380.00 (29 rows)
   - **Closing Ledger Position:** ₹4,60,950.00 (27 rows)
   - **Closing Variance (Bank - Ledger):** +₹15,430.00
   - **Confirmed Matches:** 25 pairs (50 rows matched / 56 active rows = 89.3%)
   - **Actionable Exceptions:** 5 items (6 rows: 1 amount mismatch, 1 duplicate candidate `ATM-00912`, 2 unmatched bank, 1 unmatched ledger)
   - **Reconciliation Bridge:** Reconciles the ₹15,430.00 closing variance to an exact ₹0.00 residual ledger variance.
4. Inspect pure SVG charts: Dual-series daily movement & volume composition.
5. Click on exception row **`EXP-AMT-BNK-013-LDG-012`** (Zenith Brand) or **`EXP-DUP-BNK-018`** (ATM Withdrawal duplicate candidate).
6. Inspect the sliding **Evidence Drawer**:
   - For Zenith Brand: Bank row shows ₹49,760.00 credited, Ledger row shows ₹50,000.00 invoiced, deterministic delta: -₹240.00.
   - For ATM-00912: Highlights identical amount ₹5,000.00 debited consecutively within clearance tolerance.
7. Click **"Investigate Exception"**.
8. Preview the sanitized JSON payload and check the consent box.
9. Click **"Proceed with Inference"** to receive the structured hypothesis (via live Nebius Nemotron-70B when configured, or transparent local deterministic rule in Local Mode).
10. Enter an auditor review note and click **Approve**, **Reject**, or **Defer**.
11. Click **"Export Pack"** to download the formula-safe CSVs, JSON audit log, and executive Markdown report.

---

## 7. Project Documentation Index

- [`docs/PRD.md`](docs/PRD.md) — Comprehensive Product Requirements Document & Acceptance Criteria.
- [`docs/DESIGN_SPEC.md`](docs/DESIGN_SPEC.md) — UI/UX Design System, Design Tokens & Information Architecture.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — Component Boundaries, Sequence Diagrams & Technical Architecture.
- [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md) — 15 Threat Scenarios, Mitigations, and Privacy Boundary.
- [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md) — Test Matrix, Acceptance Gates & Command Execution Evidence.
- [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) — Timestamped 2m 50s Video Walkthrough Script.
- [`docs/SUBMISSION_CHECKLIST.md`](docs/SUBMISSION_CHECKLIST.md) — Official Devpost Rules & Judging Criteria Compliance.
- [`docs/IMPLEMENTATION_REPORT.md`](docs/IMPLEMENTATION_REPORT.md) — Full Engineering & Implementation Status Report.
- [`docs/CODEX_REVIEW_PROMPT.md`](docs/CODEX_REVIEW_PROMPT.md) — Independent Read-Only Review Prompt for OpenAI Codex.

---

## 8. License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.