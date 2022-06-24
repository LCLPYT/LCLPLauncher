import log from 'electron-log';

export function replacePluralizationTokens(text: string, ...substitutes: any[]) {

    // check for pluralization tokens
    const matches = text.matchAll(/\((\d+)\|([^|]+)\|([^|]+)\)/g);
    if (!matches) return text;

    // replace tokens

    const segments = [];
    let cursor = 0;
    let matchIndex = 0;

    let result = matches.next();
    while (!result.done) {
        const match = result.value;

        if (match.index === undefined) {
            result = matches.next();
            continue;
        }

        // check if match is escaped
        if (match.index > 0 && text[match.index - 1] === '\\') {
            result = matches.next();
            continue;
        }

        const refIdx = Number(match[1]);

        // check if reference index is valid
        if (refIdx < 0 || refIdx >= substitutes.length) {
            result = matches.next();
            continue;
        }

        // get numeric value of substitute parameter
        const ref = Number(substitutes[refIdx]);

        // check if reference is a valid number
        if (isNaN(ref)) {
            log.warn(`Cannot evaluate pluralization token. '${ref}' is not a number.`);
            result = matches.next();
            continue;
        }

        // push prefix
        if (match.index > cursor) {
            segments.push(text.substring(cursor, match.index));
            cursor = match.index;
        }

        // push substituted value
        if (matchIndex >= substitutes.length) break;  // no substitutes left

        // choose singular or plural
        const pluralized = ref === 1 ? match[2] : match[3];

        // push actual pluralized value
        segments.push(pluralized);
        cursor += match[0].length;

        matchIndex++;
        result = matches.next();
    }

    // push appendix, if not pushed already
    if (cursor < text.length) {
        segments.push(text.substring(cursor, text.length));
    }

    return segments.join('');
}

type FormatSpecifier = 's' | 'd' | 'i' | 'f' | string;

export function formatString(text: string, ...substitutes: any[]): string {

    // check for format specifiers
    const matches = text.matchAll(/%(s|d|i|f)/g)
    if (!matches) return text;

    // replace identifiers

    const segments = [];
    let cursor = 0;
    let matchIndex = 0;

    let result = matches.next();
    while (!result.done) {
        const match = result.value;

        if (match.index === undefined) {
            result = matches.next();
            continue;
        }

        // check if match is escaped
        if (match.index > 0 && text[match.index - 1] === '%') {
            result = matches.next();
            continue;
        }

        // push prefix
        if (match.index > cursor) {
            segments.push(text.substring(cursor, match.index));
            cursor = match.index;
        }

        // push substituted value
        if (matchIndex >= substitutes.length) break;  // no substitutes left

        // push actual substituted value
        const format = match[1];
        segments.push(formatted(substitutes[matchIndex], format));
        cursor += match[0].length;

        matchIndex++;
        result = matches.next();
    }

    // push appendix, if not pushed already
    if (cursor < text.length) {
        segments.push(text.substring(cursor, text.length));
    }

    return segments.join('');
}

export function formatted(value: any, format: FormatSpecifier): string {
    switch (format) {
        case 'd':
        case 'i':
            return Number(value).toFixed(0);
        case 'f':
            return Number(value).toString();
        default:
            return `${value}`;
    }
}