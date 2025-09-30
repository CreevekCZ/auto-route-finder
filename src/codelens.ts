import * as vscode from 'vscode';
import { RoutesResolver, RouteDefinition } from './resolver';

export class AutoRouteCodeLensProvider implements vscode.CodeLensProvider {
	private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
	public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

	constructor(private resolver: RoutesResolver) { }

	public refresh(): void {
		this._onDidChangeCodeLenses.fire();
	}

	public provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
		const codeLenses: vscode.CodeLens[] = [];
		if (document.languageId !== 'dart') { return codeLenses; }

		const text = document.getText();
		const routeRegex = /\b(\w+Route)\b/g;
		let match: RegExpExecArray | null;
		while ((match = routeRegex.exec(text)) !== null) {
			const routeName = match[1];
			if (routeName === 'AutoRoute') { continue; }
			const widgetName = routeName.replace('Route', 'Screen');
			const resolvedPath = this.resolver.resolveWidgetPath(widgetName);
			if (!resolvedPath) { continue; }

			const position = document.positionAt(match.index);
			const range = new vscode.Range(position, position.translate(0, routeName.length));
			const definition: RouteDefinition = {
				routeName,
				widgetName,
				filePath: resolvedPath,
				lineNumber: 0
			};
			codeLenses.push(new vscode.CodeLens(range, {
				title: `🔗 Jump to ${widgetName}`,
				command: 'auto-route-finder.jumpToDefinition',
				arguments: [definition]
			}));
		}
		return codeLenses;
	}
}
