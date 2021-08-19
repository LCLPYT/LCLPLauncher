import fetch from "electron-fetch";
import parseHtml from "node-html-parser";
import { OptifineUrlResolverArgs, UrlResolverArgs } from "../types/Installation";

export async function resolveUrl(urlArgument: string | UrlResolverArgs): Promise<string> {
    if (typeof urlArgument === 'string') return urlArgument;

    const type = urlArgument.type;
    console.log(`Resolving url of type '${type}'...`);

    const resolverFactory = RESOLVERS.get(type);
    if (!resolverFactory) throw new Error(`Unknown url resolver with type '${type}'`);

    const resolver = resolverFactory(urlArgument);
    const url = await resolver.getUrl();

    console.log(`Resolved to '${url}'.`);

    return url;
}

type ResolverFactory = (args: UrlResolverArgs) => UrlResolver;

const RESOLVERS = new Map<string, ResolverFactory>([
    [
        'optifine',
        (args) => new OptifineUrlResolver(<OptifineUrlResolverArgs> <unknown> args)
    ]
]);

interface UrlResolver {
    getUrl(): Promise<string>;
}

class OptifineUrlResolver implements UrlResolver {
    protected readonly args: OptifineUrlResolverArgs;

    constructor(args: OptifineUrlResolverArgs) {
        this.args = args;
    }

    async getUrl() {
        console.log(`Looking for '${this.args.id}'...`);
        const result = await fetch(`https://optiFine.net/adloadx?f=${this.args.id}`).then(response => response.text());
        const document = parseHtml(result);
        const downloadBtn = document.querySelector('a[onclick="onDownload()"]');
        if (!downloadBtn) throw new Error('Could not find the optifine download button');

        const urlPath = downloadBtn.getAttribute('href');
        return `https://optiFine.net/${urlPath}`;
    }
}