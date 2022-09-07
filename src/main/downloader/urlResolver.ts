import log from 'electron-log';
import parseHtml from "node-html-parser";
import Net from "../core/service/net";
import { CurseForgeUrlResolverArgs, OptifineUrlResolverArgs, UrlResolverArgs } from "../types/Installation";

export async function resolveUrl(urlArgument: string | UrlResolverArgs): Promise<string> {
    if (typeof urlArgument === 'string') return urlArgument;

    const type = urlArgument.type;
    log.debug(`Resolving url of type '${type}'...`);

    const resolverFactory = RESOLVERS.get(type);
    if (!resolverFactory) throw new Error(`Unknown url resolver with type '${type}'`);

    const resolver = resolverFactory(urlArgument);
    const url = await resolver.getUrl();

    log.debug(`Resolved to '${url}'.`);

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
        log.debug(`Looking for '${this.args.id}'...`);
        const result = await Net.fetch(`https://optiFine.net/adloadx?f=${this.args.id}`).then(response => response.text());
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
        throw new Error('CurseForge is unsupported at the moment.');
        // if (!this.args.projectSlug) throw new Error('Legacy CurseForge artifact detected, projectSlug is missing.');

        // const descriptor = [this.args.projectSlug, this.args.projectId].join('-');
        // const filename = `${descriptor}-${this.args.fileId}.jar`;
        // const url = ['https://www.cursemaven.com/curse/maven', descriptor, this.args.fileId, filename].join('/');

        // log.debug(`Trying to download '${url}'...`);
        // return url;
    }
}