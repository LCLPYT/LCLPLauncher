import fs from 'fs';
import path from 'path';
import { LanguageProvider, loadTranslations, setLanguageProvider } from "../../../common/utils/i18n";
import { exists } from '../io/fshelper';
import { getStaticMain } from "../../utils/static";

const loadLanguageFromFile: LanguageProvider = async (language) => {
    if (!language) throw new Error('no language provided');

    const translationFile = getStaticMain(path.join('lang', `${language}.json`));
    if (!await exists(translationFile)) return {};

    const translationJson = await fs.promises.readFile(translationFile, 'utf8');
    return JSON.parse(translationJson);
};

export async function initI18n(locale: string) {
    setLanguageProvider(loadLanguageFromFile)
    await loadTranslations(locale);
}