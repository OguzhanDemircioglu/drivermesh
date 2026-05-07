import { demo, isDemoActive, type FeedbackChannels } from '@/demo/store';

export type { FeedbackChannels };

const DEFAULTS: FeedbackChannels = {
  email: { enabled: false, address: '' },
  push: { enabled: true },
  telegram: { enabled: false, botUsername: '', botToken: '', chatId: '' },
};

/**
 * Read the customer-feedback delivery configuration for the org. The real
 * backend storage isn't wired up yet (needs an organizations migration);
 * non-demo callers receive the safe defaults until that lands.
 */
export async function getFeedbackChannels(
  _orgId: string,
): Promise<FeedbackChannels> {
  if (isDemoActive()) return demo.feedbackChannels();
  return { ...DEFAULTS };
}

export async function saveFeedbackChannels(
  _orgId: string,
  patch: Partial<FeedbackChannels>,
): Promise<void> {
  if (isDemoActive()) {
    demo.setFeedbackChannels(patch);
    return;
  }
  // TODO: backend migration — add feedback_email, feedback_push_enabled,
  // feedback_telegram_chat_id columns to `organizations` and persist here.
}
