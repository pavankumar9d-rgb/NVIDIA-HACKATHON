<div align="center">
  <img src="public/assets/proofledger-wordmark.svg" alt="ProofLedger AI Logo" width="360" />
  <p><strong>Deterministic Financial Reconciliation Desk & Audit Safeguard System</strong></p>

  <p>
    <a href="https://github.com/pavankumar9d-rgb/ProofLedger-AI/actions"><img src="https://img.shields.io/badge/Tests-155%20Passing-17845B?style=flat&labelColor=101A2B" alt="Tests" /></a>
    <img src="https://img.shields.io/badge/Arithmetic-Integer%20Paise-D7FF56?style=flat&labelColor=101A2B" alt="Math" />
    <img src="https://img.shields.io/badge/Privacy-Zero%20Raw%20Upload-101A2B?style=flat" alt="Privacy" />
    <img src="https://img.shields.io/badge/License-MIT-blue?style=flat&labelColor=101A2B" alt="License" />
  </p>
</div>

---

## 1. Product Overview & Problem Statement

Financial reconciliation is notoriously prone to human error, spreadsheet formula corruption, and IEEE 754 floating-point rounding discrepancies. Traditional bookkeeping software often suffers from:

- **Floating-point drift**: Binary float representations introduce tiny fractional rounding errors (e.g. `0.1 + 0.2 !== 0.3`) across large transaction volumes.
- **Unverified spreadsheet exports**: CSV files generated without formula injection escaping are vulnerable to CSV injection attacks (`=CMD|'...'!A0`).
- **Data privacy risks**: Uploading sensitive, unredacted corporate bank statements to third-party cloud AI vendors exposes PII and confidential financial details.

**ProofLedger AI** solves this through a client-side, integer-paise mathematical reconciliation desk with automated discrepancy analysis, formula-safe exports, and strict privacy boundaries.

---

## 2. Core Implemented Capabilities

### A. Deterministic Reconciliation Engine
- **Integer-Paise Precision**: All currency operations are calculated in discrete whole paise (1 INR = 100 paise), guaranteeing zero floating-point accumulation errors.
- **Multi-Tier Matching**:
  1. *Tier 1 (Exact Match)*: Exact transaction amount match and normalized reference match.
  2. *Tier 2 (Date-Tolerance Match)*: Exact amount match within a configurable date window (default: 3 days) with description similarity scoring.
  3. *Tier 3 (Reviewer Override)*: Manual review decision recording with audit notes.
- **Strict 1-to-1 Row Consumption**: Transaction records are never double-counted or consumed by multiple matches. Competing matches are flagged as ambiguous rather than greedily paired.
- **Mathematical Reconciliation Bridge**: Transparent, balanced bridge linking closing ledger balances to ending bank positions with zero delta variance.

### B. Client-Side Statement Ingestion & Privacy
- **Zero Raw File Upload**: Bank statements and general ledger CSVs are parsed and normalized 100% inside the browser session using Web Workers. Raw statements never leave the client device.
- **Automated Column Heuristics**: Detects dates, references, narrations, debit/credit flows, and opening balances automatically.
- **Guest Mode by Default**: Fully functional without requiring account creation, credit cards, or external cloud storage.

### C. Security & Audit Safeguards
- **Formula Injection Neutralization**: All exported CSV rows sanitize potentially executable spreadsheet prefixes (`=`, `+`, `-`, `@`, `\t`, `\r`) with single-quote escaping.
- **Defensive API Gateway**: Express gateway with strict Origin validation, 32 KB body size limits, in-memory rate limiting, and cache-control suppression (`no-store`) on sensitive endpoints.
- **GDPR Account & Data Deletion**: Full cascade deletion endpoint allowing authenticated users to purge both their reconciliation history and authentication credentials.

### D. Mobile-First Responsive Interface
- **Responsive Viewport Support**: Seamlessly transitions from mobile phones (320px–430px) to tablets and large desktop monitors.
- **Mobile Navigation**: Features a fixed, touch-friendly bottom navigation bar (`BottomNav`) with safe-area insets (`pb-safe`) and tactile Transaction Cards replacing cramped data tables.

