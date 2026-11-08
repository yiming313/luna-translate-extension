export const TARGET_LANGUAGES = [
  ['auto', '自动（中文→英文，其他→中文）'],
  ['English', 'English'],
  ['简体中文', '简体中文'],
  ['繁體中文', '繁體中文'],
  ['日本語', '日本語'],
  ['한국어', '한국어'],
  ['Français', 'Français'],
  ['Deutsch', 'Deutsch'],
  ['Español', 'Español'],
];

export const DEFAULT_TRANSLATE_PROMPT = `You are a precise, natural-sounding translator.
Translate the user's text. Keep the meaning, tone, formatting, names, numbers and code unchanged.
Output only the translation, with no explanations or quotation marks.`;

export const DEFAULT_POLISH_PROMPT = `You are an excellent writing editor.
Improve the user's text: fix grammar, word choice and flow while keeping its meaning and language.
Render your answer in Markdown as below, with nothing else:

***Warm:***
>(polished text with a warm & friendly tone)

***Neutral:***
>(polished text with a neutral & rational tone)

***Cool:***
>(polished text with a cool & chill tone)`;

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
    system += target === 'auto'
      ? '\nIf the text is mainly Chinese, translate it into English. Otherwise translate it into Simplified Chinese.'
      : `\nTranslate the text into ${target}.`;
  } else if (settings.polishLanguage && settings.polishLanguage !== 'same') {
    system += `\nWrite the polished versions in ${settings.polishLanguage}.`;
  }
  return { system, user: text };
}
