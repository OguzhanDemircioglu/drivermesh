alter table public.organizations
  add column if not exists feedback_email_address     text,
  add column if not exists feedback_email_enabled     boolean not null default true,
  add column if not exists feedback_push_enabled      boolean not null default true,
  add column if not exists feedback_telegram_enabled  boolean not null default false,
  add column if not exists feedback_telegram_bot_username text,
  add column if not exists feedback_telegram_bot_token text,
  add column if not exists feedback_telegram_chat_id  text;;
