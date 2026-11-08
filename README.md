# Luna Translate (Chrome extension)

Translate and polish selected text in any web page, using your own AI account.
Bring one of: **OpenRouter**, **OpenAI**, **Anthropic** or **Google Gemini** API keys.

## Install (developer mode)

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and choose this folder.
3. The options page opens on first install: pick a provider, paste your key, click **Test connection**, then **Save**.

## Use

- Select text on a page, right-click, then **Luna: translate / polish**.
- Shortcuts: `Alt+T` translate selection, `Alt+P` polish selection, `Alt+L` open the popup (change at `chrome://extensions/shortcuts`).
- In text fields, the result card has a **Replace original** button.
- The toolbar popup lets you paste text directly.

## Providers

| Provider | Endpoint | Default model |
| --- | --- | --- |
| OpenRouter | `openrouter.ai/api/v1/chat/completions` | `anthropic/claude-haiku-5.5` |
| OpenAI | `api.openai.com/v1/chat/completions` | `gpt-5-mini` |
| Anthropic | `api.anthropic.com/v1/messages` | `claude-haiku-5-5` |
| Gemini | `generativelanguage.googleapis.com/v1beta` | `gemini-2.5-flash` |

The model field is free text; change it to any model your account can use. An optional custom base URL supports proxies and OpenAI-compatible servers (the browser asks for access to that host when you save).

## Privacy

- API keys live in `chrome.storage.local` on this device (not synced) and are only read by the background service worker. Web pages and the content script never see them.
- Selected text is sent only to the provider you chose. There is no Luna server and no analytics.
- Anthropic requests include `anthropic-dangerous-direct-browser-access`, which Anthropic requires for browser calls. Keys in an extension are as exposed as the browser profile, so use a key with a spend limit.

## Develop

```bash
node scripts/test.mjs   # offline checks with a mocked fetch
```

No build step. Plain ES modules, Manifest V3.
