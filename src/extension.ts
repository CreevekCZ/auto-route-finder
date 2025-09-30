// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { RoutesResolver } from './resolver';
import { AutoRouteCodeLensProvider } from './codelens';
import { registerJumpCommand } from './commands';

export function activate(context: vscode.ExtensionContext) {
	const resolver = new RoutesResolver();
	const codeLensProvider = new AutoRouteCodeLensProvider(resolver);

	const codeLensDisposable = vscode.languages.registerCodeLensProvider(
		{ language: 'dart' },
		codeLensProvider
	);

	const jumpDisposable = registerJumpCommand(resolver);

	const fileChangeListener = vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
		if (document.fileName.endsWith('routes.gr.dart')) {
			codeLensProvider.refresh();
		}
	});

	context.subscriptions.push(
		codeLensDisposable,
		jumpDisposable,
		fileChangeListener
	);
}

export function deactivate() {}
