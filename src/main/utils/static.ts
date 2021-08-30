import path from 'path'

const isDevelopment = process.env.NODE_ENV !== 'production'

export function getStatic(relativePath: string) {
    if (isDevelopment) return new URL(relativePath, `http://localhost:${process.env.ELECTRON_WEBPACK_WDS_PORT}`).toString();
    return path.resolve(__static, relativePath)
}