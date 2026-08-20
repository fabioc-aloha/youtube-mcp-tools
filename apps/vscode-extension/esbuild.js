const esbuild = require("esbuild");

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',

	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				console.error(`    ${location.file}:${location.line}:${location.column}:`);
			});
			console.log('[watch] build finished');
		});
	},
};

async function main() {
	const sharedOptions = {
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'node',
		logLevel: 'silent',
		plugins: [esbuildProblemMatcherPlugin],
	};

	const extensionCtx = await esbuild.context({
		...sharedOptions,
		entryPoints: ['src/extension.ts'],
		outfile: 'dist/extension.js',
		external: ['vscode'],
	});

	const mcpServerCtx = await esbuild.context({
		...sharedOptions,
		entryPoints: ['../../src/mcp-server/index.ts'],
		outfile: 'dist/mcp-server.js',
		// MCP server runs as a standalone Node process, no vscode runtime.
		// Banner adds the shebang so it can be invoked directly via `bin`.
		banner: { js: '#!/usr/bin/env node' },
	});

	if (watch) {
		await Promise.all([extensionCtx.watch(), mcpServerCtx.watch()]);
	} else {
		await Promise.all([extensionCtx.rebuild(), mcpServerCtx.rebuild()]);
		await Promise.all([extensionCtx.dispose(), mcpServerCtx.dispose()]);
	}
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
