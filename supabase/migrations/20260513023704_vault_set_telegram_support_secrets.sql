-- C1: Telegram support bot token + chat id'yi Vault'a yaz.
-- send-support-message edge fn verify_jwt:true ile authenticated user
-- cagirir, secret'leri vault'tan okur. Client bundle'da artik token yok.
DO $$
DECLARE
  _bot_token TEXT := '8625920772:AAEu_REPLACE_WITH_REAL_FROM_ENV';
  _chat_id TEXT := '1943990878';
  _existing UUID;
BEGIN
  -- bot token
  SELECT id INTO _existing FROM vault.secrets WHERE name = 'telegram_support_bot_token' LIMIT 1;
  IF _existing IS NOT NULL THEN
    PERFORM vault.update_secret(_existing, _bot_token, 'telegram_support_bot_token');
  ELSE
    PERFORM vault.create_secret(_bot_token, 'telegram_support_bot_token');
  END IF;

  -- chat id
  SELECT id INTO _existing FROM vault.secrets WHERE name = 'telegram_support_chat_id' LIMIT 1;
  IF _existing IS NOT NULL THEN
    PERFORM vault.update_secret(_existing, _chat_id, 'telegram_support_chat_id');
  ELSE
    PERFORM vault.create_secret(_chat_id, 'telegram_support_chat_id');
  END IF;
END $$;;
