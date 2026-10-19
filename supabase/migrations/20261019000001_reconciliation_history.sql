-- ==============================================================================
-- ProofLedger AI — Migration: 20261019000001_reconciliation_history.sql
--
-- Designed in accordance with Supabase Postgres Best Practices:
-- 1. Lowercase snake_case identifiers (schema-lowercase-identifiers.md)
-- 2. Foreign key index on user_id (schema-foreign-key-indexes.md)
-- 3. Composite keyset index on (user_id, created_at desc, id desc) (data-pagination.md)
-- 4. GIN index with jsonb_path_ops on sanitized snapshot (advanced-jsonb-indexing.md)
-- 5. RLS enabled & forced with (select auth.uid()) cached optimization (security-rls-basics.md, security-rls-performance.md)
-- 6. Strict ownership integrity preventing user_id reassignment on update
-- ==============================================================================

-- 1. Create table
create table if not exists public.reconciliation_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_name text not null check (char_length(trim(session_name)) > 0 and char_length(session_name) <= 255),
  is_synthetic boolean not null default false,
  
  -- Frequently queried integer metrics for fast listing without JSON parsing
  bank_row_count integer not null check (bank_row_count >= 0),
  ledger_row_count integer not null check (ledger_row_count >= 0),
  matched_pairs_count integer not null check (matched_pairs_count >= 0),
  exception_count integer not null check (exception_count >= 0),
  
  -- Authoritative integer paise amounts (never floating point)
  closing_bank_balance_paise bigint not null,
  closing_ledger_balance_paise bigint not null,
  unresolved_variance_paise bigint not null,
  is_bridge_balanced boolean not null default false,
  
  -- Immutable sanitized report snapshot (zero raw CSV text, zero raw unmasked PII)
  snapshot jsonb not null,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Performance Indexes
-- Index foreign key column to prevent sequential scans during cascading deletes / joins
create index if not exists reconciliation_history_user_id_idx 
  on public.reconciliation_history (user_id);

-- Composite index for fast, O(1) keyset-based cursor pagination of user history
create index if not exists reconciliation_history_user_created_idx 
  on public.reconciliation_history (user_id, created_at desc, id desc);

-- GIN index for efficient JSONB querying/containment if searching within snapshot metadata
create index if not exists reconciliation_history_snapshot_gin 
  on public.reconciliation_history using gin (snapshot jsonb_path_ops);

-- 3. Row Level Security (RLS) Configuration
alter table public.reconciliation_history enable row level security;
alter table public.reconciliation_history force row level security;

-- Revoke anonymous access completely (guest sessions must never persist to private history)
revoke all on public.reconciliation_history from anon;
grant select, insert, update, delete on public.reconciliation_history to authenticated;

-- Policy 1: SELECT — Users can only query their own reconciliation records
-- Wrapped in (select auth.uid()) for single-evaluation plan caching per best practices
create policy "reconciliation_history_select_own"
  on public.reconciliation_history
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Policy 2: INSERT — Users can only insert records where user_id matches their authenticated identity
create policy "reconciliation_history_insert_own"
  on public.reconciliation_history
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- Policy 3: UPDATE — Users can only update their own records and cannot reassign user_id
create policy "reconciliation_history_update_own"
  on public.reconciliation_history
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Policy 4: DELETE — Users can only delete their own records
create policy "reconciliation_history_delete_own"
  on public.reconciliation_history
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

