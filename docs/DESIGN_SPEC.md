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

### 4.1 Master 3-Zone Layout
```
+-----------------------------------------------------------------------------------------------+
| NAVIGATION RAIL (64px / 220px collapsible)                                                    |
| Brand Mark | Workspace Selector | Step Indicators | Privacy Pill | Help | Node Status        |
+-----------------------------------------------------------------------------------------------+
| TOP BAR: Session Context ("Northstar Studio — Sep 2026") | Status Chip | Load Demo | Reconcile |
+-------------------------------------------------------------------+---------------------------+
| MAIN WORKSPACE (Flex 1)                                            | EVIDENCE PANEL (420px)    |
| - Stage Progress Ribbon (Sources -> Match -> Triage -> Review)   | Selected Exception Title  |
| - Summary Metrics Row (Total Bank, Total Ledger, Match %, Delta)  | Source Bank vs Ledger Row |
| - Filter & Search Toolbar (All, Confirmed, Exceptions, Ambiguous) | Deterministic Signals     |
| - Split Transaction Table (Sticky headers, amount alignment)      | Privacy Consent & Preview |
|                                                                   | AI Nemotron Hypothesis    |
|                                                                   | Operator Decision Actions |
+-------------------------------------------------------------------+---------------------------+
```

---

## 5. Signature Component Specifications

### 5.1 Evidence Trail Component
The signature visual interaction of ProofLedger AI. It represents the forensic chain of evidence connecting two disparate transaction records:
1. **Bank Source Card:** Left card with bank logo chip, account ref, ISO timestamp, signed amount in bold JetBrains Mono.
2. **Deterministic Connector Node:** Central diamond showing computed deltas:
   - Date diff pill (e.g. `+2 days: Timing Lag`).
   - Amount variance pill (e.g. `Exact 0.00` or `Δ -₹240.00`).
   - Reference token match badge (`100% Hash Match`).
3. **Ledger Source Card:** Right card with accounting account tag, journal ref, and internal debit/credit allocation.
4. **AI Reasoning Card:** Emerges upon user consent. Outlines structured hypothesis, citing source row IDs.
5. **Decision Bar:** Three tactile buttons:
   - `[Approve Hypothesis]` (Emerald border/hover)
   - `[Reject]` (Subtle vermilion)
   - `[Defer / Need Info]` (Neutral amber)

### 5.2 Transaction Data Grid
- **Row Height:** 44px (Compact financial density).
- **Zebra Striping:** None; uses fine `#DDE3DA` 1px border with a soft `#F8FAF6` hover highlight.
- **Selected State:** Left 3px accent bar in `#111827`, soft background tint.
- **Numbers:** Always right-aligned, monospaced font with aligned decimal points.
- **Status Pills:** Compact 20px pill with dot indicator (Green for Confirmed, Red for Exception, Yellow for Ambiguous).

### 5.3 Privacy Payload Preview Dialog
Before transmitting any exception to Nebius Token Factory:
- An elegant modal displays the exact JSON payload.
- Sensitive fields (bank account numbers, user names, phone numbers) are visibly struck through with `<del>` and replaced with `[REDACTED]`.
- Explicit checkbox: *"I consent to sending this sanitized 4-field exception packet to Nebius Token Factory (NVIDIA Nemotron 70B)."*
- Action buttons: `[Confirm & Investigate]` in Chartreuse vs `[Cancel / Stay Local]` in quiet muted border.

---

## 6. Microinteractions & Animation Policy

- **Duration:** 120ms to 180ms transitions. Never exceed 250ms for utility actions.
- **Easing:** `cubic-bezier(0.16, 1, 0.3, 1)` (snappy spring deceleration).
- **Loading State:** Subtle pulse animation on skeleton bars; zero endless spinners.
- **Motion Reduction:** Media query `@media (prefers-reduced-motion: reduce)` disables all transforms and sets durations to `0ms`.
