import fs from 'fs';
import path from 'path';
import { LanguageProvider, loadTranslations, setLanguageProvider } from "../../../common/utils/i18n";
import { getConfiguredLanguage, Settings } from '../../../common/utils/settings';
import { getStaticMain } from "../../utils/static";
import { exists } from '../io/fshelper';

const loadLanguageFromFile: LanguageProvider = async (language) => {
    if (!language) throw new Error('no language provided');

    const translationFile = getStaticMain(path.join('lang', `${language}.json`));
    if (!await exists(translationFile)) return {};

    const translationJson = await fs.promises.readFile(translationFile, 'utf8');
    return JSON.parse(translationJson);
};

let cachedAppLocale: string | undefined = undefined;

export async function initI18n(locale?: string) {
    if (locale) cachedAppLocale = locale;
    else locale = cachedAppLocale;

    setLanguageProvider(loadLanguageFromFile)

    const configured = getConfiguredLanguage();
    if (configured && configured !== 'system') {
        locale = configured;
    }

    await loadTranslations(locale);
}

Settings.registerOnChangedListener((setting, newValue, oldValue) => {
    if (setting !== 'launcher.language' || newValue === oldValue) return;

    initI18n();
});