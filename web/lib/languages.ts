/** Each guard language written in its own script, for chips and tiles. */
export const NATIVE: Record<string, string> = {
  Malayalam: "മലയാളം",
  Hindi: "हिन्दी",
  Urdu: "اردو",
  Nepali: "नेपाली",
  Bengali: "বাংলা",
  Tagalog: "Tagalog",
  English: "English",
  Arabic: "العربية",
};

export const RTL_LANGUAGES = ["Arabic", "Urdu"];
export const isRtl = (language: string) => RTL_LANGUAGES.includes(language);
