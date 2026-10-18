/**
 * ProofLedger AI — Synthetic Demonstration Fixture
 * 
 * Organization: Northstar Studio (Design & Creative Agency)
 * Scenario: September 2026 Monthly Close
 * Currency: INR (₹)
 * 
 * All records, names, amounts, and references in this fixture are 100% synthetic
 * and specifically designed to exercise deterministic matching, duplicate detection,
 * timing lags, amount discrepancies, and Nebius AI investigation.
 */

export const SYNTHETIC_BANK_CSV = `Date,Description,Reference_No,Debit,Credit,Balance
2026-09-01,Opening Balance,INIT-9201,,,450000.00
2026-09-02,Client Retainer Apex Digital,NEFT-92817201,,125000.00,575000.00
2026-09-03,AWS Cloud Infrastructure,CHQ-4819201,14850.00,,560150.00
2026-09-04,Adobe Creative Cloud Sub,UPI-adobe@hdfc,6200.00,,553950.00
2026-09-05,Commercial Office Lease,RTGS-0192831,65000.00,,488950.00
2026-09-06,Figma Enterprise Lic,UPI-figma@icici,18400.00,,470550.00
2026-09-07,Client Milestone BlueSky Labs,NEFT-8829103,,85000.00,555550.00
2026-09-08,Coworking High-Speed Fiber,IMPS-772910,4500.00,,551050.00
2026-09-09,Client Advance Horizon Retail,RTGS-449102,,210000.00,761050.00
2026-09-10,Staff Payroll Batch A,SAL-202609A,180000.00,,581050.00
2026-09-11,Hardware Laptop Workstation,CHQ-991023,84500.00,,496550.00
2026-09-12,Google Workspace Suite,UPI-google@sbi,3800.00,,492750.00
2026-09-13,Client Payment Zenith Brand,NEFT-339102,,49760.00,542510.00
2026-09-14,Quarterly Audit Advance,CHQ-112093,25000.00,,517510.00
2026-09-15,Office Pantry Supplies,UPI-pantry@paytm,2850.00,,514660.00
2026-09-16,Slack Technologies Yearly,CARD-8839,32000.00,,482660.00
2026-09-17,Freelance Motion Designer,IMPS-992019,22000.00,,460660.00
2026-09-18,Client Consultation Veloce,NEFT-662910,,40000.00,500660.00
2026-09-19,Notion Team Workspace,UPI-notion@axis,2400.00,,498260.00
2026-09-20,Vendor Studio Lighting,CHQ-552910,16500.00,,481760.00
2026-09-21,Petty Cash Branch ATM,ATM-00912,5000.00,,476760.00
2026-09-22,Petty Cash Branch ATM,ATM-00912,5000.00,,471760.00
2026-09-23,Client Project Crestview,NEFT-771920,,95000.00,566760.00
2026-09-24,GitHub Enterprise Team,UPI-github@kotak,4200.00,,562560.00
2026-09-25,Staff Payroll Batch B,SAL-202609B,95000.00,,467560.00
2026-09-26,HDFC Quarterly Bank Surcharge,HDFC-SVC-09,1250.00,,466310.00
2026-09-27,Client Workshop Fees,UPI-client@upi,,15000.00,481310.00
2026-09-28,Courier & Express Delivery,UPI-deliv@paytm,850.00,,480460.00
2026-09-29,Soundtrack Audio Lic,CARD-1192,7500.00,,472960.00
2026-09-30,Interest Credited Q2,HDFC-INT-Q2,,3420.00,476380.00`;

export const SYNTHETIC_LEDGER_CSV = `Date,Account_Narration,Voucher_Ref,Debit_Expense,Credit_Income
2026-09-02,Apex Digital Monthly Retainer,NEFT-92817201,,125000.00
2026-09-01,AWS Cloud Infrastructure Servers,CHQ-4819201,14850.00,
2026-09-04,Adobe Creative Cloud Software,UPI-adobe@hdfc,6200.00,
2026-09-05,September Office Rent,RTGS-0192831,65000.00,
2026-09-06,Figma Enterprise Design Team,UPI-figma@icici,18400.00,
2026-09-07,BlueSky Labs Milestone 1,NEFT-8829103,,85000.00
2026-09-08,High Speed Internet Fiber,IMPS-772910,4500.00,
2026-09-09,Horizon Retail Q3 Advance,RTGS-449102,,210000.00
2026-09-10,September Senior Staff Salary,SAL-202609A,180000.00,
2026-09-11,MacBook Pro M3 Hardware,CHQ-991023,84500.00,
2026-09-12,Google Workspace Suite,UPI-google@sbi,3800.00,
2026-09-13,Zenith Brand Identity Invoice,NEFT-339102,,50000.00
2026-09-14,Statutory Audit Advance Fee,CHQ-112093,25000.00,
2026-09-15,Pantry Coffee and Snacks,UPI-pantry@paytm,2850.00,
2026-09-16,Slack Annual Team Subscription,CARD-8839,32000.00,
2026-09-17,Motion Design Freelancer Invoice,IMPS-992019,22000.00,
2026-09-18,Veloce Brand Consultation,NEFT-662910,,40000.00
2026-09-19,Notion Workspace Subscription,UPI-notion@axis,2400.00,
2026-09-20,Studio Stage Light Equipment,CHQ-552910,16500.00,
2026-09-21,Petty Cash Studio Replenishment,ATM-00912,5000.00,
2026-09-23,Crestview Web App Design,NEFT-771920,,95000.00
2026-09-24,GitHub Enterprise Code Hosting,UPI-github@kotak,4200.00,
2026-09-25,September Junior Staff Payroll,SAL-202609B,95000.00,
2026-09-27,Brand Design Workshop Fee,UPI-client@upi,,15000.00
2026-09-28,Express Courier Documents,UPI-deliv@paytm,850.00,
2026-09-29,Commercial Audio Track License,CARD-1192,7500.00,
2026-09-29,Vendor Camera Rig Rental,CHQ-771829,18500.00,`;

export const EXPECTED_DEMO_OUTCOMES = {
  scenarioName: "Northstar Studio — September Close",
  bankTransactionCount: 29, // excluding opening balance line
  ledgerTransactionCount: 27,
  expectedExceptions: [
    {
      type: "AMOUNT_MISMATCH",
      reference: "NEFT-339102",
      description: "Zenith Brand: Bank has 49,760.00, Ledger has 50,000.00 (Gateway Fee difference of 240.00)",
      deltaPaise: -24000
    },
    {
      type: "UNMATCHED_BANK",
      reference: "HDFC-SVC-09",
      description: "HDFC Quarterly Bank Surcharge of 1,250.00 recorded in Bank but unrecorded in Ledger",
      amountPaise: 125000
    },
    {
      type: "UNMATCHED_BANK",
      reference: "HDFC-INT-Q2",
      description: "Interest Credited Q2 of 3,420.00 recorded in Bank but unrecorded in Ledger",
      amountPaise: 342000
    },
    {
      type: "UNMATCHED_LEDGER",
      reference: "CHQ-771829",
      description: "Vendor Camera Rig Rental cheque of 18,500.00 issued Sept 29, not yet cleared in bank",
      amountPaise: 1850000
    },
    {
      type: "DUPLICATE_CANDIDATE",
      reference: "ATM-00912",
      description: "Two 5,000.00 ATM withdrawals on 2026-09-21 and 2026-09-22 against single 5,000.00 ledger entry",
      amountPaise: 500000
    }
  ]
};
