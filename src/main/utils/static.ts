import path from 'path'

export function getStaticMain(relativePath: string) {
    return path.resolve(__static, relativePath);
}