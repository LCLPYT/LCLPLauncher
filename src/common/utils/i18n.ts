import { formatString, replacePluralizationTokens } from './formatter';

export type Translations = Record<string, string>;
export type LanguageProvider = (language?: string) => Promise<Translations>;

export const loadTranslationsFromDisk: LanguageProvider = async (locale?: string) => {
    const localeOrder = [defaultLanguage];

    if (locale) {
        const [language, region] = locale.toLowerCase().split('-');
        localeOrder.push(language);

        if (region) {
            localeOrder.push(`${language}_${region}`);
        }
    }


    const fetchedItems = await Promise.all(localeOrder.map(language => languageProvider(language)));
    return fetchedItems.reduce((prev, current) => ({ ...prev, ...current }), {});
}

let defaultLanguage = 'en';
let translations: Translations = {};
let translationProvider: LanguageProvider = loadTranslationsFromDisk;
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