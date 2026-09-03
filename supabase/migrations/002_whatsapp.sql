-- v7 : canal WhatsApp. À exécuter dans le SQL Editor Supabase (projet existant).
-- Les nouvelles installations ont déjà tout via supabase/schema.sql.

alter table public.profiles add column if not exists wa_phone text unique;
alter table public.profiles add column if not exists pairing_code text;
alter table public.profiles add column if not exists pairing_expires_at timestamptz;

-- Journal des messages WhatsApp reçus (déduplication des relances Meta via wa_message_id)
create table if not exists public.wa_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  wa_from text not null,
  wa_message_id text not null unique,
  type text not null,
  body text,
  status text not null default 'received'
    check (status in ('received', 'handled', 'ignored', 'error')),
  reply text,
  received_at timestamptz not null default now()
);
create index if not exists wa_messages_user_idx on public.wa_messages (user_id, received_at desc);

alter table public.wa_messages enable row level security;
drop policy if exists "own wa messages" on public.wa_messages;
create policy "own wa messages" on public.wa_messages
  for select using (auth.uid() = user_id);