---

## 3. Technology Stack & Architecture

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons
- **Backend API Gateway**: Node.js, Express 5, Tsx, Zod
- **Data Processing**: PapaParse, deterministic custom financial algorithms
- **Database / Auth (Optional)**: Supabase Auth & PostgreSQL (RLS-protected; optional for private multi-session history)
- **Quality Assurance**: Vitest, Testing Library, Oxlint

```
┌─────────────────────────────────────────────────────────────┐
│                 BROWSER CLIENT (REACT + TS)                 │
│  - Integer-paise math (0 float drift)                       │
│  - Client-side PapaParse normalization                     │
│  - Multi-tier 1-to-1 matching engine                        │
│  - Responsive Transaction Cards & Bottom Navigation         │
└──────────────────────────────┬──────────────────────────────┘
                               │ (Optional: Minimized Exception Payload)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 EXPRESS API GATEWAY SERVER                  │
│  - Strict Origin verification & DNS rebinding defense       │
│  - Cache-Control: no-store header enforcement               │
│  - In-memory rate limiting (10 req/min per IP)              │
│  - Server-side independent PII sanitization                 │
│  - Deterministic rule-based exception analysis              │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Current Limitations & Roadmap

- **Supported Formats**: Ingestion currently supports CSV format. PDF statement parsing and Excel XLSX native ingestion are planned for subsequent releases.
- **External AI Integration Status**: The server includes an optional client adapter for external LLM inference (`/api/investigate`), but it is permanently gated under `ALLOW_LIVE_AI=false` to enforce a strict ₹0 operating cost. The application honestly communicates `LOCAL_ONLY` status and executes deterministic rule-based classifications.
- **Multi-Instance Rate Limiting**: The in-memory rate limiter protects single server instances; distributed deployments require a Redis-backed token bucket.

---

## 5. Getting Started & Local Execution

### Prerequisites
- Node.js >= 20.x
- pnpm (recommended) or npm

### Installation
```bash
# Clone the repository
git clone https://github.com/pavankumar9d-rgb/ProofLedger-AI.git
cd ProofLedger-AI

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env
```

### Running Locally
```bash
# Start frontend dev server (port 5173)
pnpm run dev

# Start backend gateway server (port 3001)
pnpm run server
```

Open [http://localhost:5173](http://localhost:5173) in your browser. Click **"Load Demo Scenario"** on the welcome screen to test the reconciliation desk with 32 synthetic bank and ledger rows.

---

## 6. Verification & Quality Gates

Run the automated verification suite:

```bash
# Execute full unit & integration test suite (155 tests)
pnpm test

# Run TypeScript static type checking
pnpm run typecheck

# Run linter
pnpm run lint

# Build production client bundle
pnpm run build
```

---

## 7. Verified Live Demo & Deployment

- **Live Production URL**: [https://proofledger-ai.onrender.com](https://proofledger-ai.onrender.com)
- **Deployment Platform**: Render (Free Tier, Node.js Web Service)
- **Operational Status**: Runs in zero-cost Local Mode (`ALLOW_LIVE_AI=false`) with full client-side matching, synthetic demo loading, and audit exports active.

---

## 8. Project History & Competition Disclosure

ProofLedger AI is submitted for **LaunchPad Hacks (October 16 – November 20, 2026)**.

In adherence to competition rules and transparent engineering standards, the baseline core reconciliation logic existed prior to the hackathon. During the LaunchPad Hacks event period, the team designed and implemented the complete mobile-first responsive architecture, formula injection export safeguards, defensive Origin/CORS validation, and GDPR account deletion workflows.

For complete commit links, test evidence, and chronological breakdown, please review [LAUNCHPAD_CONTRIBUTIONS.md](docs/LAUNCHPAD_CONTRIBUTIONS.md).

---

## 9. License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
