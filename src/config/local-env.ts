import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function loadLocalEnvironment(directory: string, environment: NodeJS.ProcessEnv = process.env): string | undefined {
    const filePath = resolve(directory, '.env');
    let content: string;

    try {
        content = readFileSync(filePath, 'utf8');
    } catch (error) {
        if (isMissingFile(error)) {
            return undefined;
        }
        throw error;
    }

    for (const [name, value] of parseEnvironmentFile(content)) {
        if (environment[name] === undefined) {
            environment[name] = value;
        }
    }

    return filePath;
}

export function parseEnvironmentFile(content: string): Array<[string, string]> {
    return content.split(/\r?\n/).flatMap((line, index) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            return [];
        }

        const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (!match) {
            throw new Error(`Invalid .env entry on line ${index + 1}. Expected NAME=value.`);
        }

        return [[match[1], parseValue(match[2])]];
    });
}

function parseValue(value: string): string {
    const trimmed = value.trim();
    if (trimmed.length >= 2 && (
        (trimmed.startsWith('"') && trimmed.endsWith('"'))
        || (trimmed.startsWith("'") && trimmed.endsWith("'"))
    )) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}

function isMissingFile(error: unknown): error is NodeJS.ErrnoException {
    return typeof error === 'object'
        && error !== null
        && 'code' in error
        && error.code === 'ENOENT';
}
