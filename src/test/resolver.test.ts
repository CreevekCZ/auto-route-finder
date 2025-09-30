import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { RoutesResolver } from '../resolver';

suite('RoutesResolver', () => {
	let tmpDir: string;
	let resolver: RoutesResolver;

	setup(() => {
		// Create temp workspace directory structure resembling a Flutter project
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arf-'));
		const libDir = path.join(tmpDir, 'lib');
		fs.mkdirSync(libDir, { recursive: true });
		resolver = new RoutesResolver();

		// Point VS Code workspace to tmpDir by stubbing workspaceFolders
		(Object.defineProperty as any)(vscode.workspace, 'workspaceFolders', {
			value: [{ uri: vscode.Uri.file(tmpDir) }],
			configurable: true
		});
	});

	teardown(() => {
		try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
	});

	test('findRoutesFilePath prefers default lib/routes.gr.dart', () => {
		const routesPath = path.join(tmpDir, 'lib', 'routes.gr.dart');
		fs.writeFileSync(routesPath, "// routes file\n");
		const p = resolver.findRoutesFilePath();
		assert.strictEqual(p, routesPath);
	});

	test('resolveWidgetPath resolves package: imports and snake_case match', () => {
		const routesPath = path.join(tmpDir, 'lib', 'routes.gr.dart');
		const screenRel = path.join('lib', 'features', 'home', 'home_screen.dart');
		const screenAbs = path.join(tmpDir, 'lib', 'features', 'home', 'home_screen.dart');
		fs.mkdirSync(path.dirname(screenAbs), { recursive: true });
		fs.writeFileSync(screenAbs, "class HomeScreen extends StatelessWidget {}\n");
		// routes file imports via package:
		const content = [
			"import 'package:app/features/home/home_screen.dart';",
			"// other content"
		].join('\n');
		fs.writeFileSync(routesPath, content);

		// Ensure resolver can find the routes file via candidates
		const full = resolver.resolveWidgetPath('HomeScreen');
		assert.strictEqual(full, path.join(tmpDir, screenRel));
	});
});
