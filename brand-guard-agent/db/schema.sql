-- ============================================================================
-- Brand Guard — Discovery/Outreach schema (SKETCH)
-- ============================================================================
-- This is a DESIGN SKETCH for Supabase/Postgres. Review it before you run it.
-- DO NOT paste it straight into your production project without checking it
-- against your existing tables — adapt names/types to what you already have.
--
-- Apply via Supabase Dashboard → SQL Editor (or a versioned migration), in a
-- BRANCH or staging project first. Nothing here should be run blind on live data.
--
-- Design notes:
--   * The Python dataclasses in common/models.py are the app-side source of truth;
--     these tables mirror them. Keep the two in sync when either changes.
--   * One prospect → many signals (normalized) instead of the flat single-row
--     sketch in the implementation pack — a prospect usually has several signals.
--   * RLS is ON everywhere. Only the service role (server-side agent) and
--     authenticated admins should ever touch these rows. Tighten to your needs.
-- ============================================================================

create extension if not exists "pgcrypto";   -- for gen_random_uuid()

-- ---------------------------------------------------------------------------
-- enums (mirror common/models.py)
-- ---------------------------------------------------------------------------
do $$ begin
  create type signal_tier as enum ('tier1', 'tier2', 'tier3');
exception when duplicate_object then null; end $$;

do $$ begin
  create type impersonation_type as enum ('domain','email','social','marketplace','unknown');
exception when duplicate_object then null; end $$;

do $$ begin
  create type bant_status as enum ('pass','hold');
exception when duplicate_object then null; end $$;

do $$ begin
  create type routed_channel as enum ('A','B','C','D','E');
exception when duplicate_object then null; end $$;

