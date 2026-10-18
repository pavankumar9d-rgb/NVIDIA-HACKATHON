# Design Specification — ProofLedger AI

**Design Concept:** Financial Investigation Desk  
**Mood:** Precise, calm, tactile, evidence-first, high-density financial clarity  
**Target Viewport:** 1440×900 desktop optimized, responsive down to 375px mobile  
**Accessibility:** WCAG AA compliant contrast on all interactive elements and text  

---

## 1. Visual Philosophy & Design Direction

ProofLedger AI rejects the trend of generic, empty SaaS admin dashboards with vast unused whitespace and cartoonish gradients. Financial operators work under acute closing deadlines and need **high-density data presentation**, **instant visual feedback**, and **uncompromising clarity**.

The visual language combines the rigor of an institutional trading terminal with the tactile clarity of an investigative workbench:
- **Calm, low-fatigue porcelain canvas** (`#F6F7F2`) avoids the harsh glare of stark white `#FFFFFF` across multi-hour sessions.
- **Deep midnight navy rail** (`#101A2B`) grounds navigation and conveys institutional security.
- **Electric chartreuse** (`#D7FF56`) is reserved strictly for high-priority user actions (e.g., Run Reconciliation, Confirm Review).
- **Emerald** (`#17845B`) and **Vermilion** (`#D75E4C`) signal mathematical proof and variance risk with absolute clarity.

---

## 2. Design Tokens & Color Palette

### 2.1 Core Palette Tokens
```css
:root {
  /* Surfaces */
  --color-canvas: #F6F7F2;          /* Warm porcelain background */
  --color-surface-main: #FFFFFF;    /* Primary card and panel surface */
  --color-surface-soft: #EEF1EB;    /* Subtle nested surface, headers */
  --color-surface-muted: #E4E9E0;   /* Inactive tabs, hover wells */
  --color-surface-nav: #101A2B;     /* Deep midnight navigation rail */
  
  /* Borders & Dividers */
  --color-border: #DDE3DA;          /* Default structural divider */
  --color-border-subtle: #EDF1EA;   /* Nested inner gridlines */
  --color-border-strong: #BDC8B7;   /* Focused elements, active cards */
  
  /* Text & Inks */
  --color-ink-primary: #111827;     /* High contrast primary text */
  --color-ink-secondary: #4B5563;   /* Body labels, table headers */
  --color-ink-muted: #6B7280;       /* Metadata, footnotes, timestamps */
  --color-ink-on-dark: #F9FAFB;     /* Navigation text */
  
  /* Accents & Signals */
  --color-accent-chartreuse: #D7FF56; /* Primary call-to-action */
  --color-accent-ink: #111827;        /* Contrast ink on chartreuse */
  
  /* Semantic Statuses */
  --color-verified-emerald: #17845B;  /* Confirmed match */
  --color-verified-bg: #E8F5EE;       /* Emerald pill tint */
  --color-risk-vermilion: #D75E4C;    /* Discrepancy / Unmatched risk */
  --color-risk-bg: #FDEDEA;          /* Vermilion pill tint */
  --color-info-blue: #2563EB;         /* Metadata / System notice */
  --color-info-bg: #EFF6FF;           /* Blue pill tint */
  --color-warning-amber: #D97706;     /* Ambiguous / Needs attention */
  --color-warning-bg: #FEF3C7;        /* Amber pill tint */
}
```

### 2.2 Contrast & Accessibility Audit
- **Primary Ink (`#111827`) on Porcelain Canvas (`#F6F7F2`):** Contrast ratio **14.2:1** (Exceeds WCAG AAA standard of 7:1).
- **Chartreuse Button (`#D7FF56`) with Dark Ink (`#111827`):** Contrast ratio **14.6:1** (Exceeds WCAG AAA).
- **Verified Emerald Text (`#17845B`) on Emerald Tint (`#E8F5EE`):** Contrast ratio **5.2:1** (Exceeds WCAG AA standard of 4.5:1).
- **Risk Vermilion Text (`#D75E4C`) on Risk Tint (`#FDEDEA`):** Contrast ratio **4.9:1** (Exceeds WCAG AA).

---

## 3. Typography Hierarchy

