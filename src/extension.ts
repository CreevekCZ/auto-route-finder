// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { RoutesResolver } from './resolver';
import { AutoRouteCodeLensProvider } from './codelens';
import { registerJumpCommand } from './commands';

export async function activate(context: vscode.ExtensionContext) {
	const resolver = new RoutesResolver();
	await resolver.indexRoutesFiles();

	const codeLensProvider = new AutoRouteCodeLensProvider(resolver);
	const codeLensDisposable = vscode.languages.registerCodeLensProvider(
		{ language: 'dart' },
		codeLensProvider
	);

	const routesFound = await resolver.indexRoutesFiles();
	if (routesFound.length === 0) {
		vscode.window.showWarningMessage('Auto Route Finder: routes.gr.dart not found in this workspace. CodeLens will be hidden.');
	} else {
		codeLensProvider.refresh();
	}

	const jumpDisposable = registerJumpCommand(resolver);

	const fileChangeListener = vscode.workspace.onDidSaveTextDocument(async (document: vscode.TextDocument) => {
		if (document.fileName.endsWith('routes.gr.dart')) {
			await resolver.indexRoutesFiles();
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
