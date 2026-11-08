// Provider adapters. Each takes (config, system, user) and resolves to the reply text.
// config: { provider, apiKey, model, baseUrl? }

export const PROVIDERS = {
  openrouter: {
    label: 'OpenRouter',
    defaultModel: 'anthropic/claude-haiku-5.5',
    models: ['anthropic/claude-haiku-5.5', 'openai/gpt-5-mini', 'google/gemini-2.5-flash'],
    baseUrl: 'https://openrouter.ai/api/v1',
    keyHint: 'sk-or-…',
    keyUrl: 'https://openrouter.ai/keys',
  },
  openai: {
    label: 'OpenAI',
    defaultModel: 'gpt-5-mini',
    models: ['gpt-5-mini', 'gpt-5', 'gpt-4.1-mini'],
    baseUrl: 'https://api.openai.com/v1',
    keyHint: 'sk-…',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  anthropic: {
    label: 'Anthropic',
    defaultModel: 'claude-haiku-5-5',
    models: ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'],
    baseUrl: 'https://api.anthropic.com/v1',
    keyHint: 'sk-ant-…',
    keyUrl: 'https://console.anthropic.com/settings/keys',
  },
  gemini: {
    label: 'Google Gemini',
    defaultModel: 'gemini-2.5-flash',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite'],
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    keyHint: 'AIza…',
    keyUrl: 'https://aistudio.google.com/apikey',
  },
};

const MAX_OUTPUT_TOKENS = 2000;

export class ProviderError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
  }
}

function baseOf(config) {
  const spec = PROVIDERS[config.provider];
  return (config.baseUrl || spec.baseUrl).replace(/\/+$/, '');
}

async function postJson(url, headers, body, signal) {
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ProviderError(`Network error: ${error.message}`);
  }
  const raw = await response.text();
  let data = null;
  try { data = JSON.parse(raw); } catch { /* non-JSON error body */ }
  if (!response.ok) {
    const detail = data?.error?.message || data?.error || data?.message || raw.slice(0, 200);
    throw new ProviderError(`${response.status}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`, response.status);
  }
  return data;
}

async function openAICompatible(config, system, user, signal) {
  const isOpenRouter = config.provider === 'openrouter';
  const body = {
    model: config.model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  };
  // Newer OpenAI models reject max_tokens; max_completion_tokens is accepted by OpenAI and OpenRouter.
  body.max_completion_tokens = MAX_OUTPUT_TOKENS;
  const headers = { Authorization: `Bearer ${config.apiKey}` };
  if (isOpenRouter) {
    headers['X-Title'] = 'Luna Translate';
  }
  const data = await postJson(`${baseOf(config)}/chat/completions`, headers, body, signal);
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) throw new ProviderError('The model returned an empty reply.');
  return text.trim();
}

async function anthropic(config, system, user, signal) {
  const data = await postJson(
    `${baseOf(config)}/messages`,
    {
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      // Required for calls made straight from a browser context.
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    {
      model: config.model,
      max_tokens: MAX_OUTPUT_TOKENS,
      system,
      messages: [{ role: 'user', content: user }],
    },
    signal,
  );
  const text = (data?.content || []).filter((part) => part.type === 'text').map((part) => part.text).join('');
  if (!text.trim()) throw new ProviderError('The model returned an empty reply.');
  return text.trim();
}

async function gemini(config, system, user, signal) {
  const model = encodeURIComponent(config.model.replace(/^models\//, ''));
  const data = await postJson(
    `${baseOf(config)}/models/${model}:generateContent`,
    { 'x-goog-api-key': config.apiKey },
    {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
    },
    signal,
  );
  const text = (data?.candidates?.[0]?.content?.parts || []).map((part) => part.text || '').join('');
  if (!text.trim()) {
    const reason = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason;
    throw new ProviderError(`The model returned an empty reply${reason ? ` (${reason})` : ''}.`);
  }
  return text.trim();
}

export async function callAI(config, system, user, signal) {
  if (!PROVIDERS[config?.provider]) throw new ProviderError('No AI provider selected. Open the extension options first.');
  if (!config.apiKey) throw new ProviderError('No API key set. Open the extension options first.');
  const model = config.model || PROVIDERS[config.provider].defaultModel;
  const full = { ...config, model };
  if (config.provider === 'anthropic') return anthropic(full, system, user, signal);
  if (config.provider === 'gemini') return gemini(full, system, user, signal);
  return openAICompatible(full, system, user, signal);
}
