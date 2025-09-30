import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { RoutesResolver, RouteDefinition } from './resolver';

export function registerJumpCommand(resolver: RoutesResolver) {
	return vscode.commands.registerCommand('auto-route-finder.jumpToDefinition', async (routeDefinition: RouteDefinition) => {
		try {
			const root = resolver.getWorkspaceRoot();
			if (!root) {
				vscode.window.showErrorMessage('No workspace folder found');
				return;
			}
			const widgetName = routeDefinition.widgetName;
			const fullPath = resolver.resolveWidgetPath(widgetName);
			if (!fullPath || !fs.existsSync(fullPath)) {
				vscode.window.showErrorMessage(`File not found for ${widgetName}`);
				return;
			}
			const fileUri = vscode.Uri.file(fullPath);
			const document = await vscode.workspace.openTextDocument(fileUri);
			const editor = await vscode.window.showTextDocument(document);
			const text = document.getText();
			const classRegex = new RegExp(`class\\s+${widgetName}\\s+extends\\s+\\w+`, 'g');
			const m = classRegex.exec(text);
			if (m) {
				const position = document.positionAt(m.index);
				editor.selection = new vscode.Selection(position, position);
				editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
			}
		} catch (error) {
			console.error('Error jumping to definition:', error);
			vscode.window.showErrorMessage(`Failed to open file: ${error}`);
		}
	});
}
