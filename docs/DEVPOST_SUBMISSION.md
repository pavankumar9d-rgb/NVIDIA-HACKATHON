# Devpost Submission Package — ProofLedger AI

**Hackathon:** Nebius × NVIDIA Global AI Hackathon 2026  
**Track:** Best Apps & Agents  
**Project Name:** ProofLedger AI — Reconciliation Investigation Workspace  
**Tagline:** Deterministic financial truth, AI-assisted investigation, human-controlled resolution.  
**Public Demo URL:** https://proofledger-ai.onrender.com  
**GitHub Repository:** https://github.com/pavankumar9d-rgb/NVIDIA-HACKATHON  
**License:** MIT License  
**Video Walkthrough:** [YouTube Video Link — Under 3 Minutes]  

---

## 1. Project Overview & Inspiration

Small-business finance operators and startup founders face extreme stress during month-end closes. Comparing bank statement CSVs against accounting ledger CSVs is a repetitive, error-prone task fraught with timing clearance lags, unpresented vendor cheques, payment gateway fee deductions, and duplicate debits.

Existing software forces an unacceptable trade-off:
1. **Generic AI Chatbots:** Fail catastrophically because Large Language Models cannot perform guaranteed decimal arithmetic or maintain strict citation provenance.
2. **Cloud Accounting Monopolies:** Cost thousands of dollars per year and force businesses to upload confidential customer financial statements to proprietary cloud databases—violating data sovereignty and customer privacy.

### Our Solution
**ProofLedger AI** splits calculation from natural language reasoning:
- **Deterministic Math Engine:** Pure TypeScript in-browser engine operating in decimal-safe integer minor units (paise for INR). 1-to-1 matching, date tolerance evaluation, duplicate candidate detection, and reconciliation bridge calculation run 100% locally. The AI never touches calculations or confirms matches.
- **Targeted AI Investigation Agent:** When a human operator encounters an ambiguous exception (e.g. an unrecorded ₹240 payment gateway deduction), the operator can invoke **NVIDIA Nemotron 70B** via **Nebius Token Factory**. Only a sanitized, anonymized 4-field packet is sent—never raw CSVs or PII.
- **Human-in-the-Loop Governance:** The model returns structured hypotheses citing only genuine source row IDs. The human operator approves, rejects, or defers the suggestion, generating an audit log with CSV formula-injection protection (CWE-1236).

---

## 2. What It Does

1. **Dual CSV In-Browser Ingestion:** Parses bank statement CSVs and general ledger CSVs entirely in client browser memory via PapaParse. Supports single signed amounts or dual debit/credit layouts, multiple date formats (ISO, DD/MM/YYYY, MM/DD/YYYY, DD-Mon-YYYY), and automatic column mapping.
2. **Deterministic 1-to-1 Matching Engine:** Matches identical references and amounts across clearance windows, detects timing lags, flags suspected duplicate debits, and computes exact variances with zero IEEE-754 floating-point drift.
3. **Forensic Evidence Drawer:** A sliding desktop drawer visualizing the chain of evidence: bank record vs. ledger record, exact monetary delta, clearance days, and match signals.
4. **Outbound Privacy Boundary & Consent Gate:** Pre-flight redaction automatically scrubs account numbers, UPI handles, PAN card IDs, Aadhaar numbers, and phone numbers. Operators inspect the raw outbound JSON before granting explicit consent.
5. **NVIDIA Nemotron Investigation Agent:** Queries `nvidia/Llama-3.1-Nemotron-70B-Instruct` on Nebius Token Factory with strict Zod schema validation, provenance verification (hallucinated row IDs are rejected), and low-temperature JSON output.
6. **Zero-Durable-Storage Guest Mode:** Guests can run full reconciliations locally with zero financial records written to `localStorage`, `IndexedDB`, or cloud databases. In-memory records are wiped cleanly on session reset or exit.
7. **Optional Encrypted Cloud History:** Authenticated users (via Google OAuth) can securely persist sanitized audit snapshots to private PostgreSQL tables protected by Supabase Row Level Security (`auth.uid() = user_id`).
8. **Statutory Audit Package Export:** Generates downloadable CSV exports (with UTF-8 BOM and CWE-1236 spreadsheet formula neutralization), machine-readable JSON audit logs, and executive Markdown reconciliation reports.

---

## 3. How We Built It

