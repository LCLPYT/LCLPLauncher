import path from 'path';
import fs from 'fs';
import { exists } from './fshelper';
import { getStaticMain } from "./static";
import { formatString, replacePluralizationTokens } from './formatter';

export type LanguageProvider = (language?: string) => Promise<Record<string, string>>;

export const loadTranslationsFromDisk: LanguageProvider = async (locale?: string) => {
    const queue = [defaultLanguage];

    if (locale) {
        const [language, region] = locale.toLowerCase().split('-');
        queue.push(language);
        
        if (region) {
            queue.push(`${language}_${region}`);
        }
    }


    const fetchedItems = await Promise.all(queue.map(language => languageProvider(language)));
    return fetchedItems.reduce((prev, current) => ({ ...prev, ...current }), {});
}

export const loadLanguageFromFile: LanguageProvider = async (language?: string) => {
    if (!language) throw new Error('no language provided');

    const translationFile = getStaticMain(path.join('lang', `${language}.json`));
    if (!await exists(translationFile)) return {};

    const translationJson = await fs.promises.readFile(translationFile, 'utf8');
    return JSON.parse(translationJson);
};

let defaultLanguage = 'en';
let translations: Record<string, string> = {};
let translationProvider: LanguageProvider = loadTranslationsFromDisk;
let languageProvider: LanguageProvider = loadLanguageFromFile;

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

    // evaluate pluralitation
    rawTranslation = replacePluralizationTokens(rawTranslation, ...substitutes);

    // evaluate format specifiers
    return formatString(rawTranslation, ...substitutes);
}