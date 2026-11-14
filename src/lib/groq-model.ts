import Groq from 'groq-sdk';

/**
 * Single source of truth for the Groq chat model.
 *
 * Groq retired `llama-3.1-8b-instant` and `llama-3.3-70b-versatile` for
 * Free/Developer accounts on 2026-08-16 (they are Enterprise-only since
 * then), and `llama3-8b-8192` / `llama3-70b-8192` were shut down too.
 * `openai/gpt-oss-120b` is Groq's recommended Production replacement and
 * supports tool calling. See https://console.groq.com/docs/deprecations
 */
export const GROQ_MODEL = 'openai/gpt-oss-120b';

/** Cheaper/faster fallback if the primary model is ever unavailable. */
export const GROQ_MODEL_FALLBACK = 'openai/gpt-oss-20b';

type ChatParams = Parameters<Groq['chat']['completions']['create']>[0];

/**
 * Call Groq chat completions with the current model. If the model itself is
 * gone (404 / model_not_found), retry once with the fallback model instead
 * of failing every query. Any other error is rethrown untouched.
 *
 * We never request streaming, so the result is always a ChatCompletion.
 */
export async function groqChat(
  groq: Groq,
  params: Omit<ChatParams, 'model'>
): Promise<Groq.Chat.Completions.ChatCompletion> {
  const call = (model: string) =>
    groq.chat.completions.create({ ...params, model } as ChatParams) as Promise<Groq.Chat.Completions.ChatCompletion>;
  try {
    return await call(GROQ_MODEL);
  } catch (e: any) {
    const message = String(e?.message || '');
    const isModelGone =
      e?.status === 404 ||
      message.includes('model_not_found') ||
      message.includes('does not exist');
    if (!isModelGone) throw e;
    console.warn(`[Groq] Model ${GROQ_MODEL} unavailable, retrying with ${GROQ_MODEL_FALLBACK}`);
    return await call(GROQ_MODEL_FALLBACK);
  }
}

/**
 * Turn a raw Groq SDK error into one short human-readable line.
 * Never returns raw JSON — the SDK message often embeds a JSON blob.
 */
export function cleanGroqErrorMessage(error: any): string {
  const nested = error?.error?.error?.message;
  const raw = String(nested || error?.message || 'Unknown error');
  // SDK messages look like: 404 {"error":{"message":"The model ... does not exist..."}}
  // Prefer the inner message; otherwise strip anything from the first '{'.
  const withoutJson = raw.includes('{') ? raw.slice(0, raw.indexOf('{')).trim() : raw;
  return withoutJson || 'Unknown error';
}