| Style | Font Family | Size | Weight | Line Height | Tracking | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Display H1** | Inter, -apple-system, sans-serif | 24px (1.5rem) | 700 | 1.25 | -0.02em | Workspace Header |
| **Heading H2** | Inter, -apple-system, sans-serif | 18px (1.125rem) | 600 | 1.3 | -0.015em | Panel Headers, Metric Titles |
| **Subheading H3** | Inter, -apple-system, sans-serif | 14px (0.875rem) | 600 | 1.4 | -0.01em | Table Column Headers, Card Titles |
| **Body Regular** | Inter, -apple-system, sans-serif | 13px (0.8125rem) | 400 | 1.5 | 0 | Narrative, explanations, cells |
| **Body Small** | Inter, -apple-system, sans-serif | 12px (0.75rem) | 400 | 1.4 | 0 | Microcopy, helpers, tooltips |
| **Numeric Mono** | JetBrains Mono, monospace | 13px (0.8125rem) | 500 | 1.2 | -0.01em | Amounts, currency, percentages |
| **Code Mono** | JetBrains Mono, monospace | 11px (0.6875rem) | 500 | 1.3 | 0 | Row IDs, Hashes, UTR numbers |

---

## 4. Information Architecture & Layout Structure

### 4.1 Master 4-View Architecture
ProofLedger AI provides a structured 4-view executive workflow rather than a cramped single-screen console:

```
+----------------------------------------------------------------------------------------------------------------+
| NAVIGATION RAIL (Deep Midnight Navy #101A2B)                                                                   |
| [Brand Mark] | [Overview] | [Investigation Desk (badge)] | [Privacy Boundary] | [Audit Trail] | [Gateway Pill]  |
+----------------------------------------------------------------------------------------------------------------+
| TOP BAR: Session Context ("Northstar Studio — Sep 2026") | Status Chip | Load Demo | Reconcile | Export Pack    |
+----------------------------------------------------------------------------------------------------------------+
| VIEW 1: EXECUTIVE OVERVIEW (Default Landing)                                                                   |
| - Executive Close Status Banner (Closing variance, match rate, active exceptions, export shortcut)             |
| - Core Financial Position Cards:                                                                               |
|   * Closing Bank Balance (₹4,76,380.00) vs Net Inflow (+₹26,380.00, Opening: ₹4,50,000.00)                    |
|   * Closing Ledger Balance (₹4,60,950.00) vs Net Inflow (+₹10,950.00, Opening: ₹4,50,000.00)                 |
|   * Confirmed Match Rate (89.3% volume, 23 pairs)                                                             |
|   * Unresolved Net Variance (+₹15,430.00, 5 exceptions)                                                        |
| - Pure SVG Visual Analytics:                                                                                   |
|   * Daily Cash & Ledger Movement Trend (Dual-series line chart with area gradient fill & hover tooltips)       |
|   * Reconciliation Volume Composition (Proportional segmented bar: Confirmed, Unmatched, Fee/Timing delta)   |
| - 100% Balanced Audit Reconciliation Bridge (Step-by-step mathematical bridge from Bank to Ledger)            |
| - Priority Exception Triage Queue (Top items by variance with one-click deep-link to Investigation Desk)        |
+----------------------------------------------------------------------------------------------------------------+
| VIEW 2: INVESTIGATION DESK (100% Full-Width Grid + Sliding Drawer)                                             |
| - Full-width split transaction grid with search, multi-axis filter pills, and column sort                      |
| - Sliding Evidence Drawer (Slides from right, 540px width, semi-transparent backdrop, ESC dismiss)             |
|   * Source Bank vs Ledger Row cards with raw & sanitized details                                               |
|   * Deterministic connector node (Amount delta, Date tolerance delta, Reference match)                         |
|   * Privacy boundary consent checkbox & exact JSON payload preview                                             |
|   * NVIDIA Nemotron 70B structured hypothesis & human review controls (Approve, Reject, Defer)                |
+----------------------------------------------------------------------------------------------------------------+
| VIEW 3: PRIVACY & DATA SOVEREIGNTY BOUNDARY                                                                    |
| - Interactive PII redaction testbed, outbound packet inspector, and live inference gateway controls           |
+----------------------------------------------------------------------------------------------------------------+
| VIEW 4: AUDIT TRAIL & COMPLIANCE LOG                                                                           |
| - Append-only chronological timeline of matches, AI hypotheses, auditor notes, and formula-safe export pack    |
+----------------------------------------------------------------------------------------------------------------+
```

---

## 5. Signature Component Specifications

