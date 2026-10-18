# Quality Assurance & Test Plan — ProofLedger AI

**Product:** ProofLedger AI  
**Track:** Best Apps & Agents (Nebius × NVIDIA Global AI Hackathon 2026)  
**Test Framework:** Vitest v5.0.5 + jsdom  
**Status:** 29 of 29 Tests Passing (100% Green)  
**Last Verified:** October 18, 2026  

---

## 1. Test Architecture & Coverage Matrix

ProofLedger AI implements automated verification across five critical domains:

| Test Suite File | Scope & Invariants Covered | Test Count | Result |
| :--- | :--- | :--- | :--- |
| `tests/money.test.ts` | Integer paise conversion, negative amounts/parentheses, floating-point immunity, Indian numbering formatting, currency mismatch prevention. | 7 | **PASS** |
| `tests/reconciliation.test.ts` | 1-to-1 matching, date clearance tolerance, duplicate candidate detection, Jaccard token description overlap, amount mismatch detection, Northstar Studio synthetic benchmark. | 6 | **PASS** |
| `tests/ai-safety.test.ts` | Zod runtime schema conformance, rejection of invalid classifications, citation provenance verification (blocking hallucinated row IDs), explicit user consent enforcement, prompt injection neutralization. | 6 | **PASS** |
| `tests/privacy-security.test.ts` | Regex redaction of bank accounts, UPI IDs, and phone numbers; CSV formula injection neutralization (CWE-1236) while preserving signed numbers; `.env.example` secret hygiene. | 6 | **PASS** |
| `tests/server-api.test.ts` | Express gateway health check, `/api/ai/status` key leak prevention, `/api/investigate` consent requirement, truthful `LOCAL_MODE` fallback when unconfigured. | 4 | **PASS** |
| **Total** | **Comprehensive Full-Stack Coverage** | **29** | **100% PASS** |

---

## 2. Test Execution Commands & Verified Outputs

### 2.1 Automated Test Suite
```powershell
pnpm test
```
**Actual Console Output:**
```
 RUN  v5.0.5 C:/Users/saipa/OneDrive/Desktop/nvidia hackathon

 ✓ tests/privacy-security.test.ts (6 tests) 34ms
 ✓ tests/reconciliation.test.ts (6 tests) 61ms
 ✓ tests/money.test.ts (7 tests) 198ms
 ✓ tests/ai-safety.test.ts (6 tests) 19ms
 ✓ tests/server-api.test.ts (4 tests) 1031ms

 Test Files  5 passed (5)
      Tests  29 passed (29)
   Duration  18.15s
```

### 2.2 Production Build & Bundle Verification
```powershell
pnpm run build
```
**Actual Console Output:**
```
$ tsc -b && vite build
vite v8.3.4 building client environment for production...
transforming...
✓ 1937 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.78 kB │ gzip:   0.48 kB
dist/assets/index-Ca5c_y4R.css   31.48 kB │ gzip:   7.00 kB
dist/assets/index-C3MNyJ70.js   335.72 kB │ gzip: 100.39 kB

✓ built in 3.82s
```

---

## 3. Core Acceptance Criteria Verification

### 3.1 Mathematical Soundness Gate
- **Invariant:** $0.1 + 0.2 = 0.30$ paise exact; zero IEEE-754 binary floating-point drift.
- **Verification:** `tests/money.test.ts` passes `parseToPaise(0.1) + parseToPaise(0.2) === 30`.
- **Status:** **PASS**

### 3.2 1-to-1 Row Consumption Gate
- **Invariant:** A transaction cannot be matched or consumed more than once. When competing candidates exist, the engine flags an Ambiguous Tie rather than greedily consuming a row.
- **Verification:** `tests/reconciliation.test.ts` proves that 1 bank transaction with 2 identical ledger candidates produces 0 greedy matches and 1 `AMBIGUOUS_MATCH` exception.
- **Status:** **PASS**

### 3.3 AI Provenance & Citation Gate
- **Invariant:** Any model response that hallucinates or cites a non-existent row ID is rejected.
- **Verification:** `tests/ai-safety.test.ts` confirms that `verifyRowIdProvenance(['BNK-001', 'LDG-999'], activeSessionRowIds)` returns `isValid: false` and flags `LDG-999`.
- **Status:** **PASS**

### 3.4 Formula Injection Escaping Gate (CWE-1236)
- **Invariant:** Cells starting with `=`, `+`, `-`, `@` must be prepended with `'` on export; legitimate negative numbers must be preserved.
- **Verification:** `tests/privacy-security.test.ts` proves `=cmd|...` is escaped to `"'=cmd|..."` while `-500.00` in a numeric column remains `-500.00`.
- **Status:** **PASS**

### 3.5 Privacy & Zero Raw Upload Gate
- **Invariant:** Raw CSVs never leave browser session memory. Server only receives single sanitized exception packets with explicit consent.
- **Verification:** `tests/server-api.test.ts` confirms that requests lacking `consentGranted: true` are rejected with HTTP 400.
- **Status:** **PASS**