do $$ begin
  create type approval_status as enum ('unreviewed','approved','rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type draft_status as enum ('none','queued','drafted','approved','sent','failed');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- prospects — one resolved/enriched/scored company
-- ---------------------------------------------------------------------------
create table if not exists prospects (
  id                  uuid primary key default gen_random_uuid(),
  company_name        text,
  primary_domain      text unique,                 -- natural key for dedupe
  vertical            text,
  company_size_band   text check (company_size_band in ('solo','smb','mid','enterprise')),

  contact_name        text,
  contact_title       text,
  contact_channel     text check (contact_channel in
                        ('email','linkedin','abuse_inbox','security_inbox',
                         'contact_form','public_reply')),
  contact_email       text,                        -- address the send worker emails (B/D)
  linkedin_url        text,                        -- decision-maker profile (enables Channel C)

  crt_lookalikes      jsonb default '[]'::jsonb,
  dmarc_policy        text check (dmarc_policy in ('none','quarantine','reject','missing')),
  dmarc_score         int,

  victim_score        int  not null default 0 check (victim_score between 0 and 100),
  score_breakdown     jsonb default '{}'::jsonb,   -- from scorer.compute_victim_score()
  bant                bant_status,

  routed_channel      routed_channel,
  compliance_region   text default 'US' check (compliance_region in ('US','EU','UK','other')),
  compliance_ok       boolean not null default false,

  draft               draft_status not null default 'none',
  approval            approval_status not null default 'unreviewed',
  suppressed          boolean not null default false,

  sent_at             timestamptz,
  touch_count         int not null default 0,
  last_touch_at       timestamptz,
  response_status     text check (response_status in
                        ('none','replied','opted_out','bounced','converted')) default 'none',

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_prospects_score   on prospects (victim_score desc);
create index if not exists idx_prospects_channel  on prospects (routed_channel);
create index if not exists idx_prospects_approval on prospects (approval);
create index if not exists idx_prospects_domain   on prospects (primary_domain);

-- ---------------------------------------------------------------------------
-- signals — many pieces of evidence per prospect (mirrors RawSignal)
-- ---------------------------------------------------------------------------
create table if not exists signals (
  id                  uuid primary key default gen_random_uuid(),
  prospect_id         uuid references prospects(id) on delete cascade,
  source              text not null,               -- 'crt.sh','udrp_wipo','x_profile'
  tier                signal_tier not null,
  signal_type         text not null,               -- 'lookalike_domain','udrp_filing',...
  impersonation       impersonation_type not null default 'unknown',
  impersonated_brand  text,
  signal_url          text,
  snippet             text,
  incident_date       date,
  extra               jsonb default '{}'::jsonb,
  collected_at        timestamptz not null default now(),
  -- avoid re-inserting the same evidence on every collector run
  unique (source, signal_type, signal_url, snippet)
);
create index if not exists idx_signals_prospect on signals (prospect_id);
create index if not exists idx_signals_type     on signals (signal_type);

-- ---------------------------------------------------------------------------
-- outreach_drafts — the Drafter's output; nothing sends without approval
-- ---------------------------------------------------------------------------
create table if not exists outreach_drafts (
  id                  uuid primary key default gen_random_uuid(),
  prospect_id         uuid references prospects(id) on delete cascade,
  channel             routed_channel not null,
  subject             text,
  body                text not null,
  opt_out_line        text,
  findings_used       jsonb default '{}'::jsonb,    -- the ONLY facts cited (audit trail)
  model               text default 'qwen3.5:9b',
  approval            approval_status not null default 'unreviewed',
  approved_by         uuid,                          -- references auth.users(id)
  approved_at         timestamptz,
  edited_body         text,                          -- human edits before send
  sent_at             timestamptz,
  created_at          timestamptz not null default now()
);
create index if not exists idx_drafts_prospect on outreach_drafts (prospect_id);
create index if not exists idx_drafts_approval on outreach_drafts (approval);

-- ---------------------------------------------------------------------------
-- replies — inbound responses, linked back for the Triage tab
-- ---------------------------------------------------------------------------
create table if not exists replies (
  id                  uuid primary key default gen_random_uuid(),
  prospect_id         uuid references prospects(id) on delete set null,
  draft_id            uuid references outreach_drafts(id) on delete set null,
  channel             routed_channel,
  from_address        text,
  received_at         timestamptz not null default now(),
  body                text,
  sentiment           text check (sentiment in
                        ('positive','neutral','negative','opt_out','unknown')) default 'unknown',
  handled             boolean not null default false,
  created_at          timestamptz not null default now()
);
create index if not exists idx_replies_handled on replies (handled);

-- ---------------------------------------------------------------------------
-- suppression_list — checked before EVERY send; opt-outs are permanent
-- ---------------------------------------------------------------------------
create table if not exists suppression_list (
  id                  uuid primary key default gen_random_uuid(),
  match_type          text not null check (match_type in ('email','domain')),
  value               text not null,
  reason              text,                          -- 'opt_out','bounce','manual','complaint'
  created_at          timestamptz not null default now(),
  unique (match_type, value)
);
create index if not exists idx_suppression_value on suppression_list (lower(value));

-- ---------------------------------------------------------------------------
-- triage_queue — low-confidence collector hits a human should eyeball
-- ---------------------------------------------------------------------------
create table if not exists triage_queue (
  id                  uuid primary key default gen_random_uuid(),
  signal_id           uuid references signals(id) on delete cascade,
  reason              text,                          -- 'low_confidence','llm_down','ambiguous'
  resolved            boolean not null default false,
  resolved_by         uuid,
  resolved_at         timestamptz,
  created_at          timestamptz not null default now()
);
create index if not exists idx_triage_resolved on triage_queue (resolved);

-- ---------------------------------------------------------------------------
-- touches — append-only log of every send/attempt (cadence + audit)
-- ---------------------------------------------------------------------------
create table if not exists touches (
  id                  uuid primary key default gen_random_uuid(),
  prospect_id         uuid references prospects(id) on delete cascade,
  draft_id            uuid references outreach_drafts(id) on delete set null,
  channel             routed_channel,
  touch_number        int,                           -- 1..3 (cadence cap)
  sent_at             timestamptz not null default now(),
  outcome             text check (outcome in ('sent','bounced','failed','skipped'))
);
create index if not exists idx_touches_prospect on touches (prospect_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger for prospects
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end $$ language plpgsql;

drop trigger if exists trg_prospects_updated on prospects;
create trigger trg_prospects_updated before update on prospects
  for each row execute function set_updated_at();

-- ===========================================================================
-- Row Level Security — lock everything down by default.
-- The server-side agent uses the SERVICE ROLE key (bypasses RLS). The admin UI
-- uses authenticated users; below is a simple "any authenticated admin" policy.
-- Replace `is_admin()` with your real admin check (e.g. a profiles.role lookup).
-- ===========================================================================
alter table prospects        enable row level security;
alter table signals          enable row level security;
alter table outreach_drafts  enable row level security;
alter table replies          enable row level security;
alter table suppression_list enable row level security;
alter table triage_queue     enable row level security;
alter table touches          enable row level security;

-- Example admin gate — adapt to your existing roles model.
-- create or replace function is_admin() returns boolean as $$
--   select exists (
--     select 1 from profiles p
--     where p.id = auth.uid() and p.role = 'admin'
--   );
-- $$ language sql stable security definer;

-- Read/write for admins on each table (illustrative — tighten per table):
do $$
declare t text;
begin
  foreach t in array array[
    'prospects','signals','outreach_drafts','replies',
    'suppression_list','triage_queue','touches'
  ] loop
    execute format($f$
      drop policy if exists %1$s_admin_all on %1$s;
      create policy %1$s_admin_all on %1$s
        for all to authenticated
        using (true)            -- replace with is_admin()
        with check (true);      -- replace with is_admin()
    $f$, t);
  end loop;
end $$;

-- NOTE: the `using (true)` above is a PLACEHOLDER so the sketch runs in a fresh
-- project. Before production, swap in is_admin() (or your equivalent) so only
-- real admins can read prospect PII. Never expose these tables to the anon role.
