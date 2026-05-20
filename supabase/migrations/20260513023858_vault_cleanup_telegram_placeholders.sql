-- vault.delete_secret(uuid) yok; direkt DELETE.
-- Onceki migration bu iki secret'a placeholder yazmisti. Dogru yol:
-- Edge Function Secrets (Dashboard -> Project Settings -> Edge Functions
-- -> Secrets) — token vault'a degil, edge runtime env'ine eklenir.
DELETE FROM vault.secrets WHERE name = 'telegram_support_bot_token';
DELETE FROM vault.secrets WHERE name = 'telegram_support_chat_id';;
