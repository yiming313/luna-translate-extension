// Provider adapters. Each takes (config, system, user) and resolves to the reply text.
// config: { provider, apiKey, model, baseUrl? }

export const PROVIDERS = {
  openrouter: {
    label: 'OpenRouter',
    defaultModel: 'anthropic/claude-haiku-5.5',
    models: ['anthropic/claude-haiku-5.5', 'anthropic/claude-sonnet-5.5', 'openai/gpt-6-luna', 'openai/gpt-6.1-terra', 'openai/gpt-6.1-sol', 'google/gemini-3.8-flash', 'google/gemini-4-argon'],
    baseUrl: 'https://openrouter.ai/api/v1',
    keyHint: 'sk-or-…',
    keyUrl: 'https://openrouter.ai/keys',
  },
  openai: {
    label: 'OpenAI',
    defaultModel: 'gpt-6-luna',
    models: ['gpt-6-luna', 'gpt-6.1-terra', 'gpt-6.1-sol', 'gpt-6-sol', 'gpt-5.5'],
    baseUrl: 'https://api.openai.com/v1',
    keyHint: 'sk-…',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  anthropic: {
    label: 'Anthropic',
    defaultModel: 'claude-haiku-5-5',
    models: ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5', 'claude-fable-5-1'],
    baseUrl: 'https://api.anthropic.com/v1',
    keyHint: 'sk-ant-…',
    keyUrl: 'https://console.anthropic.com/settings/keys',
  },
  gemini: {
    label: 'Google Gemini',
    defaultModel: 'gemini-3.5-flash',
    models: ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-4-argon', 'gemini-3.1-pro-preview'],
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    keyHint: 'AIza…',
    keyUrl: 'https://aistudio.google.com/apikey',
  },
};

const MAX_OUTPUT_TOKENS = 2000;
const TIMEOUT_MS = 60000;

/** Combines the caller's abort signal with a request timeout so a stalled server cannot hang the UI. */
function withTimeout(signal) {
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

export class ProviderError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
  }
}

/** Throws unless `value` is https (plain http is allowed only for loopback hosts). */
export function assertSafeBaseUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new ProviderError('The custom endpoint is not a valid URL.'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    throw new ProviderError('The custom endpoint must use https (http is only allowed for localhost).');
  }
  if (url.username || url.password) throw new ProviderError('The custom endpoint must not contain credentials.');
  return url.href.replace(/\/+$/, '');
}

function baseOf(config) {
  const spec = PROVIDERS[config.provider];
  return config.baseUrl ? assertSafeBaseUrl(config.baseUrl) : spec.baseUrl;
}

/** Runs fn and removes the API key from any error text, in case a server echoes it back. */
async function scrubbed(config, fn) {
  try {
    return await fn();
  } catch (error) {
    if (config?.apiKey && config.apiKey.length >= 8 && typeof error?.message === 'string' && error.message.includes(config.apiKey)) {
      error.message = error.message.split(config.apiKey).join('***');
    }
    throw error;
  }
}

async function postJson(url, headers, body, signal) {
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      redirect: 'error', // never forward the key to a redirect target
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: withTimeout(signal),
    });
  } catch (error) {
    if (error.name === 'TimeoutError') throw new ProviderError('The provider did not respond within 60 seconds. Try another model.');
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

export function callAI(config, system, user, signal) {
  return scrubbed(config, () => callAIUnscrubbed(config, system, user, signal));
}

async function callAIUnscrubbed(config, system, user, signal) {
  if (!PROVIDERS[config?.provider]) throw new ProviderError('No AI provider selected. Open the extension options first.');
  if (!config.apiKey) throw new ProviderError('No API key set. Open the extension options first.');
  const model = config.model || PROVIDERS[config.provider].defaultModel;
  const full = { ...config, model };
  if (config.provider === 'anthropic') return anthropic(full, system, user, signal);
  if (config.provider === 'gemini') return gemini(full, system, user, signal);
  return openAICompatible(full, system, user, signal);
}

// ---- Live model lists -------------------------------------------------------------------------
// The built-in `models` arrays go stale, so the options page can ask each provider for its real list.

async function getJson(url, headers, signal) {
  let response;
  try {
    response = await fetch(url, { headers, signal: withTimeout(signal), redirect: 'error' });
  } catch (error) {
    if (error.name === 'TimeoutError') throw new ProviderError('The provider did not respond within 60 seconds. Try another model.');
    if (error.name === 'AbortError') throw error;
    throw new ProviderError(`Network error: ${error.message}`);
  }
  const raw = await response.text();
  let data = null;
  try { data = JSON.parse(raw); } catch { /* ignore */ }
  if (!response.ok) {
    const detail = data?.error?.message || data?.error || data?.message || raw.slice(0, 200);
    throw new ProviderError(`${response.status}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`, response.status);
  }
  return data;
}

const NOT_CHAT = /embed|tts|whisper|transcri|moderation|dall-e|sora|image|audio|realtime|speech|imagen|veo|aqa|robotics|computer-use|search-preview/i;
// On OpenRouter (hundreds of models) list the big three vendors first, each newest first.
const MAJOR_VENDORS = ['openai/', 'anthropic/', 'google/'];
const vendorRank = (id) => { const i = MAJOR_VENDORS.findIndex((v) => id.startsWith(v)); return i === -1 ? MAJOR_VENDORS.length : 0; };
const byNewest = (a, b) => (b.created || 0) - (a.created || 0);
const compareNames = (a, b) => b.localeCompare(a, 'en', { numeric: true });

/** Returns model IDs usable for chat, newest first. */
export function listModels(config, signal) {
  return scrubbed(config, () => listModelsUnscrubbed(config, signal));
}

async function listModelsUnscrubbed(config, signal) {
  const spec = PROVIDERS[config?.provider];
  if (!spec) throw new ProviderError('No AI provider selected.');
  const base = baseOf(config);
  let ids;
  if (config.provider === 'openrouter') {
    const data = await getJson(`${base}/models`, config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}, signal);
    ids = (data?.data || [])
      .filter((m) => !m.id.endsWith(':batch') && (m.architecture?.output_modalities || ['text']).join() === 'text')
      .sort((a, b) => vendorRank(a.id) - vendorRank(b.id) || byNewest(a, b)).map((m) => m.id);
  } else if (!config.apiKey) {
    throw new ProviderError('No API key set.');
  } else if (config.provider === 'openai') {
    const data = await getJson(`${base}/models`, { Authorization: `Bearer ${config.apiKey}` }, signal);
    ids = (data?.data || []).filter((m) => /^(gpt|o\d|chatgpt)/.test(m.id) && !NOT_CHAT.test(m.id)).sort(byNewest).map((m) => m.id);
  } else if (config.provider === 'anthropic') {
    const data = await getJson(`${base}/models?limit=1000`, { 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, signal);
    ids = (data?.data || []).map((m) => ({ id: m.id, created: Date.parse(m.created_at) || 0 })).sort(byNewest).map((m) => m.id);
  } else {
    const data = await getJson(`${base}/models?pageSize=1000`, { 'x-goog-api-key': config.apiKey }, signal);
    ids = (data?.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''))
      .filter((id) => id.startsWith('gemini') && !NOT_CHAT.test(id))
      .sort(compareNames);
  }
  if (!ids.length) throw new ProviderError('The provider returned no usable models.');
  return ids;
}
