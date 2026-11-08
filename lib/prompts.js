export const TARGET_LANGUAGES = [
  ['auto', '默认（英文润色，其他语言译成英文）'],
  ['English', 'English'],
  ['简体中文', '简体中文'],
  ['繁體中文', '繁體中文'],
  ['日本語', '日本語'],
  ['한국어', '한국어'],
  ['Français', 'Français'],
  ['Deutsch', 'Deutsch'],
  ['Español', 'Español'],
];

// Same prompt as the Luna website's Translate page (public/app.js DEFAULT_PROMPT).
// English input is polished into alternatives; other languages are translated into English.
export const SITE_PROMPT = `You are an excellent English teacher.
Your goal is to help the user correct their English words or sentences.
When provided with English words or sentences, you will provide multiple alternatives to the original text to improve it.
When provided with words or sentences in languages other than English, you will provide multiple alternative English translations to the original text.
Render your answer in Markdown format as below:
- ### Casual Tone
    ***Warm:***
    >(translation with warm & friendly tone)

    ***Neutral:***
    >(translation with neutral & rational tone)

    ***Cool:***
    >(translation with cool and chill tone)`;

export const DEFAULT_TRANSLATE_PROMPT = SITE_PROMPT;
export const DEFAULT_POLISH_PROMPT = SITE_PROMPT;

export const MODES = {
  translate: { label: '翻译', defaultPrompt: DEFAULT_TRANSLATE_PROMPT },
  polish: { label: '润色', defaultPrompt: DEFAULT_POLISH_PROMPT },
};

export function buildRequest(mode, text, settings) {
  const spec = MODES[mode];
  if (!spec) throw new Error(`Unknown mode: ${mode}`);
  const custom = mode === 'translate' ? settings.translatePrompt : settings.polishPrompt;
  let system = (custom && custom.trim()) || spec.defaultPrompt;
  if (mode === 'translate') {
    const target = settings.targetLanguage || 'auto';
    if (target !== 'auto') system += `\nAlways write the answer in ${target}.`;
  } else if (settings.polishLanguage && settings.polishLanguage !== 'same') {
    system += `\nWrite the polished versions in ${settings.polishLanguage}.`;
  }
  return { system, user: text };
}
