// Chatbot type definitions — fleet client side
//
// Backend: supabase/functions/chat-bot/

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  session_id: string;
  user_id: string;
  role: ChatRole;
  content: string;
  metadata?: {
    provider?: 'gemini' | 'cloudflare' | 'hardcoded';
    latency_ms?: number;
  } | null;
  created_at: string;
}

export interface ChatSession {
  id: string;
  user_id: string;
  organization_id: string | null;
  title: string | null;
  created_at: string;
  last_message_at: string;
}

export interface ChatBotResponse {
  sessionId: string;
  reply: string;
  provider: 'gemini' | 'cloudflare' | 'hardcoded';
}

export interface ChatBotError {
  error: 'unauthorized' | 'message_required' | 'message_too_long' | 'session_not_found' | 'internal_error';
}
