import { CompiledInstallationInput } from "./InstallationInput";

type InstallationInputResult = {
    inputs: CompiledInstallationInput[],
    map: {
        [key: string]: string
    }
}

export default InstallationInputResult;