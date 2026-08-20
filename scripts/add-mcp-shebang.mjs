import { readFile, writeFile } from 'node:fs/promises';

const file = new URL('../dist/mcp-server/index.js', import.meta.url);
const source = await readFile(file, 'utf8');
const shebang = '#!/usr/bin/env node\n';

if (!source.startsWith(shebang)) {
    await writeFile(file, `${shebang}${source}`, 'utf8');
}
