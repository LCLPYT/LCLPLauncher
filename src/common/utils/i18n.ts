import { formatString, replacePluralizationTokens } from './formatter';

export type LanguageItem = {
    /** Language name in the language itself */
    localizedName: string
}
export type LanguageRegistry = Record<string, LanguageItem>;

/**
 * An enumeration of registered languages.
 * Used for the language option in the settings.
 * Additionally, if the user tries to load a language not in this list, no error is logged.
 * The names must match the with filename in the static/ directory, without extension.
 */
export const registeredLanguages = Object.freeze<LanguageRegistry>({
    'en': {
        localizedName: 'English'
    },
    'de': {
        localizedName: 'Deutsch'
    }
});

export type Translations = Record<string, string>;
export type LanguageProvider = (language?: string) => Promise<Translations>;

export const loadLanguagesLayered: LanguageProvider = async (locale?: string) => {
    const localeOrder = [defaultLanguage];

    if (locale) {
        const [language, region] = locale.toLowerCase().split('-');
        localeOrder.push(language);

        if (region) {
            localeOrder.push(`${language}_${region}`);
        }
    }

    // make distinct
    const found: Record<string, boolean> = {};
    const distinct = localeOrder.filter(x => found.hasOwnProperty(x) ? false : (found[x] = true));

    const fetchedItems = await Promise.all(distinct.map(language => languageProvider(language)));
    return fetchedItems.reduce((prev, current) => ({ ...prev, ...current }), {});
}

export const defaultLanguage = 'en';
let translations: Translations = {};
let translationProvider: LanguageProvider = loadLanguagesLayered;
let languageProvider: LanguageProvider = async () => {
    // fallback
    return {};
};

export function setTranslationProvider(provider: LanguageProvider) {
    translationProvider = provider;
}

export function setLanguageProvider(provider: LanguageProvider) {
    languageProvider = provider;
}

export function getTranslations() {
    return translations;
}

export async function loadTranslations(locale?: string) {
    clearTranslations();
    translations = await translationProvider(locale);
}

function clearTranslations() {
    translations = {};
}

export function translate(key: string, ...substitutes: any[]): string {
    let rawTranslation = translations[key];
    if (!rawTranslation) return key;

    // evaluate pluralization
    rawTranslation = replacePluralizationTokens(rawTranslation, ...substitutes);

    // evaluate format specifiers
    return formatString(rawTranslation, ...substitutes);
}