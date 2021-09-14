import { CompiledInstallationInput } from "./InstallationInput";

type InstallationInputResult = {
    inputs: CompiledInstallationInput[],
    map: InputMap
}

export type InputMap = {
    [key: string]: string
}

export default InstallationInputResult;