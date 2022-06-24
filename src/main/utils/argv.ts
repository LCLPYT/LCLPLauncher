import parser from 'yargs-parser';

import {getAppVersion} from "./env";
import {isDevelopment} from "../../common/utils/env";

const commands: Record<string, Command> = {
    'check-for-app-update': {
        description: 'Performs an update check for the given application.',
        positionals: [
            {
                name: 'appKey',
                description: 'The alpha-numeric key of the application.',
                type: 'string'
            }
        ],
        execute: async (positionals) => {
            if (await checkMandatoryUpdate()) return 2;

            console.log('Checking for an update for application with id', positionals[0], '...');

            await initDb();

            try {
                const {doesAppNeedUpdate} = await import(/* webpackChunkName: "io" */ '../downloader/downloader');
                const needsUpdate = await doesAppNeedUpdate(positionals[0]);
                // keep this console.log, as it is used by other software
                console.log(`[update-check]: Result -> ${needsUpdate ? 'NEEDS_UPDATE' : 'UP_TO_DATE'}`);
                return 0;
            } catch (err) {
                // keep this console.log, as it is used by other software
                console.error('Error while update checking: ', err);
                return 1;
            }
        }
    }
};

/* URL-commands should never interact with the render thread directly.
 If changes, like location changes must be done, the URL-command should set some flag, which is later evalutated. (after update-check) */
const urlCommands: URLCommandChildContainer = {
    'app': {
        children: ['appKey', {
            execute: async (vars, argv) => {
                const appKey = vars['appKey'];
                if (!appKey) return;

                await initDb();

                const {isInLibrary} = await import('./library');

                if (await isInLibrary(appKey)) {
                    argv.location = `/library/app/${appKey}`;
                } else {
                    argv.location = `/library/store/app/${appKey}`;
                }
            }
        }]
    }
}

let parsedArgv: Argv | undefined;

/**
 * Handles program arguments
 * @returns True, if the application should start it's GUI.
 */
export async function handleArgv(): Promise<number | void> {
    const argv = <Argv> parseArgv(process.argv); // remove executable command
    parsedArgv = argv;

    if (await executeUrlCommand(argv)) {
        // url command was executed, url commands cannot be normal commands, abort
        return;
    }

    // check special options, such as -v or -h
    const specialOptionsExit = await handleSpecialOptions(argv);
    if (typeof specialOptionsExit === 'number') {
        return specialOptionsExit;
    }

    // handle commands
    if (argv._.length > 0) {
        return await handlePositionals(argv);
    }
}

async function handleSpecialOptions(argv: Argv): Promise<number | void> {
    if (argv.v || argv.version) {
        console.log('LCLPLauncher', isDevelopment ? 'dev-build' : 'release', getAppVersion());
        return 0;
    }
}

async function handlePositionals(argv: Argv) {
    const commandName = argv._[0];

    const command = commands[commandName];
    if (!command) return;

    const positionals = argv._.slice(1);

    if (command.positionals && command.positionals.length !== positionals.length) {
        printCommandUsage(commandName, command);
        return 1;
    }

    const resultMaybe = command.execute(positionals, argv);
    return isPromiseLike(resultMaybe) ? await resultMaybe : resultMaybe;
}

export async function executeUrlCommand(argv: Argv, commandName?: string): Promise<boolean> {
    if (!commandName) {
        if (argv._.length <= 0) return false; // no command
        commandName = argv._[0];
    }

    const protocolPrefix = 'lclplauncher://';
    if (!commandName.startsWith(protocolPrefix)) return false; // no url command

    const path = commandName.substring(protocolPrefix.length);
    const args = path.split('/');

    if (args.length <= 0) return false; // no command content

    const vars = {};
    const command = findCommandRecursive(args, urlCommands, vars);
    if (!command || !command.execute) return false;  // no command found

    const resultMaybe = command.execute(vars, argv);
    if (isPromiseLike(resultMaybe)) await resultMaybe;
    return true; // command did execute
}

export function parseArgv(argv: string[]) {
    return <Argv>parser(argv.slice(1)); // remove executable command
}

export function getParsedArgv() {
    return parsedArgv;
}

function printCommandUsage(commandName: string, command: Command) {
    if (!command.positionals || command.positionals.length <= 0) return;

    const mapped = command.positionals.map(positional => `<${positional.name}>`);
    console.error(`Usage: ${commandName} ${mapped.join(' ')}`);
    command.positionals.forEach(pos => console.error(`    ${pos.name}: ${pos.type ? pos.type : 'string'}  --  ${pos.description ? pos.description : 'No description provided.'}`));
    console.error(`\nCommand '${commandName}' - ${command.description ? command.description : 'No description provided.'}`);
}

function findCommandRecursive(commandArgs: string[], container: URLCommandChildContainer | URLCommandVarChild | undefined,
                              vars: VarContainer): URLCommandFragment | undefined {

    if (commandArgs.length <= 0 || container === undefined) return undefined;

    if (isVarChild(container)) {
        const fragment = container[1];
        if (!fragment) return undefined;

        vars[container[0]] = commandArgs[0]; // save variable, since this is a variable child

        if (commandArgs.length === 1) return fragment.execute ? fragment : undefined;
        else return findCommandRecursive(commandArgs.slice(1), fragment.children, vars);
    } else {
        const fragment = container[commandArgs[0]];
        if (!fragment) return undefined;

        if (commandArgs.length === 1) return fragment.execute ? fragment : undefined;
        else return findCommandRecursive(commandArgs.slice(1), fragment.children, vars);
    }
}

async function checkMandatoryUpdate(): Promise<boolean> {
    const {fetchMandatoryUpdateRequired} = await import(/* webpackChunkName: "io" */ './updater');

    if (await fetchMandatoryUpdateRequired()) {
        console.error('LCLPLauncher requires a mandatory update. Please update first!');
        return true;
    }

    return false;
}

type URLCommandFragment = {
    execute?: (vars: VarContainer, argv: Argv) => PromiseLike<void> | void,
    children?: URLCommandChildContainer | URLCommandVarChild
}

type URLCommandChildContainer = {
    [key: string]: URLCommandFragment
}

type VarContainer = {
    [key: string]: string
}

type URLCommandVarChild = [varName: string, command: URLCommandFragment];

type Argv = parser.Arguments & Partial<{
    location: string,
    h: string,
    help: string,
    v: string,
    version: string
}>;

type Command = {
    execute: (positionals: string[], argv: Argv) => PromiseLike<number | void> | number | void
    description?: string,
    positionals?: Positional[]
}

type Positional = {
    name: string,
    description?: string,
    type?: 'string' | 'integer' | 'boolean' | 'decimal'
}

function isPromiseLike<T>(arg: PromiseLike<T> | T): arg is PromiseLike<T> {
    return !!arg && (<PromiseLike<T>>arg).then !== undefined;
}

function isVarChild(arg: URLCommandChildContainer | URLCommandVarChild): arg is URLCommandVarChild {
    return Array.isArray(arg);
}

async function initDb() {
    const {initDatabase} = await import(/* webpackChunkName: "db" */ '../database/database');
    await initDatabase();
}