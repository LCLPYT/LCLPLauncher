// Ugly solution; domains on which to set NODE_TLS_REJECT_UNAUTHORIZED = '0', because root certificates are expired (thanks, MinecraftForge)
const trustedDomain = [
    'files.minecraftforge.net'
];

export function isDomainTrusted(url: string) {
    try {
        const urlObj = new URL(url);
        return trustedDomain.includes(urlObj.hostname);
    } catch(err) {
        console.error('Invalid URL:', url);
        return false;
    }
}