import * as assert from 'assert';
import * as vscode from 'vscode';
import { AutoRouteCodeLensProvider } from '../codelens';
import { RoutesResolver } from '../resolver';

suite('AutoRouteCodeLensProvider', () => {
	test('creates CodeLens for matched *Route tokens when resolver returns a path', () => {
		const fakeResolver: Partial<RoutesResolver> = {
			resolveWidgetPath: (widgetName: string) => `/fake/${widgetName}.dart`
		};
		const provider = new AutoRouteCodeLensProvider(fakeResolver as RoutesResolver);

		const text = [
			"class SomeWidget {",
			"  final route = HomeRoute();",
			"  final another = SettingsRoute();",
			"}"
		].join('\n');

		const doc = new InMemoryDocument('test.dart', 'dart', text);
		const lenses = provider.provideCodeLenses(doc as unknown as vscode.TextDocument);
		assert.strictEqual(lenses.length, 2);
		for (const lens of lenses) {
			assert.ok(lens.command);
			assert.strictEqual(lens.command!.command, 'auto-route-finder.jumpToDefinition');
			assert.ok(lens.command!.title.includes('Jump to'));
		}
	});
});

class InMemoryDocument implements vscode.TextDocument {
	uri: vscode.Uri;
	fileName: string;
	isUntitled = false;
	languageId: string;
	version = 1;
	isDirty = false;
	isClosed = false;
	eol: vscode.EndOfLine = vscode.EndOfLine.LF;
	encoding: string = 'utf8';
	private content: string;
	save: () => Thenable<boolean> = async () => true;
	constructor(fileName: string, languageId: string, content: string) {
		this.fileName = fileName;
		this.languageId = languageId;
		this.uri = vscode.Uri.parse(`untitled:${fileName}`);
		this.content = content;
	}
	lineAt(line: number): vscode.TextLine;
	lineAt(position: vscode.Position): vscode.TextLine;
	lineAt(_arg: number | vscode.Position): vscode.TextLine { throw new Error('not needed'); }
	offsetAt(_position: vscode.Position): number { return 0; }
	positionAt(_offset: number): vscode.Position { return new vscode.Position(0, 0); }
	getText(_range?: vscode.Range | undefined): string { return this.content; }
	getWordRangeAtPosition(_position: vscode.Position, _regex?: RegExp | undefined): vscode.Range | undefined { return undefined; }
	validateRange(_range: vscode.Range): vscode.Range { return new vscode.Range(0, 0, 0, 0); }
	validatePosition(_position: vscode.Position): vscode.Position { return new vscode.Position(0, 0); }
	get lineCount(): number { return this.content.split(/\r?\n/).length; }
}