- **Frontend Architecture:** React 19, TypeScript, Tailwind CSS, Lucide Icons, Vite, pure SVG dynamic visualization charts (zero bloated chart libraries).
- **In-Browser Financial Engine:** PapaParse, integer minor unit arithmetic (`src/lib/money/`), 1-to-1 consumption tracker (`src/lib/reconciliation/`), PII sanitizer regex filters (`src/lib/privacy/`).
- **Server Gateway & Security Adapter:** Express on Node.js, strict CORS origin validator (rejects wildcards), sliding-window rate limiter (15 req/min per IP), 32 KB request body cap, Zod runtime schema validation, citation provenance verification.
- **Cloud AI Platform:** Nebius Token Factory (`https://api.tokenfactory.nebius.com/v1/`), querying `nvidia/Llama-3.1-Nemotron-70B-Instruct` with OpenAI-compatible chat completions API.
- **Database & Cloud Storage:** Supabase PostgreSQL with strict Row Level Security (RLS) policies enforcing multi-tenant user isolation.
- **Hosting & Infrastructure:** Deployed on Render as a unified full-stack Node service with automated health check gateways (`/api/health`) and SPA fallback routing.

---

## 4. Track Selection: Best Apps & Agents

ProofLedger AI was engineered specifically for the **Best Apps & Agents** track:
- **Practical Utility:** Solves an acute, universal small-business problem: closing books without financial panic or manual spreadsheets.
- **Autonomous Agentic Workflow:** Extracts structured telemetry from deterministic reconciliation, constructs a minimal context prompt, queries the high-reasoning NVIDIA Nemotron model, verifies evidence provenance against active records, and proposes verified accounting journal entries.
- **Guardrails & Safety:** Enforces strict provenance gates—if the AI cites a row ID that does not exist in the active exception evidence, the gateway rejects the response.

---

## 5. Challenges We Ran Into

1. **Floating-Point Drift in Accounting:** Standard JavaScript `Number` types drift (e.g. `0.1 + 0.2 = 0.30000000000000004`). We eliminated this by converting all monetary values into integer paise at input boundaries and doing all arithmetic in integer math.
2. **LLM Hallucinations in Financial Contexts:** LLMs frequently invent transaction IDs or try to recompute balances incorrectly. We solved this with a strict architectural boundary: the model is prohibited from calculating totals and can only cite row IDs validated by our server-side provenance checker.
3. **Data Sovereignty in Guest Mode:** Proving to users that their financial records are not saved required engineering zero durable storage in Guest Mode: zero keys written to `localStorage` or `IndexedDB`, with memory wiped on sign-out/reset.
4. **Token Factory Onboarding Hurdles:** In Nebius Token Factory, users without an international credit card face an onboarding block even when possessing promotional codes. We designed ProofLedger AI with a truthful local fallback mode: when `ALLOW_LIVE_AI=false` or keys are absent, the application remains 100% interactive and functional using local deterministic rules.

---

## 6. Significant Changes Made During the Hackathon

- Designed and built the complete deterministic reconciliation engine with 1-to-1 set consumption and duplicate candidate detection.
- Integrated Nebius Token Factory OpenAI-compatible gateway with `nvidia/Llama-3.1-Nemotron-70B-Instruct`.
- Built PII redaction engine for bank accounts, UPI handles, PAN IDs, and phone numbers.
- Implemented CWE-1236 spreadsheet formula injection defense on all CSV exports.
- Engineered post-preloader Welcome Screen separating Guest Mode from authenticated cloud history.
- Enforced Guest Mode zero-durable-storage invariants with automated test verification.
- Integrated Supabase PostgreSQL with Row Level Security for private encrypted history snapshots.
- Expanded the automated test suite from 0 to **141 passing tests** across 11 test suites.
- Deployed live production service on Render with automated health checks.

---

## 7. Tool Feedback: Nebius Token Factory & NVIDIA

### Nebius Token Factory
- **What Worked Well:** The OpenAI-compatible API endpoint (`/v1/chat/completions`) makes drop-in integration straightforward. Latency on Nemotron 70B inference is competitive, and JSON mode (`response_format: { type: "json_object" }`) produces clean structured outputs.
- **Areas for Improvement:** 
  1. *Billing Dropdown Onboarding Loop:* Many international hackathon participants whose countries are omitted from the billing country dropdown get locked into a payment details page, even when they have promo codes. Providing a self-service voucher redemption flow that bypasses the credit card requirement for hackathon builders would drastically improve onboarding.
  2. *Granular Usage Analytics:* Providing per-key token budget caps in the console would help builders safely expose demo endpoints without fear of token exhaustion.

### NVIDIA Nemotron 70B (`nvidia/Llama-3.1-Nemotron-70B-Instruct`)
- **What Worked Well:** Exceptionally strong reasoning on complex financial narrations, payment gateway fees, and timing differences. It reliably adheres to structured JSON schemas and follows system prompts with precision.
- **Areas for Improvement:** Occasionally requires explicit reminders in the prompt not to invent external identifiers. Our provenance verification layer caught and neutralized these attempts.

---

## 8. Built With

`nvidia-nemotron` `nebius-token-factory` `typescript` `react-19` `vite` `tailwind-css` `express` `zod` `papaparse` `supabase` `postgresql` `vitest` `render`