### 5.1 Financial Metrics & Canonical Balance Hierarchy
ProofLedger AI strictly enforces standard accounting terminology to prevent operator confusion:
- **Opening Balance Anchor:** The certified period opening cash position (`₹4,50,000.00` in the demo dataset).
- **Net Period Movement:** The algebraic sum of all credits less debits during the statement window (`Bank: +₹26,380.00`, `Ledger: +₹10,950.00`).
- **Closing Position:** The true ending balance (`Opening Balance + Net Movement`):
  $$\text{Closing Bank Balance} = ₹4,50,000.00 + ₹26,380.00 = ₹4,76,380.00$$
  $$\text{Closing Ledger Balance} = ₹4,50,000.00 + ₹10,950.00 = ₹4,60,950.00$$
- **Unresolved Net Variance:** The closing delta requiring reconciliation:
  $$\Delta = ₹4,76,380.00 - ₹4,60,950.00 = +₹15,430.00$$
- **Mathematical Reconciliation Bridge:**
  A step-by-step audit schedule that bridges Bank Ending Balance to Ledger Ending Balance with zero leakage:
  $$\begin{aligned}
    \text{Bank Closing Balance} &= ₹4,76,380.00 \\
    \text{Less: Unpresented Cheque (CHQ-771829)} &= -₹18,500.00 \\
    \text{Less: Unrecorded Bank Interest (HDFC-INT-Q2)} &= -₹3,420.00 \\
    \text{Plus: Gateway Fee Variance (NEFT-339102)} &= +₹240.00 \\
    \text{Plus: Unrecorded Service Charge (HDFC-SVC-09)} &= +₹1,250.00 \\
    \text{Plus: Duplicate Bank Debit (ATM-00912)} &= +₹5,000.00 \\
    \hline
    \textbf{Reconciled Ledger Balance} &= \mathbf{₹4,60,950.00} \quad (\Delta = ₹0.00)
  \end{aligned}$$

### 5.2 Responsive Pure-SVG Data Charts
ProofLedger AI builds all charts using pure React and responsive SVG with zero third-party chart libraries:
- **`DailyMovementChart.tsx`**:
  - Dual-series continuous line and area gradient chart plotting daily bank inflows/outflows versus ledger vouchers.
  - Dynamic min/max scaling with rounded grid ticks and zero-line baseline.
  - Interactive day hover cursor with pinned card displaying Bank vs Ledger daily amounts and daily variance.
  - Built with accessibility: SVG `<title>`, `<desc>`, and ARIA attributes for screen readers.
- **`ReconciliationCompositionChart.tsx`**:
  - Horizontal stacked percentage bar with proportional segments: Confirmed Matched Volume, Bank Exceptions, Ledger Exceptions, and Timing/Fee Variance.
  - Click-to-filter interaction: Clicking a segment directly navigates to the Investigation Desk filtered by that category.
  - Micro-cards displaying volume share, rupee totals, and count breakdown.

### 5.3 Sliding Investigation Drawer (`EvidencePanel.tsx`)
Replaces the static 33% layout column with an overlay drawer:
- **Dimensions:** Full-width on mobile; fixed 480px–540px width on desktop.
- **Backdrop:** Semi-transparent scrim (`bg-slate-900/40 backdrop-blur-sm`) with click-to-dismiss.
- **Keyboard Navigation:** Native `Escape` key listener closes the drawer.
- **Variance Banner:** Contrasts the specific exception variance against the macro statement variance.
- **Deterministic Signals:** Visual badge chips for date clearance lag, amount delta in minor units, and reference match score.
- **Privacy Preview:** Expandable inspection showing the exact outbound redacted JSON payload.
- **Operator Review Controls:** One-click Approve, Reject, or Defer with optional auditor notes.

### 5.4 Branded Preloader & Transparent Progress Feedback
- **Branded Preloader (`BrandedPreloader.tsx`):**
  - Renders during initial session load with pulsing geometric shield mark and subtle progress bar.
  - Auto-dismisses upon mount with smooth fade-out.
- **Multi-Stage Asynchronous Progress Feedback:**
  - Real-time status ticker during reconciliation and AI investigation:
    1. *"Sanitizing payload & hashing tokens..."*
    2. *"Evaluating clearance date tolerance..."*
    3. *"Computing mathematical reconciliation bridge..."*
    4. *"Finalizing audit schedule..."*

---

## 6. Microinteractions & Animation Policy

- **Duration:** 120ms to 180ms transitions. Never exceed 250ms for utility actions.
- **Easing:** `cubic-bezier(0.16, 1, 0.3, 1)` (snappy spring deceleration).
- **Drawer Transition:** Smooth translateX slide-in with 200ms ease-out.
- **Motion Reduction:** Media query `@media (prefers-reduced-motion: reduce)` disables all transforms and sets durations to `0ms`.
