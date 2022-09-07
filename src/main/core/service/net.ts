import efetch, { Headers, RequestInit, Response } from "electron-fetch";

namespace Net {
    export function fetch(url: string, options?: RequestInit): Promise<Response> {
        return efetch(url, options);
    }

    export function fetchUncached(url: string, options?: RequestInit): Promise<Response> {
        const headers = new Headers();
        headers.append('pragma', 'no-cache');
        headers.append('cache-control', 'no-cache');

        return fetch(url, {
            headers: headers,
            ...(options || {})
        });
    }
};

export default Net;