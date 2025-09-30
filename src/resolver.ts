import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface RouteDefinition {
	routeName: string;
	widgetName: string;
	filePath: string;
	lineNumber: number;
}

export class RoutesResolver {
	private cachedRoutesFilePath: string | null = null;
	private indexedRoutesFiles: string[] = [];
	private readonly defaultRoutesRelPath = 'lib/routes.gr.dart';

	public getWorkspaceRoot(): string | null {
		return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
	}

	public async indexRoutesFiles(): Promise<string[]> {
		try {
			const uris = await vscode.workspace.findFiles('**/routes.gr.dart', '{**/node_modules/**,**/.dart_tool/**,**/build/**,**/.git/**}', 50);
			this.indexedRoutesFiles = uris.map(u => u.fsPath);
			return this.indexedRoutesFiles;
		} catch {
			this.indexedRoutesFiles = [];
			return [];
		}
	}

	public findRoutesFilePath(): string | null {
		if (this.cachedRoutesFilePath && fs.existsSync(this.cachedRoutesFilePath)) {
			return this.cachedRoutesFilePath;
		}
		const root = this.getWorkspaceRoot();
		if (!root) return null;

		// Prefer indexed files if present
		if (this.indexedRoutesFiles.length > 0) {
			this.cachedRoutesFilePath = this.indexedRoutesFiles[0];
			return this.cachedRoutesFilePath;
		}

		const candidates = [
			path.join(root, this.defaultRoutesRelPath),
			path.join(root, 'routes.gr.dart'),
			path.join(root, 'lib', 'generated', 'routes.gr.dart'),
			path.join(root, 'lib', 'app', 'routes.gr.dart'),
		];
		for (const p of candidates) {
			if (fs.existsSync(p)) {
				this.cachedRoutesFilePath = p;
				return p;
			}
		}
		return null;
	}

	private toSnakeCase(name: string): string {
		return name.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
	}

	public resolveWidgetPath(widgetName: string): string | null {
		const root = this.getWorkspaceRoot();
		if (!root) return null;

		const filesToScan = this.indexedRoutesFiles.length > 0
			? this.indexedRoutesFiles
			: (this.findRoutesFilePath() ? [this.findRoutesFilePath() as string] : []);
		if (filesToScan.length === 0) return null;

		const needle = this.toSnakeCase(widgetName);
		for (const routesFile of filesToScan) {
			try {
				const content = fs.readFileSync(routesFile, 'utf8');
				const importRegex = /import\s+['"]([^'\"]*\.dart)['"]/g;
				let m: RegExpExecArray | null;
				while ((m = importRegex.exec(content)) !== null) {
					const imp = m[1];
					if (!imp.includes(needle)) continue;
					let rel: string | null = imp;
					if (imp.startsWith('package:')) {
						const mm = imp.match(/^package:[^/]+\/(.+)$/);
						rel = mm ? path.join('lib', mm[1]) : null;
					}
					if (!rel) continue;
					const full = path.isAbsolute(rel) ? rel : path.join(root, rel);
					if (fs.existsSync(full)) return full;
				}
			} catch {
				// continue to next file
			}
		}
		return null;
	}
}
