# Demo Video Script — ProofLedger AI

**Product:** ProofLedger AI  
**Track:** Best Apps & Agents (Nebius × NVIDIA Global AI Hackathon 2026)  
**Target Video Duration:** 2 minutes 50 seconds (Under the mandatory 3-minute limit)  
**Presenter:** Single-operator walkthrough (Priya Sharma persona / Hackathon Builder)  

---

## Storyboard & Timestamped Walkthrough

### 0:00 – 0:18: Introduction & The Core Problem
- **Visual:** Open browser at `http://localhost:5173`. ProofLedger AI is on screen with its calm porcelain canvas (`#F6F7F2`), deep navy navigation rail (`#101A2B`), and crisp typography.
- **Voiceover:**
  > "For small-business finance operators, month-end closing is a high-stress nightmare of hunting down missing receipts, timing clearance lags, and mysterious bank fees. Generic AI chatbots fail because LLMs cannot do reliable accounting math. Cloud accounting suites cost thousands and force you to upload confidential customer bank statements to their servers.
  > 
  > This is **ProofLedger AI**: A privacy-first reconciliation workspace built on one core thesis: *Deterministic financial truth, AI-assisted investigation, and human-controlled resolution.*"

### 0:18 – 0:45: Loading Data & Instant Deterministic Reconciliation
- **Visual:** Click **"Load Demo Data"**. Show the 32-row Bank CSV and 27-row Ledger CSV populate instantaneously for *Northstar Studio — September Close*.
- **Voiceover:**
  > "Let's load our September close for Northstar Studio. All parsing happens directly in your browser memory via PapaParse. No CSV is ever uploaded to a server.
  > 
  > Notice the KPI header: Net Bank Position is ₹4,76,380; Net Ledger is ₹4,94,880. All calculations are computed in pure integer minor units—paise—completely eliminating binary floating-point drift.
  > 
  > In under 50 milliseconds, our deterministic engine confirmed 23 exact 1-to-1 matches, with zero double-consumption, isolating an unresolved variance of -₹18,500 across 5 distinct exceptions."

### 0:45 – 1:15: The Signature Evidence Trail
- **Visual:** Click on exception `EXP-AMT-BNK-013-LDG-012` (Zenith Brand Identity Invoice). The **Evidence Inspector** side-panel opens.
- **Voiceover:**
  > "This is ProofLedger's signature interaction: the **Evidence Inspector**. 
  > 
  > Rather than a generic chatbot, we see the forensic chain of evidence connecting both records: Bank Row BNK-013 shows ₹49,760 credited on September 13th, while Ledger Row LDG-012 shows ₹50,000 invoiced under matching reference NEFT-339102. 
  > 
  > The deterministic connector highlights a variance of -₹240 with identical transaction date. But why was less deposited than invoiced?"

### 1:15 – 1:45: Privacy Boundary, Consent Gate & NVIDIA Nemotron Investigation
- **Visual:** Click **"Investigate Exception"**. The Outbound Privacy Payload Preview modal appears. Check the consent box and click **"Proceed with Inference"**.
- **Voiceover:**
  > "We click 'Investigate Exception'. Notice our privacy boundary: ProofLedger presents an exact JSON preview of the data about to be sent. Notice that bank account numbers and sensitive client handles are automatically masked with `[REDACTED]` tokens. 
  > 
  > Only upon explicit operator consent does our server adapter dispatch this sanitized 4-field packet to **NVIDIA Llama-3.1-Nemotron-70B-Instruct** on **Nebius Token Factory**.
  > 
  > The model responds with strict structured JSON, verified by runtime Zod schemas. It correctly classifies this as `BANK_FEE_OR_SURCHARGE`, cites only genuine row IDs, explains the ₹240 payment gateway deduction, and suggests posting a debit voucher to Bank Charges Expense."

### 1:45 – 2:15: Human-in-the-Loop Review & Audit Trail
- **Visual:** Type in reviewer note: *"Verified gateway merchant settlement slip; ₹240 processing fee confirmed."* Click **"Approve"**. Switch to the **Audit Trail** tab in the navigation rail.
- **Voiceover:**
  > "The AI never automatically alters financial records. Final authority remains with the human operator. We enter an auditor verification note and click **Approve**.
  > 
  > Switching to the **Audit Trail**, we see an append-only forensic record: every mathematical match, AI hypothesis, and operator sign-off is logged with ISO timestamps and reviewer identities for statutory auditors."

### 2:15 – 2:40: Formula-Safe Export Package
- **Visual:** Click **"Export Pack"**. Open the export modal, preview the Markdown Executive Report and CSV tabs, and click **"Download File"**.
- **Voiceover:**
  > "When month-end closes, ProofLedger exports a complete audit package: Reconciled CSV, Exceptions CSV, Audit JSON, and an Executive Markdown Report.
  > 
  > Crucially, every exported text cell starting with `=`, `+`, `-`, or `@` is automatically neutralized with an apostrophe prefix, preventing spreadsheet CSV formula injection attacks (CWE-1236) while preserving legitimate negative numbers in financial columns."

### 2:40 – 2:50: Conclusion & Architecture Recap
- **Visual:** Navigate to the **Privacy Boundary** tab showing the live infrastructure card and local deterministic proof guarantees.
- **Voiceover:**
  > "ProofLedger AI: 100% deterministic arithmetic, zero-raw-upload privacy, and targeted NVIDIA Nemotron reasoning on Nebius Token Factory. Built and verified for the Nebius × NVIDIA Global AI Hackathon 2026. Thank you!"
