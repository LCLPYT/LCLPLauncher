import {loadTranslations, setTranslationProvider, Translations} from "../../common/utils/i18n";
import {getStaticRender} from "./static";
import log from "electron-log";

export async function fetchLanguageFromFile(language?: string): Promise<Translations> {
    if (!language) throw new Error('no language provided');

    const translationFile = getStaticRender(`lang/${language}.json`);
    const translations = await fetch(translationFile)
        .then(resp => resp.json())
        .catch(err => {
            log.error(`Could not load translations for '${language}'`, err);
            return null;
        });

    return translations || {}
}

export async function initI18n() {
    setTranslationProvider(fetchLanguageFromFile);
    await loadTranslations(window.navigator.language);
}