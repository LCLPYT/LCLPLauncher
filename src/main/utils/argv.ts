import parser from 'yargs-parser';
import { initDatabase } from '../database/database';
import { doesAppNeedUpdate } from '../downloader/downloader';
import { isInLibrary } from './library';

const commands: {
    [key: string]: Command
} = {
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
            console.log('Checking for an update for application with id', positionals[0], '...');

            initDatabase(); // update-checking requires sqlite

            try {
                const needsUpdate = await doesAppNeedUpdate(positionals[0])
                console.log(`[update-check]: Result -> ${needsUpdate ? 'NEEDS_UPDATE' : 'UP_TO_DATE'}`);
                return 0;
            } catch (err) {
                console.error('Error while update checking: ', err);
                return 1;
            }
        }
    }
};

const urlCommands: URLCommandChildContainer = {
    'app': {
        children: ['appKey', {
            execute: async (vars, argv) => {
                const appKey = vars['appKey'];
                if (!appKey) return;

                initDatabase();

                if (await isInLibrary(appKey)) argv.location = `/library/app/${appKey}`;
                else argv.location = `/library/store/app/${appKey}`;
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
    const argv = <Argv>parseArgv(process.argv); // remove executable command
    parsedArgv = argv;

    if (await executeUrlCommand(argv)) return; // url command was executed, url commands cannot be normal commands, abort

    if (argv._.length > 0) { // has positionals
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
}

export async function executeUrlCommand(argv: Argv, commandName?: string): Promise<boolean> {
    if (!commandName) {
        if (argv._.length <= 0) return false; // no command
        commandName = argv._[0];
    }

    const protocolPrefix = 'lclplauncher://';
    if (commandName.startsWith(protocolPrefix)) {
        const path = commandName.substring(protocolPrefix.length);
        const args = path.split('/');

        if (args.length <= 0) return false; // no command content

        const vars = {};
        const command = findCommandRecursive(args, urlCommands, vars);
        if (command && command.execute) {
            const resultMaybe = command.execute(vars, argv);
            if (isPromiseLike(resultMaybe)) await resultMaybe;
            return true; // command did execute
        } else return false; // no command found
    } else return false; // no url command
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

function findCommandRecursive(commandArgs: string[], container: URLCommandChildContainer | URLCommandVarChild | undefined, vars: VarContainer): URLCommandFragment | undefined {
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

function isVarChild(arg: URLCommandChildContainer | URLCommandVarChild): arg is URLCommandVarChild {
    return Array.isArray(arg);
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

type Argv = parser.Arguments & {
    location?: string
};

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