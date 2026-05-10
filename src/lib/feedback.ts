import { supabase } from './supabase';
import { demo, isDemoActive, type FeedbackChannels } from '@/demo/store';

export type { FeedbackChannels };

const DEFAULTS: FeedbackChannels = {
  email: { enabled: false, address: '' },
  push: { enabled: true },
  telegram: { enabled: false, botUsername: '', botToken: '', chatId: '' },
};

/**
 * Read the customer-feedback delivery configuration for the org.
 * Production: organizations.feedback_* kolonlarından okur (migration
 * organizations_feedback_columns ile eklendi). Demo: in-memory store.
 */
export async function getFeedbackChannels(orgId: string): Promise<FeedbackChannels> {
  if (isDemoActive()) return demo.feedbackChannels();

  const { data, error } = await supabase
    .from('organizations')
    .select(
      'feedback_email_address, feedback_email_enabled, feedback_push_enabled, feedback_telegram_enabled, feedback_telegram_bot_username, feedback_telegram_bot_token, feedback_telegram_chat_id',
    )
    .eq('id', orgId)
    .maybeSingle();
  if (error || !data) return { ...DEFAULTS };
  return {
    email: {
      enabled: data.feedback_email_enabled,
      address: data.feedback_email_address ?? '',
    },
    push: { enabled: data.feedback_push_enabled },
    telegram: {
      enabled: data.feedback_telegram_enabled,
      botUsername: data.feedback_telegram_bot_username ?? '',
      botToken: data.feedback_telegram_bot_token ?? '',
      chatId: data.feedback_telegram_chat_id ?? '',
    },
  };
}

export async function saveFeedbackChannels(
  orgId: string,
  patch: Partial<FeedbackChannels>,
): Promise<void> {
  if (isDemoActive()) {
    demo.setFeedbackChannels(patch);
    return;
  }
  // Patch'i kolon-formatına çevir. Yalnızca verilen alanlar güncellenir.
  const update: Record<string, unknown> = {};
  if (patch.email) {
    if (typeof patch.email.enabled === 'boolean')
      update.feedback_email_enabled = patch.email.enabled;
    if (typeof patch.email.address === 'string')
      update.feedback_email_address = patch.email.address.trim() || null;
  }
  if (patch.push) {
    if (typeof patch.push.enabled === 'boolean')
      update.feedback_push_enabled = patch.push.enabled;
  }
  if (patch.telegram) {
    if (typeof patch.telegram.enabled === 'boolean')
      update.feedback_telegram_enabled = patch.telegram.enabled;
    if (typeof patch.telegram.botUsername === 'string')
      update.feedback_telegram_bot_username = patch.telegram.botUsername.trim() || null;
    if (typeof patch.telegram.botToken === 'string')
      update.feedback_telegram_bot_token = patch.telegram.botToken.trim() || null;
    if (typeof patch.telegram.chatId === 'string')
      update.feedback_telegram_chat_id = patch.telegram.chatId.trim() || null;
  }
  if (Object.keys(update).length === 0) return;
  const { error } = await supabase
    .from('organizations')
    .update(update as never)
    .eq('id', orgId);
  if (error) throw error;
}
