import path from "path";
import {isDevelopment} from "../../common/utils/env";

export function getStaticRender(relativePath: string) {
    if (isDevelopment) return new URL(relativePath, `http://localhost:${process.env.ELECTRON_WEBPACK_WDS_PORT}`).toString();
    return path.resolve(__static, relativePath)
}