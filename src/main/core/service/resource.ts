import fetch from "electron-fetch";

export async function getBase64DataURL(url: string): Promise<string> {
    const response = await fetch(url);
    const contentType = response.headers.get('content-type');
    const buffer = await response.buffer();
    return `data:${contentType};base64,${buffer.toString('base64')}`;
}
