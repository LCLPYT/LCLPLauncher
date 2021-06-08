import path from 'path'
import * as url from 'url'

const isDevelopment = process.env.NODE_ENV !== 'production'

export function getStatic(relativePath: string) {
    if (isDevelopment) return url.resolve(`http://localhost:${process.env.ELECTRON_WEBPACK_WDS_PORT}`, relativePath);
    return path.resolve(__static, relativePath)
}