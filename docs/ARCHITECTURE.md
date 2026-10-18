# System Architecture & Technical Specification — ProofLedger AI

**Product:** ProofLedger AI  
**Author:** Principal Product Engineer & AI Agent Architect  
**Track:** Best Apps & Agents — Nebius × NVIDIA Global AI Hackathon 2026  
**License:** MIT  

---

## 1. Architectural Philosophy

ProofLedger AI is built upon the foundational principle:
> **"Deterministic Financial Truth, AI-Assisted Investigation, Human-Controlled Resolution."**

To maintain absolute mathematical integrity and satisfy stringent enterprise data sovereignty:
1. **Client-Side Data Gravity:** The user's financial statements (Bank CSV and Accounting Ledger CSV) are parsed, validated, and normalized entirely inside the client browser. No raw financial data is ever transmitted to backend servers or third-party cloud services.
2. **Integer Minor-Unit Arithmetic:** All currency calculations (balances, debits, credits, variances) are computed in integer paise (INR minor units) or cents, completely eliminating IEEE-754 binary floating-point rounding errors.
3. **Isolated, Minimized AI Payload:** Nebius Token Factory (`nvidia/Llama-3.1-Nemotron-70B-Instruct`) is invoked **only** on demand for specific flagged exceptions, transmitting a sanitized, anonymized payload stripped of identifiable account numbers, phone numbers, and full names.
4. **Zod Runtime Schema & Provenance Guard:** Every AI response is validated at runtime using Zod. Any invented row IDs, hallucinated financial totals, or ungrounded claims are automatically caught, logged, and rejected.

---

## 2. High-Level Component Architecture

```mermaid
graph TD
    subgraph Browser ["Client Application (React 19 + TypeScript + Vite)"]
        UI["Investigation Workspace UI\n(Porcelain & Ink Art Direction)"]
        Parser["PapaParse In-Browser Engine\n(CSV Validation & Mapping)"]
        Money["Paise Minor-Unit Math Engine\n(Integer Precision)"]
        Engine["Deterministic Reconciliation Engine\n(1-to-1 Matcher, Date Tolerance, Duplicates)"]
        Store["Session State Manager\n(Transient In-Memory Store, No LocalStorage Leak)"]
        Sanitizer["PII & Narration Redaction Layer\n(Account, UPI, Phone, Name Redaction)"]
        Consent["Privacy Boundary & Consent Modal\n(Payload Preview)"]
        AuditExporter["Audit Pack Generator\n(Formula Injection Neutralized CSV/JSON/MD)"]

        UI --> Parser
        Parser --> Money
        Money --> Engine
        Engine --> Store
        Store --> UI
        UI --> Sanitizer
        Sanitizer --> Consent
        Consent --> AuditExporter
    end

    subgraph Backend ["ProofLedger Server Adapter (Node.js + Express)"]
        ServerAPI["REST Server (/api/investigate, /api/health)"]
        RateLimiter["Per-IP / Per-Session Rate Limiter & Body Cap"]
        EnvGuard["Secure Environment Config\n(NEBIUS_API_KEY in .env only)"]
        NebiusClient["Nebius Token Factory Adapter\n(OpenAI-Compatible Client)"]
        ResponseValidator["Zod Output Schema & Row Provenance Verifier"]

        ServerAPI --> RateLimiter
        RateLimiter --> EnvGuard
        EnvGuard --> NebiusClient
        NebiusClient --> ResponseValidator
    end

    subgraph External ["Nebius AI Cloud Infrastructure"]
        TokenFactory["Nebius Token Factory\n(https://api.tokenfactory.nebius.com/v1/)"]
        Nemotron["NVIDIA Nemotron 70B Instruct\n(nvidia/Llama-3.1-Nemotron-70B-Instruct)"]
        TokenFactory --> Nemotron
    end

    Consent -- "POST /api/investigate\n(Sanitized Minimal Packet Only)" --> ServerAPI
    NebiusClient -- "POST /v1/chat/completions\n(Bearer Token in Header)" --> TokenFactory
    TokenFactory -- "Structured JSON" --> NebiusClient
    ResponseValidator -- "Verified AI Hypothesis" --> UI
```

---

