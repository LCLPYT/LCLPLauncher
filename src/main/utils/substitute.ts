export type SubstitutionVariables = {
    [name: string]: string
}

export type SubstitutionFunctions = {
    [name: string]: SubstitutionFunction
}

export type SubstitutionFunction = (param: string) => string;

export function replaceSubstitutes(str: string, vars: SubstitutionVariables, varFunctions?: SubstitutionFunctions): string {
    const regex = /\${([a-zA-Z0-9_()]*)}/g;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(str)) !== null) {
        // check expression is escaped
        if (match.index > 0 && str[match.index - 1] === '\\') continue;

        const prefix = str.substring(0, match.index);
        const suffix = str.substring(regex.lastIndex);

        const value = getSubstitutedValue(match[1], vars, varFunctions);

        str = prefix.concat(value).concat(suffix);
    }

    return str;
}

export function getSubstitutedValue(expression: string, vars: SubstitutionVariables, varFunctions?: SubstitutionFunctions): string {
    const functionMatch = /^([a-zA-Z0-9_]+)\(([a-zA-Z0-9_()]*)\)$/g.exec(expression);
    if (functionMatch) {
        return resolveSubstitutionFunctionValue(functionMatch, varFunctions)
    } else {
        if (!(expression in vars)) throw new Error(`Unknown variable '${expression}', can't substitute.`);
        else return vars[expression];
    }
}

function resolveSubstitutionFunctionValue(functionMatch: RegExpMatchArray, varFunctions?: SubstitutionFunctions): string {
    const functionName = functionMatch[1];
    let parameter = functionMatch[2];

    if (!varFunctions || !(functionName in varFunctions)) throw new Error(`Unknown substitution function '${functionName}', can't substitute.`);

    const nestedMatch = /^([a-zA-Z0-9_]+)\(([a-zA-Z0-9_()]*)\)$/g.exec(parameter);
    if (nestedMatch) parameter = resolveSubstitutionFunctionValue(nestedMatch, varFunctions);
    
    return varFunctions[functionName](parameter);
}