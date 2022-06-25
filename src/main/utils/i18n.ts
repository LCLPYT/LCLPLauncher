import path from 'path';
import fs from 'fs';
import {getStaticMain} from "./static";
import {exists} from './fshelper';
import {loadTranslations, setTranslationProvider, Translations} from "../../common/utils/i18n";

export async function loadLanguageFromFile(language?: string): Promise<Translations> {
    if (!language) throw new Error('no language provided');

    const translationFile = getStaticMain(path.join('lang', `${language}.json`));
    if (!await exists(translationFile)) return {};

    const translationJson = await fs.promises.readFile(translationFile, 'utf8');
    return JSON.parse(translationJson);
}

export async function initI18n(locale: string) {
    setTranslationProvider(loadLanguageFromFile)
    await loadTranslations(locale);
}