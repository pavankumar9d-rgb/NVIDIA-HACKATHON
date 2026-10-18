# Independent Codex Review Prompt — ProofLedger AI

> **Instructions for the Reviewer:**  
> Copy and paste this prompt to OpenAI Codex or an independent senior code reviewer to perform a read-only audit of the ProofLedger AI codebase. Do not make overlapping file edits during the review.

---

```markdown
You are an independent Principal Software Engineer, FinTech Security Auditor, and Application Architect conducting a strict, read-only code review of **ProofLedger AI**.

### Context
ProofLedger AI is a submission to the **Best Apps & Agents track of the Nebius × NVIDIA Global AI Hackathon 2026**.
Core thesis: *"Deterministic financial truth, AI-assisted investigation, human-controlled resolution."*
Stack: React 19 + TypeScript + Vite + Tailwind CSS v4 + Express server adapter + Vitest.

### Your Audit Objectives
Please review the repository in read-only mode and provide prioritized, evidence-backed findings with exact file paths and line numbers.

Specifically challenge and verify the following:

#### 1. Mathematical & Monetary Correctness (`src/lib/money/index.ts`)
- Does any monetary calculation rely on IEEE-754 binary floating-point numbers (`0.1 + 0.2`)?
- Are currency conversions or mixed currencies prevented from silently comparing?
- Are negative amounts, debits, credits, and parentheses parsed reliably into integer paise?

#### 2. Deterministic Matching & Row Consumption (`src/lib/reconciliation/index.ts`)
- Can a transaction row ever be consumed or matched twice?
- When multiple candidates compete for a transaction with equal or near-equal scores, does the engine greedily take one, or does it correctly flag them as an Ambiguous Tie?
- Does description similarity alone ever prove or force a match?

#### 3. Privacy, Redaction & Security Data Flow (`src/lib/privacy/index.ts`, `server/index.ts`)
- Does the client ever upload raw CSV files to the server?
- Are bank account numbers, UPI IDs, phone numbers, and emails scrubbed before creating the outbound payload?
- Is explicit user consent enforced before dispatching any request to `/api/investigate`?
- Can the server API key (`NEBIUS_API_KEY`) ever leak to the client browser in responses or bundles?
- Is CSV formula injection (CWE-1236) prevented on all exported files for cells beginning with `=`, `+`, `-`, or `@`?

#### 4. Nebius Token Factory & NVIDIA Nemotron Integration (`server/index.ts`, `src/features/investigation/schema.ts`)
- Does the server connect to the official OpenAI-compatible endpoint (`https://api.tokenfactory.nebius.com/v1/`)?
- Is the model ID configurable, defaulting to verified `nvidia/Llama-3.1-Nemotron-70B-Instruct`?
- Does runtime Zod schema validation reject malformed output or invalid enums?
- Does the provenance verifier catch and reject any hallucinated row IDs?
- In local mode (when `ALLOW_LIVE_AI=false` or no key is present), does the system truthfully state that local mode is active rather than pretending an AI inference took place?

#### 5. Code Quality & Test Coverage (`tests/`)
- Review the 29 automated tests across `tests/money.test.ts`, `tests/reconciliation.test.ts`, `tests/ai-safety.test.ts`, `tests/privacy-security.test.ts`, and `tests/server-api.test.ts`.
- Are there any critical edge cases or missing negative tests?
- Does the production build (`pnpm run build`) and typecheck pass without warnings?

### Format of Your Output
Please format your review into:
1. **Executive Verdict:** (APPROVED / APPROVED WITH COMMENTS / REJECTED)
2. **Critical Findings (P0):** Any security leaks, double-counting bugs, or mathematical flaws.
3. **Important Improvements (P1):** Robustness, edge cases, and performance.
4. **Minor Polish (P2):** Style, microcopy, and UI ergonomics.
5. **Hackathon Eligibility Assessment:** True technological alignment with the Best Apps & Agents track.
```