## 3. Data Flow & Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Operator as Finance Operator
    participant Browser as Browser Client (ProofLedger AI)
    participant Engine as Deterministic Math Engine
    participant Server as Server Adapter (Express)
    participant Nebius as Nebius Token Factory (NVIDIA Nemotron)

    Operator->>Browser: Load Synthetic Demo / Upload Bank & Ledger CSVs
    Browser->>Browser: Parse CSV locally via PapaParse
    Browser->>Engine: Normalize rows to CanonicalTransaction (Integer Paise)
    Engine->>Engine: Run 1-to-1 exact matching, date tolerance, duplicate checks
    Engine-->>Browser: Return ReconciledState (Matches, Unmatched, Duplicates, Variance)
    Browser->>Operator: Render triage dashboard & balance summary

    Operator->>Browser: Select Exception (e.g. EXP-003: Timing Lag / Surcharge)
    Browser->>Browser: Redact sensitive narration & account numbers
    Operator->>Browser: Click "Investigate with Nemotron"
    Browser->>Operator: Display Outbound Payload Preview Dialog
    Operator->>Browser: Explicit Consent Granted ("Proceed with Inference")

    Browser->>Server: POST /api/investigate (Sanitized Payload + Session Request ID)
    Server->>Server: Check rate limits, body cap, & ALLOW_LIVE_AI flag
    alt Live AI Configured & Enabled
        Server->>Nebius: POST /v1/chat/completions (model: nvidia/Llama-3.1-Nemotron-70B-Instruct)
        Nebius-->>Server: Return LLM response
        Server->>Server: Validate Zod schema & verify cited Row IDs exist in current session
        Server-->>Browser: 200 OK (Validated AI Hypothesis)
    else Local Mode (No Key / Key Disabled)
        Server-->>Browser: 200 OK (Status: LOCAL_MODE_ACTIVE, deterministic guidance only)
    end

    Browser->>Operator: Display Structured Findings in Evidence Trail
    Operator->>Browser: Click "Approve Hypothesis" or "Reject / Defer"
    Browser->>Browser: Record immutable human decision in Audit Log
    Operator->>Browser: Click "Export Audit Package"
    Browser->>Operator: Download CSVs (Formula-escaped), JSON, & Markdown summary
```

---

## 4. Key Subsystems & Implementation Details

### 4.1 Paise Decimal-Safe Money Math (`src/lib/money/`)
- Monetary amounts are parsed from raw CSV strings (`"₹12,450.50"`, `"-1,200"`, `"1200.00"`) into signed 64-bit safe integers representing **paise** (1 INR = 100 paise).
- Floating point operators (`+`, `-`, `*`, `/` on floats) are strictly forbidden in balance or matching calculations.
- Functions:
  - `parseToPaise(val: string): number`
  - `formatPaise(paise: number, currency = 'INR'): string`
  - `calculateVariancePaise(bankTotalPaise: number, ledgerTotalPaise: number): number`

### 4.2 Deterministic Matching Engine (`src/lib/reconciliation/`)
- Multi-tier matching pipeline:
  1. **Reference + Amount Exact Match:** Same normalized UTR/Ref and equal signed amount within $\pm 4$ days tolerance.
  2. **Amount + Close Date Match:** Equal signed amount with 0 or 1 day date difference and high token overlap in description.
  3. **Duplicate Detection:** Scans for multiple records in the same source sharing amount and date.
  4. **Ambiguity Prevention:** If multiple candidates tie for a bank record, none are automatically confirmed; all are routed to the Ambiguous queue.
  5. **1-to-1 Consumption:** A `Set<string>` tracks consumed row IDs, guaranteeing that no transaction is ever reconciled twice.

### 4.3 Redaction & Privacy Engine (`src/lib/privacy/`)
- Regular expressions strip or mask:
  - Bank Account Numbers (`\b\d{9,18}\b` $\to$ `[ACCT-REDACTED]`)
  - UPI IDs (`[\w.-]+@[\w.-]+` $\to$ `[UPI-REDACTED]`)
  - Phone Numbers (`\b(?:\+91|0)?[6-9]\d{9}\b` $\to$ `[PHONE-REDACTED]`)
  - Email Addresses (`[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}` $\to$ `[EMAIL-REDACTED]`)

### 4.4 Formula Injection Escaping (`src/lib/csv/export.ts`)
- Prevents CSV Injection / Formula Execution (CWE-1236) in Excel/LibreOffice.
- Any text cell beginning with `=`, `+`, `-`, or `@` has an apostrophe (`'`) prepended so spreadsheet software renders it as text rather than evaluating executable formulas. Valid negative numbers in numeric columns remain intact.

---

## 5. Deployment Architecture (Zero-Cost Free Tier)

| Component | Target Platform | Free Tier Guarantee | Notes |
| :--- | :--- | :--- | :--- |
| **Frontend UI** | Vercel / Cloudflare Pages / Local | 100% Free Tier | Static SPA bundle, fast global CDN |
| **Backend Adapter** | Node.js Express / Vercel Serverless Function | 100% Free Tier | Handles `/api/investigate` and `/api/health` |
| **Inference** | Nebius Token Factory | Hackathon Credits / API Key | Serverless endpoint, zero idle cost |
