import App from "../../common/types/App";
import InstallationInput, { CompiledInstallationInput } from "../../common/types/InstallationInput";
import { exists, getAppInputMapFile, resolveSegmentedPath } from "../utils/fshelper";
import * as fs from 'fs';
import { InputMap } from "../../common/types/InstallationInputResult";

export async function compileAdditionalInputs(inputs: InstallationInput[], installationDir: string, map: InputMap) {
    return await new Compiler(installationDir, map).compile(inputs);
}

export async function writeInputMap(app: App, map: InputMap) {
    const file = getAppInputMapFile(app);
    await fs.promises.writeFile(file, JSON.stringify(map), 'utf8');
}

export async function readInputMap(app: App): Promise<InputMap> {
    const file = getAppInputMapFile(app);
    if (!await exists(file)) return {};

    const content = await fs.promises.readFile(file, 'utf8');
    return JSON.parse(content);
}

class Compiler {
    protected installationDir: string;
    protected map: InputMap;

    constructor(installationDir: string, map: InputMap) {
        this.installationDir = installationDir;
        this.map = map;
    }

    public async compile(inputs: InstallationInput[]) {
        const compiled: CompiledInstallationInput[] = [];

        for (const input of inputs) {
            let compiledDefault: string | undefined;
            if (input.default) compiledDefault = resolveSegmentedPath(this.installationDir, input.default);

            const value = input.id in this.map ? this.map[input.id] : compiledDefault;
            if (await this.isInputRedundant(input, value)) {
                if (value) this.map[input.id] = value;
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