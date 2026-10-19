# ProofLedger AI — Supabase Setup & Architecture Guide

## Overview

ProofLedger AI features an optional, zero-cost private cloud persistence layer powered by Supabase (PostgreSQL with Row Level Security and Google OAuth).

### Core Principles & Privacy Invariants
1. **Zero-Cost Free Tier:** Uses only standard Supabase free-tier capabilities without paid add-ons or credit cards.
2. **Zero Leakage / Guest Mode:** When Supabase environment variables are omitted or invalid, ProofLedger AI operates 100% in local in-memory Guest Mode. No network calls to cloud databases are made, and no user data leaves the client browser.
3. **Explicit User Consent:** History is saved only when the reviewer explicitly initiates and confirms "Save to History" in the UI.
4. **Strict Sanitization Allowlist:** Raw CSV strings, unvalidated input buffers, and `rawRow` payloads containing original vendor account numbers or PII are **strictly stripped** before storage (`buildSanitizedHistorySnapshot`). Only sanitized descriptions, integer amounts in paise, match relationships, and deterministic metrics are persisted.
5. **Row Level Security (RLS) Enforcement:** Every read, write, and deletion query is verified by PostgreSQL via `(select auth.uid()) = user_id`. No user can ever query or modify another user's reconciliation records.

---

## Database Migration & Schema

The SQL migration is located at:
`supabase/migrations/20261019000001_reconciliation_history.sql`

### Schema Details
- **Table:** `public.reconciliation_history`
- **Primary Key:** `id` (`UUID DEFAULT gen_random_uuid()`)
- **Foreign Key:** `user_id` (`UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`)
- **Indexes:**
  - Foreign key index on `user_id`: optimizes joins and cascade deletions.
  - Keyset composite index on `(user_id, created_at DESC, id DESC)`: ensures fast pagination without expensive table scans.
  - GIN index on `snapshot jsonb_path_ops`: accelerates JSON path and containment queries over sanitized reconciliation summaries.
- **RLS Configuration:**
  - `ALTER TABLE public.reconciliation_history ENABLE ROW LEVEL SECURITY;`
  - `ALTER TABLE public.reconciliation_history FORCE ROW LEVEL SECURITY;`
  - Policies for `SELECT`, `INSERT`, `UPDATE`, and `DELETE` enforce `user_id = (select auth.uid())` using cached subqueries per `supabase-postgres-best-practices`.

---

## Setup Instructions

### 1. Create a Free Supabase Project
1. Visit [supabase.com](https://supabase.com) and create a free organization and project.
2. Select your closest AWS or GCP region.
3. Once provisioned, open the **SQL Editor** from the left navigation.
4. Paste the contents of `supabase/migrations/20261019000001_reconciliation_history.sql` and click **Run**.

### 2. Configure Google OAuth (Optional)
1. In your Supabase Project Dashboard, navigate to **Authentication -> Providers -> Google**.
2. Enable Google authentication.
3. In [Google Cloud Console](https://console.cloud.google.com/):
   - Create an OAuth 2.0 Client ID (Web Application).
   - Set Authorized Redirect URIs to: `https://<YOUR-PROJECT-REF>.supabase.co/auth/v1/callback`
   - Copy the Client ID and Client Secret into the Supabase provider settings and save.
4. Set your site URL in **Authentication -> URL Configuration** (e.g. `http://localhost:5173` for local dev or your production Render domain).

### 3. Add Environment Variables
In your local `.env` or hosting provider environment settings:
```bash
VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-public-key>
```
*Note: Both keys are safe for client-side distribution as PostgreSQL RLS restricts all database access to authenticated users' own rows.*

---

## Local Verification & Testing
Automated test suite validates:
- Client graceful fallback when unconfigured (`tests/history-privacy.test.ts`).
- Snapshot sanitization allowlist stripping `rawRow` and raw CSV text.
- Keyset index ordering and constraint integrity.
