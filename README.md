# Luna Translate (Chrome extension)

Translate and polish text from the toolbar popup, using your own AI account.
Bring one of: **OpenRouter**, **OpenAI**, **Anthropic** or **Google Gemini** API keys.

Landing page: [`docs/index.html`](docs/index.html) (self-contained, no build step; open it in a browser).

## Install (developer mode)

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and choose this folder.
3. The options page opens on first install: pick a provider, paste your key, click **Test connection**, then **Save**.

## Use

Click the Luna icon in the toolbar, type or paste your text, choose **Translate** or **Polish**, and press the button (or `Ctrl/⌘ + Enter`).

The extension only works from the popup. It does not read or modify the pages you visit, and its only permission besides the AI endpoints is `storage`.

## Languages

The interface follows the browser language: English (default), 简体中文 and 繁體中文 are included, and any other browser language falls back to English. To add a locale, copy `_locales/en/messages.json` to `_locales/<code>/` and translate the values (`scripts/test.mjs` checks that all locales have the same keys).

## Default prompts

The prompts are language-agnostic: the model detects the input language itself, so any language pair works.

- **Translate** is a dictionary-style lookup. For a word or phrase it returns the headword, IPA, part of speech, meaning, definitions, synonyms, antonyms, collocations and examples, written in your *translate target* (default: the browser language; pin another language in options). If the input is already in the target language it gives equivalents in a second language (English, or the browser language when the target was pinned elsewhere). A full sentence or paragraph gets a plain, faithful translation instead of a dictionary entry.
- **Polish** returns three improved versions (Warm / Neutral / Cool) in the *same language* as the input, or in a language you choose.

Custom prompts replace the defaults in the options page. In a custom translate prompt, `{{target}}` and `{{other}}` are replaced with the two languages; a custom prompt without `{{target}}` gets a "Target language: …" line appended.

## Providers

| Provider | Endpoint | Default model |
| --- | --- | --- |
| OpenRouter | `openrouter.ai/api/v1/chat/completions` | `anthropic/claude-haiku-5.5` |
| OpenAI | `api.openai.com/v1/chat/completions` | `gpt-6-luna` |
| Anthropic | `api.anthropic.com/v1/messages` | `claude-haiku-5-5` |
| Gemini | `generativelanguage.googleapis.com/v1beta` | `gemini-3.5-flash` |

Pick a model from the dropdown, or choose “Custom…” to type any model ID. The built-in list is only a starting point: click **Refresh list** in the options page to load the live, newest-first model list from the provider (OpenRouter needs no key; the others use your key). An optional custom base URL supports proxies and OpenAI-compatible servers (the browser asks for access to that host when you save).

## Privacy

- API keys live in `chrome.storage.local` on this device (not synced) and are only read by the background service worker. Web pages and the content script never see them.
- The text you enter is sent only to the provider you chose. There is no Luna server and no analytics.
- Anthropic requests include `anthropic-dangerous-direct-browser-access`, which Anthropic requires for browser calls. Keys in an extension are as exposed as the browser profile, so use a key with a spend limit.

## Develop

```bash
node scripts/test.mjs   # offline checks with a mocked fetch
```

No build step. Plain ES modules, Manifest V3.
