import parser from 'yargs-parser';
import { initDatabase } from '../database/database';
import { doesAppNeedUpdate } from '../downloader/downloader';

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
            } catch(err) {
                console.error('Error while update checking: ', err);
                return 1;
            }
        }
    }
};

type Argv = parser.Arguments & {
    location?: string
};

let parsedArgv: Argv | undefined;

/**
 * Handles program arguments
 * @returns True, if the application should start it's GUI.
 */
export async function handleArgv(): Promise<number | void> {
    const argv = <Argv> parseArgv(process.argv); // remove executable command
    parsedArgv = argv;

    if (argv._.length > 0) { // has positionals
        const commandName = argv._[0];
        const command = commands[commandName];
        if (command) {
            const positionals = argv._.slice(1);

            if (command.positionals && command.positionals.length !== positionals.length) {
                printCommandUsage(commandName, command);
                return -1;
            }

            const resultMaybe = command.execute(positionals, argv);
            return isPromiseLike(resultMaybe) ? await resultMaybe : resultMaybe;
        }
    }
}

export function parseArgv(argv: string[]) {
    return <Argv> parser(argv.slice(1)); // remove executable command
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

type Command = {
    execute: (positionals: string[], argv: Argv) => PromiseLike<number | void> | number | void
    description?: string,
    positionals?: Positional[]
}

type Positional = {
    name: string,
    description?: string,
    type?: 'string'|'integer'|'boolean'|'decimal'
}

function isPromiseLike<T>(arg: PromiseLike<T> | T): arg is PromiseLike<T> {
    return !!arg && (<PromiseLike<T>> arg).then !== undefined;
}