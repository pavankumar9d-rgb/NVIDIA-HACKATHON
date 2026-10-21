# Demo Video Script — ProofLedger AI

**Product:** ProofLedger AI  
**Track:** Best Apps & Agents (Nebius × NVIDIA Global AI Hackathon 2026)  
**Target Video Duration:** 2 minutes 50 seconds (Strictly under the mandatory 3-minute limit)  
**Presenter:** Single-operator walkthrough (Priya Sharma persona / Hackathon Builder)  
**Live Application URL:** https://proofledger-ai.onrender.com  

---

## Storyboard & Timestamped Walkthrough

### 0:00 – 0:30: Introduction, Account Choice & Zero-Durable-Storage Guarantee
- **Visual:** Open browser at `https://proofledger-ai.onrender.com`. ProofLedger AI launches with a branded preloader transition into the **Welcome Screen**. The screen clearly separates "Continue with Google" (for private encrypted cloud history via Supabase RLS) from "Continue as Guest" (for 100% in-browser deterministic processing with zero cloud writes and zero durable storage). Click **"Continue as Guest"**, instantly mounting the workspace with the green `[● Guest Mode]` badge in the header.
- **Voiceover:**
  > "For small-business finance operators, month-end closing is a high-stress nightmare of hunting down missing receipts, timing clearance lags, and mysterious bank fees. Generic AI chatbots fail because LLMs cannot do reliable accounting math. Cloud accounting suites cost thousands and force you to upload confidential customer bank statements to their servers.
  > 
  > This is **ProofLedger AI**: A privacy-first reconciliation workspace built on one core thesis: *Deterministic financial truth, AI-assisted investigation, and human-controlled resolution.*
  > 
  > Notice right on entry: We choose **Guest Mode**. Our zero-durable-storage guarantee ensures zero transactions are written to localStorage, IndexedDB, or any cloud database. Everything runs volatile in your browser memory."

### 0:30 – 0:55: Executive Overview, Real Financial Positions & Pure SVG Charts
- **Visual:** Click **"Load Demo Scenario"** (32 rows). Show the multi-stage progress ticker (*"Sanitizing payload... Evaluating clearance tolerance... Computing reconciliation bridge"*). The Executive Overview screen populates instantaneously for *Northstar Studio — September Close*.
- **Voiceover:**
  > "Let's load our September close for Northstar Studio. All parsing executes client-side in browser memory via PapaParse. Zero raw data leaves your machine.
  > 
  > Notice our executive header: We clearly distinguish **Closing Positions** from **Net Movements**. With a certified ₹4,50,000 opening balance, our Closing Bank Position is ₹4,76,380 from +₹26,380 net inflow, while our Closing Ledger Position is ₹4,60,950 from +₹10,950 net inflow. All calculations use exact integer minor units—paise—preventing binary floating-point drift.
  > 
  > Below, notice our pure SVG charts built with zero heavy charting dependencies: A responsive dual-series Daily Movement chart comparing daily bank versus ledger cash flows, and an interactive Reconciliation Volume Composition bar showing our 89.3% confirmed match rate with smooth entrance animations."

### 0:55 – 1:20: 100% Balanced Reconciliation Bridge & Priority Triage
- **Visual:** Scroll down on the Overview tab to reveal the **Audit Reconciliation Bridge** and the **Priority Exception Triage Queue**.
- **Voiceover:**
  > "ProofLedger doesn't just show an unresolved net variance of +₹15,430—it mathematically proves it. Our 100% balanced reconciliation bridge traces every rupee across unpresented vendor cheques (+₹18,500), unrecorded bank interest (+₹3,420), gateway fee deductions (-₹240), service charges (-₹1,250), and duplicate ATM debits (-₹5,000). The reconciled ledger variance equals exactly ₹0.00.
  > 
  > From the Priority Triage queue, we can click 'Triage' on the Zenith Brand Identity fee discrepancy to immediately jump into the Investigation Desk."

### 1:20 – 1:50: Full-Width Investigation Desk & Sliding Evidence Drawer
- **Visual:** Click "Triage" on exception `EXP-AMT-BNK-013-LDG-012`. The interface transitions smoothly to the **Investigation Desk** where a full-width transaction grid is displayed, and the **Evidence Drawer** slides in from the right over a frosted backdrop.
- **Voiceover:**
  > "Notice how our Investigation Desk uses 100% of the screen width for maximum financial data density, while the **Evidence Drawer** slides in seamlessly from the right without cramping table columns.
  > 
  > Inside the drawer, the forensic chain of evidence is clear: Bank Row BNK-013 shows ₹49,760 credited on September 13th, while Ledger Row LDG-012 shows ₹50,000 invoiced under matching reference NEFT-339102. 
  > 
  > The deterministic connector highlights an exact variance of -₹240. But why was less deposited than invoiced?"

### 1:50 – 2:20: Privacy Boundary, Consent Gate & NVIDIA Nemotron Investigation
- **Visual:** Click **"Investigate Exception"**. The Outbound Privacy Payload Preview modal appears. Check the consent box and click **"Proceed with Inference"**.
- **Voiceover:**
  > "We click 'Investigate Exception'. Notice our privacy boundary: ProofLedger presents an exact JSON preview of the data about to be sent. Bank account numbers, UPI handles, and client names are automatically masked with `[REDACTED]` tokens. 
  > 
  > Only upon explicit operator consent does our server adapter dispatch this sanitized 4-field packet to **NVIDIA Llama-3.1-Nemotron-70B-Instruct** on **Nebius Token Factory** (or executes transparent local deterministic investigation when running in zero-cost Local Mode).
  > 
  > The model responds with strict structured JSON, verified by runtime Zod schemas. It correctly classifies this as `BANK_FEE_OR_SURCHARGE`, cites only genuine row IDs, explains the ₹240 payment gateway deduction, and suggests posting a debit voucher to Bank Charges Expense."

### 2:20 – 2:40: Human-in-the-Loop Review & Audit Trail
- **Visual:** Type in reviewer note: *"Verified gateway merchant settlement slip; ₹240 processing fee confirmed."* Click **"Approve"**. Press `Escape` to close the drawer, then switch to the **Audit Trail** tab in the navigation rail.
- **Voiceover:**
  > "The AI never automatically alters financial records. Final authority remains with the human operator. We enter an auditor verification note and click **Approve**.
  > 
  > Switching to the **Audit Trail**, we see an append-only forensic record: every mathematical match, AI hypothesis, and operator sign-off is logged with ISO timestamps and reviewer identities for statutory auditors."

### 2:40 – 2:50: Formula-Safe Export Package & Conclusion
- **Visual:** Click **"Export Pack"**. Open the export modal, preview the Markdown Executive Report and CSV tabs, and click **"Download File"**.
- **Voiceover:**
  > "When month-end closes, ProofLedger exports a complete audit package: Reconciled CSV, Exceptions CSV, Audit JSON, and an Executive Markdown Report—with automatic formula injection protection (CWE-1236).
  > 
  > ProofLedger AI: 100% deterministic arithmetic, zero-raw-upload privacy, and targeted NVIDIA Nemotron reasoning on Nebius Token Factory. Built for the Nebius × NVIDIA Global AI Hackathon 2026. Thank you!"
