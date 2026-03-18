const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

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
	const extensionCtx = await createNodeContext('src/extension.ts', 'dist/extension.js', ['vscode']);

	const webviewCtx = await esbuild.context({
		entryPoints: ['src/webview/main.ts'],
		bundle: true,
		format: 'iife',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'browser',
		outfile: 'dist/webview/main.js',
		logLevel: 'silent',
		plugins: [esbuildProblemMatcherPlugin],
	});

	const bridgeCliCtx = await createNodeContext('src/bridge/cli.ts', 'dist/bridge/cli.js');

	copyWebviewAssets();

	if (watch) {
		await extensionCtx.watch();
		await webviewCtx.watch();
		await bridgeCliCtx.watch();
	} else {
		await extensionCtx.rebuild();
		await webviewCtx.rebuild();
		await bridgeCliCtx.rebuild();
		await extensionCtx.dispose();
		await webviewCtx.dispose();
		await bridgeCliCtx.dispose();
	}
}

async function createNodeContext(entryPoint, outfile, external = []) {
	return esbuild.context({
		entryPoints: [entryPoint],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'node',
		outfile,
		external,
		logLevel: 'silent',
		plugins: [esbuildProblemMatcherPlugin],
	});
}

function copyWebviewAssets() {
	const outDir = path.join(__dirname, 'dist', 'webview');
	fs.mkdirSync(outDir, { recursive: true });
	fs.copyFileSync(path.join(__dirname, 'src', 'webview', 'index.html'), path.join(outDir, 'index.html'));
	fs.copyFileSync(path.join(__dirname, 'src', 'webview', 'styles.css'), path.join(outDir, 'styles.css'));
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
