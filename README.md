# Luna Translate (Chrome extension)

Translate and polish selected text in any web page, using your own AI account.
Bring one of: **OpenRouter**, **OpenAI**, **Anthropic** or **Google Gemini** API keys.

Landing page: [`docs/index.html`](docs/index.html) (self-contained, no build step; open it in a browser).

## Install (developer mode)

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and choose this folder.
3. The options page opens on first install: pick a provider, paste your key, click **Test connection**, then **Save**.

## Use

- Select text on a page, right-click, then **Luna: translate / polish**.
- Shortcuts: `Alt+T` translate selection, `Alt+P` polish selection, `Alt+L` open the popup (change at `chrome://extensions/shortcuts`).
- In text fields, the result card has a **Replace original** button.
- The toolbar popup lets you paste text directly.

## Languages

The interface follows the browser language: English (default), 简体中文 and 繁體中文 are included, and any other browser language falls back to English. To add a locale, copy `_locales/en/messages.json` to `_locales/<code>/` and translate the values (`scripts/test.mjs` checks that all locales have the same keys).

## Default prompts

The prompts are language-agnostic: the model detects the input language itself, so any language pair works.

- **Translate** returns three alternative translations (Warm / Neutral / Cool). With the default "Automatic" target, the target is the browser language; text already in that language is translated into English (Spanish if the browser language is English). Pick a fixed target language in options to override.
- **Polish** returns three improved versions in the *same language* as the input (or a language you choose).

Both prompts can be replaced in the options page.

## Providers

| Provider | Endpoint | Default model |
| --- | --- | --- |
| OpenRouter | `openrouter.ai/api/v1/chat/completions` | `anthropic/claude-haiku-5.5` |
| OpenAI | `api.openai.com/v1/chat/completions` | `gpt-6-luna` |
| Anthropic | `api.anthropic.com/v1/messages` | `claude-haiku-5-5` |
| Gemini | `generativelanguage.googleapis.com/v1beta` | `gemini-3.8-flash` |

Pick a model from the dropdown, or choose “Custom…” to type any model ID. The built-in list is only a starting point: click **Refresh list** in the options page to load the live, newest-first model list from the provider (OpenRouter needs no key; the others use your key). An optional custom base URL supports proxies and OpenAI-compatible servers (the browser asks for access to that host when you save).

## Privacy

- API keys live in `chrome.storage.local` on this device (not synced) and are only read by the background service worker. Web pages and the content script never see them.
- Selected text is sent only to the provider you chose. There is no Luna server and no analytics.
- Anthropic requests include `anthropic-dangerous-direct-browser-access`, which Anthropic requires for browser calls. Keys in an extension are as exposed as the browser profile, so use a key with a spend limit.

## Develop

```bash
node scripts/test.mjs   # offline checks with a mocked fetch
```

No build step. Plain ES modules, Manifest V3.
