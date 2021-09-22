export type SubstitutionVariables = {
    [name: string]: string
}

export type SubstitutionFunctions = {
    [name: string]: SubstitutionFunction
}

export type SubstitutionFunction = (param: string) => string;

export type Substitution = {
    variables?: SubstitutionVariables,
    functions?: SubstitutionFunctions
}

const substitutePattern = () => /\${([a-zA-Z0-9_()/\-.]*)}/g;
const functionPattern = () => /^([a-zA-Z0-9_]+)\(([a-zA-Z0-9_()/\-.]*)\)$/g;

export function replaceArraySubstitutes(arr: string[], subst: Substitution): string[] {
    return arr.map(str => replaceSubstitutes(str, subst));
}

export function replaceSubstitutes(str: string, subst: Substitution): string {
    const regex = substitutePattern();

    let match: RegExpExecArray | null;
    while ((match = regex.exec(str)) !== null) {
        // check expression is escaped
        if (match.index > 0 && str[match.index - 1] === '\\') continue;

        const prefix = str.substring(0, match.index);
        const suffix = str.substring(regex.lastIndex);

        const value = getSubstitutedValue(match[1], subst);

        str = prefix.concat(value).concat(suffix);
    }

    return str;
}

export function getSubstitutedValue(expression: string, subst: Substitution): string {
    const functionMatch = functionPattern().exec(expression);
    if (functionMatch) {
        return resolveSubstitutionFunctionValue(functionMatch, subst.functions)
    } else {
        if (!subst.variables || !(expression in subst.variables)) throw new Error(`Unknown variable '${expression}', can't substitute.`);
        else return subst.variables[expression];
    }
}

function resolveSubstitutionFunctionValue(functionMatch: RegExpMatchArray, varFunctions?: SubstitutionFunctions): string {
    const functionName = functionMatch[1];
    let parameter = functionMatch[2];

    if (!varFunctions || !(functionName in varFunctions)) throw new Error(`Unknown substitution function '${functionName}', can't substitute.`);

    const nestedMatch = functionPattern().exec(parameter);
    if (nestedMatch) parameter = resolveSubstitutionFunctionValue(nestedMatch, varFunctions);
    
    return varFunctions[functionName](parameter);
}