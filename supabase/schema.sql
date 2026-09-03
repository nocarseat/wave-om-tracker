-- Wave & Orange Money expense tracker
-- Run this whole file in the Supabase SQL editor (Dashboard > SQL Editor > New query > Run).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user). ingest_token authenticates the SMS webhook.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  ingest_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Accounts: one Wave and one Orange Money wallet per user (more can be added)
-- ---------------------------------------------------------------------------
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('wave', 'orange_money')),
  label text not null,
  phone text,
  created_at timestamptz not null default now()
);
create index if not exists accounts_user_idx on public.accounts (user_id);

-- ---------------------------------------------------------------------------
-- Categories (seeded per user at signup, editable)
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  kind text not null default 'expense' check (kind in ('expense', 'income')),
  sort_order int not null default 100,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- ---------------------------------------------------------------------------
-- Transactions. Amounts are whole XOF (no decimals).
-- ---------------------------------------------------------------------------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete set null,
  provider text not null check (provider in ('wave', 'orange_money', 'other')),
  direction text not null check (direction in ('debit', 'credit')),
  amount numeric(14, 0) not null check (amount >= 0),
  fee numeric(14, 0) not null default 0,
  counterparty text,
  category_id uuid references public.categories (id) on delete set null,
  kind text not null default 'other'
    check (kind in ('transfer', 'payment', 'withdrawal', 'deposit', 'airtime', 'bill', 'other')),
  occurred_at timestamptz not null default now(),
  source text not null default 'manual'
    check (source in ('manual', 'sms', 'screenshot', 'receipt')),
  reference text,
  balance_after numeric(14, 0),
  raw_text text,
  note text,
  fingerprint text,
  created_at timestamptz not null default now()
);
create index if not exists transactions_user_date_idx on public.transactions (user_id, occurred_at desc);
create unique index if not exists transactions_fingerprint_idx
  on public.transactions (user_id, fingerprint) where fingerprint is not null;

-- ---------------------------------------------------------------------------
-- Budgets: one amount per category per month (month = first day of month)
-- ---------------------------------------------------------------------------
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  month date not null,
  amount numeric(14, 0) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, category_id, month)
);

-- ---------------------------------------------------------------------------
-- Merchant rules: learned counterparty -> category mapping
-- ---------------------------------------------------------------------------
create table if not exists public.merchant_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pattern text not null,
  category_id uuid not null references public.categories (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, pattern)
);

-- ---------------------------------------------------------------------------
-- Inbound SMS log (everything the webhook receives, parsed or not)
-- ---------------------------------------------------------------------------
create table if not exists public.inbound_sms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  sender text,
  body text not null,
  received_at timestamptz not null default now(),
  status text not null default 'received'
    check (status in ('received', 'parsed', 'duplicate', 'ignored', 'error')),
  transaction_id uuid references public.transactions (id) on delete set null,
  error text
);
create index if not exists inbound_sms_user_idx on public.inbound_sms (user_id, received_at desc);

-- ---------------------------------------------------------------------------
-- Row level security: every user only sees their own rows
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.merchant_rules enable row level security;
alter table public.inbound_sms enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own accounts" on public.accounts;
create policy "own accounts" on public.accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own categories" on public.categories;
create policy "own categories" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own transactions" on public.transactions;
create policy "own transactions" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own budgets" on public.budgets;
create policy "own budgets" on public.budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own merchant rules" on public.merchant_rules;
create policy "own merchant rules" on public.merchant_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own inbound sms" on public.inbound_sms;
create policy "own inbound sms" on public.inbound_sms
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Signup trigger: profile + two wallets + default categories
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));

  insert into public.accounts (user_id, provider, label) values
    (new.id, 'wave', 'Wave'),
    (new.id, 'orange_money', 'Orange Money');

  insert into public.categories (user_id, name, kind, sort_order) values
    (new.id, 'Alimentation', 'expense', 10),
    (new.id, 'Transport', 'expense', 20),
    (new.id, 'Logement', 'expense', 30),
    (new.id, 'Factures', 'expense', 40),
    (new.id, 'Crédit téléphonique', 'expense', 50),
    (new.id, 'Santé', 'expense', 60),
    (new.id, 'Éducation', 'expense', 70),
    (new.id, 'Famille et transferts', 'expense', 80),
    (new.id, 'Loisirs', 'expense', 90),
    (new.id, 'Vêtements', 'expense', 100),
    (new.id, 'Retrait cash', 'expense', 110),
    (new.id, 'Frais opérateur', 'expense', 120),
    (new.id, 'Autre', 'expense', 130),
    (new.id, 'Revenus', 'income', 200),
    (new.id, 'Dépôt', 'income', 210);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
