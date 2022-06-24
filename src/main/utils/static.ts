import path from 'path'

const isDevelopment = process.env.NODE_ENV !== 'production'

export function getStaticRender(relativePath: string) {
    if (isDevelopment) return new URL(relativePath, `http://localhost:${process.env.ELECTRON_WEBPACK_WDS_PORT}`).toString();
    return path.resolve(__static, relativePath)
}

export function getStaticMain(relativePath: string) {
    return path.resolve(__static, relativePath);
}