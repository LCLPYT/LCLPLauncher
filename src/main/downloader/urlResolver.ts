import fetch from "electron-fetch";
import parseHtml from "node-html-parser";
import { CurseForgeUrlResolverArgs, OptifineUrlResolverArgs, UrlResolverArgs } from "../types/Installation";
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
    ],
    [
        'curseforge',
        (args) => new CurseForgeUrlResolver(<CurseForgeUrlResolverArgs> <unknown> args)
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

class CurseForgeUrlResolver implements UrlResolver {
    protected readonly args: CurseForgeUrlResolverArgs;

    constructor(args: CurseForgeUrlResolverArgs) {
        this.args = args;
    }

    async getUrl(): Promise<string> {
        console.log(`Looking for curse forge artifact of projectId=${this.args.projectId} with fileId=${this.args.fileId}...`);
        const downloaderServiceUrl = `https://addons-ecs.forgesvc.net/api/v2/addon/${this.args.projectId}/file/${this.args.fileId}/download-url`;
        const downloadUrl = await fetch(downloaderServiceUrl).then(response => response.text());

        console.log(`Fetched download url "${downloadUrl}"`);

        const url = new URL(downloadUrl);

        const trustedHosts = ['edge.forgecdn.net'];
        if (!trustedHosts.includes(url.host))
            throw new Error(`LCLPLauncher does not trust host "${url.host}"`);
            
        if (url.protocol !== 'https:' && url.protocol !== 'http:') 
            throw new Error(`Invalid download url protocol: ${url.protocol}`);

        return downloadUrl;
    }
}