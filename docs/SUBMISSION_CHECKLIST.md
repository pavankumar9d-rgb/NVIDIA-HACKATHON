# Submission Checklist & Rule Compliance — ProofLedger AI

**Hackathon:** Nebius × NVIDIA Global AI Hackathon 2026  
**Track:** Best Apps & Agents  
**Target Deadline:** October 30, 2026 at 10:00 AM PDT (10:30 PM IST)  
**Status Audit Date:** October 18, 2026  

---

## 1. Official Eligibility & Baseline Rules Audit

| Rule / Requirement | Official Devpost Specification | ProofLedger AI Compliance Status | Verifiable Evidence |
| :--- | :--- | :--- | :--- |
| **Compute / Platform Requirement** | Must use Nebius Token Factory or Nebius AI Cloud compute. | **COMPLIANT** | Server gateway in `server/index.ts` connects to `https://api.tokenfactory.nebius.com/v1/` OpenAI-compatible endpoint. |
| **Model Requirement** | Must use at least one NVIDIA open-source model. | **COMPLIANT** | Configured for verified available open model: `nvidia/Llama-3.1-Nemotron-70B-Instruct`. |
| **Track Alignment** | Best Apps & Agents: real-world utility, agents/copilots, autonomous workflows. | **COMPLIANT** | Multi-stage agent: deterministic telemetry extraction $\to$ context reduction $\to$ explicit consent gate $\to$ Nemotron inference $\to$ Zod provenance check $\to$ human sign-off $\to$ audit export. |
| **Working Software** | Working application, not a static mockup or non-interactive page. | **VERIFIED** | Full interactive SPA with real PapaParse CSV parser, integer paise engine, 1-to-1 matcher, evidence inspector, and audit pack generation. |
| **Open Source License** | Public repository with visible open-source license. | **COMPLIANT** | Public repository at `https://github.com/pavankumar9d-rgb/NVIDIA-HACKATHON.git` with MIT License committed in `LICENSE` file. |
| **Documentation & README** | Clear setup instructions, architecture, threat model, testing. | **COMPLIANT** | Comprehensive `README.md`, `docs/PRD.md`, `docs/DESIGN_SPEC.md`, `docs/ARCHITECTURE.md`, `docs/THREAT_MODEL.md`, `docs/TEST_PLAN.md`. |
| **Video Demonstration** | Public demonstration video under 3 minutes. | **READY FOR RECORDING** | Complete timestamped script (2m 50s) in `docs/DEMO_SCRIPT.md`. |
| **₹0 Budget / No Paid Resources** | Zero expenditure on APIs, paid tools, or credit card subscriptions. | **COMPLIANT** | Uses genuinely free local stack (React, Vite, Express, Vitest). Nebius Token Factory uses hackathon provided serverless credits/keys. |

---

## 2. Four Official Judging Criteria Evaluation

### 2.1 Technological Implementation (25%)
- **Deterministic Math Engine:** Pure integer paise arithmetic eliminates floating-point rounding errors.
- **1-to-1 Consumption Guarantees:** Mathematical set-tracking guarantees no transaction is matched twice.
- **Zod Runtime Schema & Provenance Checker:** AI cannot hallucinate row IDs or modify computed totals.
- **Security-by-Design:** Client-side CSV parsing, pre-flight PII redaction, 32 KB body limits, and CSV formula injection prevention.
- **Score Target:** Top Quartile (5/5).

### 2.2 Design & User Experience (25%)
- **Bespoke Art Direction:** Light-first porcelain canvas (`#F6F7F2`), deep navy rail (`#101A2B`), electric chartreuse accents (`#D7FF56`), semantic emerald/vermilion status pills.
- **Signature Evidence Trail:** Visual forensic connector linking bank record, ledger record, computed deltas, AI hypothesis, and human sign-off.
- **Outbound Privacy Payload Preview:** High-transparency modal displaying redacted data before user consent.
- **Score Target:** Top Quartile (5/5).

### 2.3 Potential Impact (25%)
- **High Friction Financial Problem:** Solves the universal pain of monthly reconciliation for small businesses, startups, and creative agencies.
- **Data Sovereignty:** Enables privacy-sensitive businesses to adopt AI assistance without uploading confidential bank statements to cloud databases.
- **Score Target:** Top Quartile (5/5).

### 2.4 Quality of the Idea (25%)
- **Thesis:** *"Deterministic financial truth, AI-assisted investigation, human-controlled resolution."*
- **Rejection of "AI Accounting" Myth:** Understands that LLMs should never calculate ledger balances; instead uses NVIDIA Nemotron strictly where natural language reasoning adds value.
- **Score Target:** Top Quartile (5/5).

---

## 3. Truthful Runtime Status Disclosure
- **Deterministic Reconciliation Engine:** Fully implemented, verified, and passes 111 of 111 automated tests across 8 test suites.
- **Nebius Token Factory Adapter:** Fully implemented and configured in `server/index.ts` with model `nvidia/Llama-3.1-Nemotron-70B-Instruct`.
- **Live Cloud Inference State:** Currently running in **Local Mode** with live inference switch `ALLOW_LIVE_AI=false` because a funded `NEBIUS_API_KEY` has not yet been supplied. All deterministic rules, redactions, schemas, and UI fallbacks function cleanly.
- **Eligibility Verdict:** **PASS ON ARCHITECTURE, CODE & DEMO; LIVE API INFERENCE PENDING USER KEY CONFIGURATION.**
