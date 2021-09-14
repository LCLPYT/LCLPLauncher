import InstallationInput, { CompiledInstallationInput } from "../../common/types/InstallationInput";
import { exists, resolveSegmentedPath } from "../utils/fshelper";

export async function compileAdditionalInputs(inputs: InstallationInput[], installationDir: string, map: Map<string, string>) {
    return await new Compiler(installationDir, map).compile(inputs);
}

class Compiler {
    protected installationDir: string;
    protected map: Map<string, string>;

    constructor(installationDir: string, map: Map<string, string>) {
        this.installationDir = installationDir;
        this.map = map;
    }

    public async compile(inputs: InstallationInput[]) {
        const compiled: CompiledInstallationInput[] = [];

        for (const input of inputs) {
            let compiledDefault: string | undefined;
            if (input.default) compiledDefault = resolveSegmentedPath(this.installationDir, input.default);

            const value = this.map.has(input.id) ? this.map.get(input.id) : compiledDefault;
            if (await this.isInputRedundant(input, value)) {
                if (value) this.map.set(input.id, value);
                continue;
            }
            
            compiled.push({
                ...input,
                compiledDefault: compiledDefault,
                value: value
            });
        }

        return compiled;
    }

    protected async isInputRedundant(input: InstallationInput, value: string | undefined): Promise<boolean> {
        if (!value || !input.hideIfExists) return false;
        switch (input.type) {
            case 'directory':
                return await exists(value);
        
            default:
                return false;
        }
    }
}