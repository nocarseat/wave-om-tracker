-- v8 : traitement asynchrone des messages WhatsApp. À exécuter dans le SQL Editor (projets créés avant v8).
alter table public.wa_messages add column if not exists profile_name text;
alter table public.wa_messages add column if not exists media_id text;
alter table public.wa_messages add column if not exists mime_type text;
alter table public.wa_messages add column if not exists caption text;
alter table public.wa_messages add column if not exists attempts int not null default 0;
alter table public.wa_messages drop constraint if exists wa_messages_status_check;
alter table public.wa_messages add constraint wa_messages_status_check
  check (status in ('received', 'processing', 'handled', 'ignored', 'error'));
