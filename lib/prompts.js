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

// {{target}} = the language the user wants answers in (the "translate target" setting; "Automatic" = the browser language).
// {{other}} = the language used for equivalents when the input is already in {{target}} (English, or the browser language
// when the target was pinned to something else). buildRequest() fills both in.
export const DEFAULT_TRANSLATE_PROMPT = `You are a precise multilingual dictionary and vocabulary teacher.
The user will provide a word, phrase or short expression in any language. Detect its language automatically.
Write the whole entry (field names, headings, explanations, translations) in {{target}}. Do not describe your process.
- If the input is not in {{target}}: explain it in {{target}} and show natural usage in the input's own language.
- If the input is already in {{target}}: give the most useful equivalent(s) in {{other}} and explain the differences when there is more than one.
If the input is a full sentence or a paragraph rather than a word or phrase, skip the dictionary format and return only a natural, faithful translation into {{target}} (into {{other}} if it is already in {{target}}), keeping names, numbers, formatting and code unchanged.
Return a concise, accurate dictionary entry in Markdown using this structure (translate the field names and headings into {{target}}):
### Word
**Headword:** (the word, or the best equivalent in {{other}} when the input is in {{target}})
**IPA:** (American and/or British pronunciation in IPA for English, or the standard pronunciation guide for the headword's language; include both variants when useful)
**Part of speech:** (the part of speech, in {{target}})
**Meaning:** (the main meaning in {{target}})

### Definition
***Headword language:***
>(a concise definition in the headword's own language)

***{{target}}:***
>(a concise definition in {{target}})

### Synonyms
- (useful synonyms with brief distinctions when helpful)

### Antonyms
- (natural antonyms; write "None commonly used" in {{target}} when there is no useful antonym)

### Collocations
- (common collocations or related phrases)

### Examples
***Example 1:***
>(a natural example sentence in the headword's language)
>(its translation into {{target}})

***Example 2:***
>(a natural example sentence in the headword's language)
>(its translation into {{target}})

Keep the answer practical and easy to scan. Do not invent a pronunciation, synonym, antonym, or usage that is not appropriate for the requested word.`;

export const DEFAULT_POLISH_PROMPT = `You are an excellent writing teacher and editor who is fluent in every language.
Detect the language of the user's text automatically, whatever it is.
Correct and improve the text (grammar, word choice, clarity, flow) and provide multiple alternative versions of it, written in the same language as the original unless told otherwise at the end of these instructions.
Keep the original meaning, names, numbers and formatting.
${OUTPUT_FORMAT}`;

export const MODES = {
  translate: { labelKey: 'modeTranslate', defaultPrompt: DEFAULT_TRANSLATE_PROMPT },
  polish: { labelKey: 'modePolish', defaultPrompt: DEFAULT_POLISH_PROMPT },
};

/** Language the translate answer is written in, and the "other" language used for equivalents. */
export function resolveLanguages(settings) {
  const primary = settings.primaryLanguage || 'English';
  const target = settings.targetLanguage && settings.targetLanguage !== 'auto' ? settings.targetLanguage : primary;
  const other = target === primary ? (primary === 'English' ? 'Español' : 'English') : primary;
  return { target, other };
}

export function buildRequest(mode, text, settings) {
  const spec = MODES[mode];
  if (!spec) throw new Error(`Unknown mode: ${mode}`);
  const custom = mode === 'translate' ? settings.translatePrompt : settings.polishPrompt;
  let system = (custom && custom.trim()) || spec.defaultPrompt;
  if (mode === 'translate') {
    const { target, other } = resolveLanguages(settings);
    const hadTokens = system.includes('{{target}}');
    system = system.replaceAll('{{target}}', target).replaceAll('{{other}}', other);
    // Custom prompts without tokens still get the target language appended.
    if (!hadTokens) system += `\nTarget language: ${target}. If the text is already in ${target}, translate it into ${other} instead.`;
  } else if (settings.polishLanguage && settings.polishLanguage !== 'same') {
    system += `\nWrite the polished versions in ${settings.polishLanguage}.`;
  }
  return { system, user: text };
}
