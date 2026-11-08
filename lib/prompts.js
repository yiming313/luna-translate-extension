// Language names shown in the options page. The model understands any language;
// this list only feeds the dropdowns, and the default prompts do not depend on it.
export const LANGUAGES = [
  ['简体中文', '简体中文'],
  ['繁體中文', '繁體中文'],
  ['English', 'English'],
  ['日本語', '日本語'],
  ['한국어', '한국어'],
  ['Français', 'Français'],
  ['Deutsch', 'Deutsch'],
  ['Español', 'Español'],
  ['Português', 'Português'],
  ['Italiano', 'Italiano'],
  ['Русский', 'Русский'],
  ['العربية', 'العربية'],
  ['हिन्दी', 'हिन्दी'],
  ['Bahasa Indonesia', 'Bahasa Indonesia'],
  ['Tiếng Việt', 'Tiếng Việt'],
  ['ไทย', 'ไทย'],
  ['Türkçe', 'Türkçe'],
];

const OUTPUT_FORMAT = `Render your answer in Markdown format as below:
- ### Casual Tone
    ***Warm:***
    >(version with warm & friendly tone)

    ***Neutral:***
    >(version with neutral & rational tone)

    ***Cool:***
    >(version with cool and chill tone)`;

// Language-agnostic: the model detects the input language itself.
export const DEFAULT_TRANSLATE_PROMPT = `You are an excellent translator who is fluent in every language.
Detect the language of the user's text automatically, whatever it is.
Provide multiple alternative translations of the text into the target language given at the end of these instructions.
Keep the meaning, names, numbers, formatting and code unchanged, and sound natural to a native speaker.
${OUTPUT_FORMAT}`;

export const DEFAULT_POLISH_PROMPT = `You are an excellent writing teacher and editor who is fluent in every language.
Detect the language of the user's text automatically, whatever it is.
Correct and improve the text (grammar, word choice, clarity, flow) and provide multiple alternative versions of it, written in the same language as the original unless told otherwise at the end of these instructions.
Keep the original meaning, names, numbers and formatting.
${OUTPUT_FORMAT}`;

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
    const primary = settings.primaryLanguage || '简体中文';
    system += target === 'auto'
      ? `\nTarget language: ${primary}. If the text is already in ${primary}, translate it into English instead.`
      : `\nTarget language: ${target}.`;
  } else if (settings.polishLanguage && settings.polishLanguage !== 'same') {
    system += `\nWrite the polished versions in ${settings.polishLanguage}.`;
  }
  return { system, user: text };
}
