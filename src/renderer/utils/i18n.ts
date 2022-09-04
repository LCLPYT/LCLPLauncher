import { default as log } from "electron-log";
import { LanguageProvider, loadTranslations, registeredLanguages, setLanguageProvider } from "../../common/utils/i18n";
import { getConfiguredLanguage, Settings } from "../../common/utils/settings";
import { UTILITIES } from "./ipc";
import { getStaticRender } from "./static";

const fetchLanguageFromFile: LanguageProvider = async (language) => {
    if (!language) throw new Error('no language provided');

    const translationFile = getStaticRender(`lang/${language}.json`);
    const translations = await fetch(translationFile)
        .then(resp => resp.json())
        .catch(err => {
            if (registeredLanguages[language]) {
                log.error(`Could not load translations for '${language}'`, err);
            }
            return null;
        });

    return translations || {}
}

export async function initI18n() {
    setLanguageProvider(fetchLanguageFromFile);

    let locale = window.navigator.language;

    const configured = getConfiguredLanguage();
    if (configured && configured !== 'system') {
        locale = configured;
    }

    await loadTranslations(locale);
}

Settings.registerOnChangedListener((setting, newValue, oldValue) => {
    if (setting !== 'launcher.language' || newValue === oldValue) return;

    UTILITIES.reloadLanguage();
    initI18n().then(() => window.location.reload());
});