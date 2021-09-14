import { SegmentedPath } from "../../main/types/Installation";

type InputType = 'directory';

type InstallationInput = {
    id: string;
    hideIfExists: boolean;
    title: string;
    description: string;
    type: InputType,
    default?: SegmentedPath
}

export type CompiledInstallationInput = InstallationInput & {
    compiledDefault?: string,
    value?: string
}

export default InstallationInput;