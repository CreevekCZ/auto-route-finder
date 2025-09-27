// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// Hardcoded settings
let ROUTES_FILE_PATH = 'lib/routes.gr.dart';
const REPLACE_IN_ROUTE_NAME = 'Screen,Route';

// Route definition interface
interface RouteDefinition {
	routeName: string;
	widgetName: string;
	filePath: string;
	lineNumber: number;
}

// CodeLens provider for showing "Jump to Definition" buttons
class AutoRouteCodeLensProvider implements vscode.CodeLensProvider {
	private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
	public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

	private routeDefinitions: Map<string, RouteDefinition> = new Map();

	constructor() {
		this.loadRouteDefinitions();
		

	}

	public refresh(): void {
		console.log('Auto Route Finder: Refreshing route definitions...');
		this.loadRouteDefinitions();
		this._onDidChangeCodeLenses.fire();
		console.log('Auto Route Finder: Refresh completed');
	}

	private async loadRouteDefinitions(): Promise<void> {
		try {
			const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
			if (!workspaceRoot) {
				console.log('Auto Route Finder: No workspace folder found');
				vscode.window.showErrorMessage('Auto Route Finder: No workspace folder found');
				return;
			}

			console.log(`Auto Route Finder: Workspace root: ${workspaceRoot}`);
			console.log(`Auto Route Finder: Looking for routes file at: ${ROUTES_FILE_PATH}`);
			
			const routesFilePath = path.join(workspaceRoot, ROUTES_FILE_PATH);
			console.log(`Auto Route Finder: Full routes file path: ${routesFilePath}`);
			
			// Check if the file exists
			if (!fs.existsSync(routesFilePath)) {
				console.log(`Auto Route Finder: Routes file not found at ${routesFilePath}`);
				
				// Try to find the file in common locations
				const alternativePaths = [
					path.join(workspaceRoot, 'lib', 'routes.gr.dart'),
					path.join(workspaceRoot, 'routes.gr.dart'),
					path.join(workspaceRoot, 'lib', 'generated', 'routes.gr.dart'),
					path.join(workspaceRoot, 'lib', 'app', 'routes.gr.dart'),
				];
				
				console.log('Auto Route Finder: Trying alternative paths...');
				for (const altPath of alternativePaths) {
					console.log(`Auto Route Finder: Checking ${altPath}`);
					if (fs.existsSync(altPath)) {
						console.log(`Auto Route Finder: Found routes file at ${altPath}`);
						// Update the routes file path for this session
						ROUTES_FILE_PATH = path.relative(workspaceRoot, altPath);
						console.log(`Auto Route Finder: Updated ROUTES_FILE_PATH to ${ROUTES_FILE_PATH}`);
						break;
					}
				}
				
				// Try again with the updated path
				const finalRoutesFilePath = path.join(workspaceRoot, ROUTES_FILE_PATH);
				if (!fs.existsSync(finalRoutesFilePath)) {
					vscode.window.showWarningMessage(`Auto Route Finder: Routes file not found. Checked:\n- ${routesFilePath}\n- ${alternativePaths.join('\n- ')}`);
					return;
				}
			}

			const content = fs.readFileSync(routesFilePath, 'utf8');
			console.log(`Auto Route Finder: Loaded routes file, content length: ${content.length}`);
			
			// Show first 1000 characters for debugging
			const sample = content.substring(0, 1000);
			console.log(`Auto Route Finder: Sample content from routes.gr.dart:\n${sample}`);
			
			this.parseRouteDefinitions(content);
			console.log(`Auto Route Finder: Parsed ${this.routeDefinitions.size} route definitions`);
			
			// Show success notification
			if (this.routeDefinitions.size > 0) {
				vscode.window.showInformationMessage(
					`Auto Route Finder: Successfully loaded ${this.routeDefinitions.size} route definitions from routes.gr.dart`
				);
			} else {
				vscode.window.showWarningMessage(
					'Auto Route Finder: Loaded routes.gr.dart but found no route definitions. Check your AutoRoute configuration.'
				);
			}
		} catch (error) {
			console.error('Auto Route Finder: Error loading route definitions:', error);
			vscode.window.showErrorMessage(`Auto Route Finder: Error loading routes - ${error}`);
		}
	}

	private parseRouteDefinitions(content: string): void {
		this.routeDefinitions.clear();
		
		// Parse the replaceInRouteName setting
		const [screenSuffix, routeSuffix] = REPLACE_IN_ROUTE_NAME.split(',');
		console.log(`Auto Route Finder: Using replaceInRouteName: ${screenSuffix}, ${routeSuffix}`);
		
		// More flexible regex to find route definitions with file paths
		// Looking for patterns like: static const HomeRoute = AutoRoute<HomeScreen>(path: '/home', page: () => HomeScreen())
		// This regex captures the route name, widget name, and tries to find file references
		const routeRegex = /static\s+const\s+(\w+Route)\s*=\s*AutoRoute<(\w+Screen)>\s*\([^)]*\)/g;
		
		// Also try a simpler pattern in case the format is different
		const simpleRouteRegex = /(\w+Route)\s*=\s*AutoRoute<(\w+Screen)>/g;
		
		// Even more flexible - just look for any Route = AutoRoute<Screen> pattern
		const flexibleRouteRegex = /(\w+Route)\s*=\s*AutoRoute<(\w+Screen)>/g;
		
		// Try to find import statements to get file paths
		// This regex looks for import statements with package paths and 'as' aliases
		const importRegex = /import\s+['"]([^'"]*\.dart)['"]\s+as\s+_i\d+;?\s*(?:\/\/.*?(\w+Screen))?/g;
		
		// Also try to find import statements without 'as' aliases
		const simpleImportRegex = /import\s+['"]([^'"]*\.dart)['"];?\s*(?:\/\/.*?(\w+Screen))?/g;
		
		// More flexible regex to catch any import statement
		const anyImportRegex = /import\s+['"]([^'"]*\.dart)['"];?/g;
		
		let match;
		let matchCount = 0;
		
		// First, try to find import statements to map widgets to files
		const importMap = new Map<string, string>();
		const allImports: string[] = [];
		let importMatch;
		
		// Try the main import regex first (with 'as' aliases)
		while ((importMatch = importRegex.exec(content)) !== null) {
			const [, filePath, widgetName] = importMatch;
			allImports.push(filePath);
			if (widgetName) {
				importMap.set(widgetName, filePath);
				console.log(`Auto Route Finder: Found import mapping ${widgetName} -> ${filePath}`);
			}
		}
		
		// Reset regex for second pass
		importRegex.lastIndex = 0;
		
		// Also collect all import paths for fallback matching
		let simpleImportMatch;
		while ((simpleImportMatch = simpleImportRegex.exec(content)) !== null) {
			const [, filePath, widgetName] = simpleImportMatch;
			if (!allImports.includes(filePath)) {
				allImports.push(filePath);
			}
			if (widgetName && !importMap.has(widgetName)) {
				importMap.set(widgetName, filePath);
				console.log(`Auto Route Finder: Found import mapping (simple) ${widgetName} -> ${filePath}`);
			}
			console.log(`Auto Route Finder: Found import: ${filePath}`);
		}
		
		// Reset regex for third pass
		simpleImportRegex.lastIndex = 0;
		
		// Try the most flexible regex to catch any import
		let anyImportMatch;
		while ((anyImportMatch = anyImportRegex.exec(content)) !== null) {
			const [, filePath] = anyImportMatch;
			if (!allImports.includes(filePath)) {
				allImports.push(filePath);
				console.log(`Auto Route Finder: Found import (any): ${filePath}`);
			}
		}
		
		// Try the main pattern first
		while ((match = routeRegex.exec(content)) !== null) {
			matchCount++;
			const [, routeName, widgetName] = match;
			console.log(`Auto Route Finder: Found route ${routeName} -> ${widgetName}`);
			this.addRouteDefinition(routeName, widgetName, importMap, allImports);
		}
		
		// Reset regex for second pass
		routeRegex.lastIndex = 0;
		
		// Try the simpler pattern if no matches found
		if (matchCount === 0) {
			console.log('Auto Route Finder: No matches with main pattern, trying simpler pattern...');
			while ((match = simpleRouteRegex.exec(content)) !== null) {
				matchCount++;
				const [, routeName, widgetName] = match;
				console.log(`Auto Route Finder: Found route (simple) ${routeName} -> ${widgetName}`);
				this.addRouteDefinition(routeName, widgetName, importMap, allImports);
			}
		}
		
		// Reset regex for third pass
		simpleRouteRegex.lastIndex = 0;
		
		// Try the most flexible pattern if still no matches
		if (matchCount === 0) {
			console.log('Auto Route Finder: No matches with simple pattern, trying flexible pattern...');
			while ((match = flexibleRouteRegex.exec(content)) !== null) {
				matchCount++;
				const [, routeName, widgetName] = match;
				console.log(`Auto Route Finder: Found route (flexible) ${routeName} -> ${widgetName}`);
				this.addRouteDefinition(routeName, widgetName, importMap, allImports);
			}
		}
		
		console.log(`Auto Route Finder: Total matches found: ${matchCount}, successful mappings: ${this.routeDefinitions.size}`);
		
		// Debug: Show all found imports
		console.log(`Auto Route Finder: All imports found: ${JSON.stringify(allImports, null, 2)}`);
		
		// Debug: Show all route definitions
		console.log(`Auto Route Finder: Route definitions: ${JSON.stringify(Array.from(this.routeDefinitions.entries()), null, 2)}`);
	}

	private addRouteDefinition(routeName: string, widgetName: string, importMap?: Map<string, string>, allImports?: string[]): void {
		let widgetFilePath: string | null = null;
		
		// First, try to get the file path from import statements
		if (importMap && importMap.has(widgetName)) {
			const importPath = importMap.get(widgetName)!;
			console.log(`Auto Route Finder: Found import path for ${widgetName}: ${importPath}`);
			
			// Convert import path to file system path
			const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
			if (workspaceRoot) {
				// Handle different import path formats
				let filePath: string | null = importPath;
				if (importPath.startsWith('package:')) {
					// Handle package imports - extract the path after package:app_name/
					const packageMatch = importPath.match(/^package:[^/]+\/(.+)$/);
					if (packageMatch) {
						filePath = path.join(workspaceRoot, 'lib', packageMatch[1]);
						console.log(`Auto Route Finder: Converted package import to: ${filePath}`);
					} else {
						console.log(`Auto Route Finder: Could not parse package import: ${importPath}`);
						filePath = null; // Skip this import
					}
				} else if (importPath.startsWith('./') || importPath.startsWith('../')) {
					// Relative import - resolve from routes.gr.dart location
					const routesDir = path.dirname(path.join(workspaceRoot, ROUTES_FILE_PATH));
					filePath = path.resolve(routesDir, importPath);
				} else if (importPath.startsWith('lib/')) {
					// Absolute import from lib
					filePath = path.join(workspaceRoot, importPath);
				} else {
					// Assume it's relative to lib
					filePath = path.join(workspaceRoot, 'lib', importPath);
				}
				
				if (filePath && fs.existsSync(filePath)) {
					widgetFilePath = filePath;
					console.log(`Auto Route Finder: Found file from import: ${widgetFilePath}`);
				}
			}
		}
		
		// If not found from explicit imports, try to match widget name with file names from imports
		if (!widgetFilePath && allImports) {
			// Convert widget name to snake_case (e.g., ProfileDetailScreen -> profile_detail_screen)
			const widgetFileName = widgetName.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '') + '.dart';
			console.log(`Auto Route Finder: Looking for file matching ${widgetName} -> ${widgetFileName}`);
			
			for (const importPath of allImports) {
				// Try multiple matching strategies
				const fileName = path.basename(importPath);
				const fileNameWithoutExt = fileName.replace('.dart', '');
				const widgetNameLower = widgetName.toLowerCase();
				const widgetNameWithoutScreen = widgetName.replace('Screen', '').toLowerCase();
				
				// Convert widget name to snake_case for comparison
				const widgetNameSnakeCase = widgetName.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
				const widgetNameSnakeCaseWithoutScreen = widgetName.replace('Screen', '').replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
				
				console.log(`Auto Route Finder: Checking import ${importPath} against ${widgetName}`);
				console.log(`Auto Route Finder: File name: ${fileNameWithoutExt}, Widget snake_case: ${widgetNameSnakeCase}, Widget snake_case without Screen: ${widgetNameSnakeCaseWithoutScreen}`);
				
				if (importPath.includes(widgetFileName) || 
					importPath.includes(widgetName.toLowerCase()) ||
					fileNameWithoutExt.includes(widgetNameLower) ||
					fileNameWithoutExt.includes(widgetNameWithoutScreen) ||
					fileNameWithoutExt.includes(widgetNameSnakeCase) ||
					fileNameWithoutExt.includes(widgetNameSnakeCaseWithoutScreen) ||
					widgetNameWithoutScreen.includes(fileNameWithoutExt) ||
					widgetNameSnakeCaseWithoutScreen.includes(fileNameWithoutExt)) {
					console.log(`Auto Route Finder: Potential match found: ${importPath}`);
					
					// Convert import path to file system path
					const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
					if (workspaceRoot) {
						let filePath: string | null = null;
						if (importPath.startsWith('package:')) {
							// Handle package imports - extract the path after package:app_name/
							const packageMatch = importPath.match(/^package:[^/]+\/(.+)$/);
							if (packageMatch) {
								filePath = path.join(workspaceRoot, 'lib', packageMatch[1]);
								console.log(`Auto Route Finder: Converted package import to: ${filePath}`);
							}
						} else if (importPath.startsWith('./') || importPath.startsWith('../')) {
							const routesDir = path.dirname(path.join(workspaceRoot, ROUTES_FILE_PATH));
							filePath = path.resolve(routesDir, importPath);
						} else if (importPath.startsWith('lib/')) {
							filePath = path.join(workspaceRoot, importPath);
						} else {
							filePath = path.join(workspaceRoot, 'lib', importPath);
						}
						
						if (filePath && fs.existsSync(filePath)) {
							widgetFilePath = filePath;
							console.log(`Auto Route Finder: Found file by name matching: ${widgetFilePath}`);
							break;
						} else {
							console.log(`Auto Route Finder: File does not exist: ${filePath}`);
						}
					}
				}
			}
		}
		
		if (widgetFilePath) {
			console.log(`Auto Route Finder: Found widget file for ${widgetName}: ${widgetFilePath}`);
			this.routeDefinitions.set(routeName, {
				routeName,
				widgetName,
				filePath: widgetFilePath,
				lineNumber: 0
			});
		} else {
			console.log(`Auto Route Finder: Could not find widget file for ${widgetName}`);
			
			// Fallback: Try to find any import that might match
			if (allImports && allImports.length > 0) {
				console.log(`Auto Route Finder: Trying fallback matching for ${widgetName}`);
				const widgetNameLower = widgetName.toLowerCase();
				const widgetNameWithoutScreen = widgetName.replace('Screen', '').toLowerCase();
				
				// Convert to snake_case for better matching
				const widgetNameSnakeCase = widgetName.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
				const widgetNameSnakeCaseWithoutScreen = widgetName.replace('Screen', '').replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
				
				for (const importPath of allImports) {
					const fileName = path.basename(importPath).replace('.dart', '').toLowerCase();
					
					console.log(`Auto Route Finder: Fallback checking ${fileName} against ${widgetNameSnakeCase} and ${widgetNameSnakeCaseWithoutScreen}`);
					
					if (fileName.includes(widgetNameLower) || 
						fileName.includes(widgetNameWithoutScreen) ||
						fileName.includes(widgetNameSnakeCase) ||
						fileName.includes(widgetNameSnakeCaseWithoutScreen) ||
						widgetNameWithoutScreen.includes(fileName) ||
						widgetNameSnakeCaseWithoutScreen.includes(fileName)) {
						
						console.log(`Auto Route Finder: Fallback match found: ${importPath}`);
						
						// Convert to file system path
						const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
						if (workspaceRoot) {
							let filePath: string | null = null;
							if (importPath.startsWith('package:')) {
								const packageMatch = importPath.match(/^package:[^/]+\/(.+)$/);
								if (packageMatch) {
									filePath = path.join(workspaceRoot, 'lib', packageMatch[1]);
								}
							} else {
								filePath = path.join(workspaceRoot, 'lib', importPath);
							}
							
							if (filePath && fs.existsSync(filePath)) {
								console.log(`Auto Route Finder: Fallback file found: ${filePath}`);
								this.routeDefinitions.set(routeName, {
									routeName,
									widgetName,
									filePath: filePath,
									lineNumber: 0
								});
								break;
							}
						}
					}
				}
			}
		}
	}

	// Removed hardcoded file finding methods - now only using paths from routes.gr.dart

	public provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens[]> {
		const codeLenses: vscode.CodeLens[] = [];
		
		// Only process Dart files
		if (document.languageId !== 'dart') {
			return codeLenses;
		}
		
		console.log(`Auto Route Finder: Providing CodeLenses for ${document.fileName}`);
		console.log(`Auto Route Finder: Available route definitions: ${Array.from(this.routeDefinitions.keys()).join(', ')}`);
		
		// Look for *Route class names and constructor calls in the document
		const text = document.getText();
		// Match both class declarations and constructor calls like ProfileDetailRoute()
		const routeRegex = /\b(\w+Route)\b/g;
		
		// Debug: Show a sample of the text being searched
		const sampleText = text.substring(0, 500);
		console.log(`Auto Route Finder: Sample text from document: ${sampleText}`);
		
		let match;
		let foundRoutes: string[] = [];
		while ((match = routeRegex.exec(text)) !== null) {
			const routeName = match[1];
			foundRoutes.push(routeName);
			const routeDefinition = this.routeDefinitions.get(routeName);
			
			console.log(`Auto Route Finder: Found ${routeName} in document, has definition: ${!!routeDefinition}`);
			
			// Create a route definition even if we don't have one in our map
			const finalRouteDefinition = routeDefinition || {
				routeName: routeName,
				widgetName: routeName.replace('Route', 'Screen'),
				filePath: '', // Will be determined in the command
				lineNumber: 0
			};
			
			const position = document.positionAt(match.index);
			const range = new vscode.Range(position, position.translate(0, routeName.length));
			
			const codeLens = new vscode.CodeLens(range, {
				title: `🔗 Jump to ${finalRouteDefinition.widgetName}`,
				command: 'auto-route-finder.jumpToDefinition',
				arguments: [finalRouteDefinition]
			});
			
			codeLenses.push(codeLens);
		}
		
		console.log(`Auto Route Finder: Found routes in document: ${foundRoutes.join(', ')}`);
		console.log(`Auto Route Finder: Generated ${codeLenses.length} CodeLenses`);
		
		return codeLenses;
	}
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('Auto Route Finder extension is now active!');

	// Create CodeLens provider
	const codeLensProvider = new AutoRouteCodeLensProvider();
	const codeLensDisposable = vscode.languages.registerCodeLensProvider(
		{ language: 'dart' },
		codeLensProvider
	);

	// Register jump to definition command
	const jumpToDefinitionCommand = vscode.commands.registerCommand(
		'auto-route-finder.jumpToDefinition',
		async (routeDefinition: RouteDefinition) => {
			try {
				console.log('Auto Route Finder: Jump command called with:', routeDefinition);
				
				if (!routeDefinition) {
					vscode.window.showErrorMessage('Route definition not found');
					return;
				}

				const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
				if (!workspaceRoot) {
					vscode.window.showErrorMessage('No workspace folder found');
					return;
				}

				// Step 1: Convert widget name to snake_case
				const widgetName = routeDefinition.widgetName;
				const snakeCaseName = widgetName.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
				console.log(`Auto Route Finder: Looking for ${snakeCaseName} in routes.gr.dart`);

				// Step 2: Read routes.gr.dart and find import containing snake_case name
				const routesFilePath = path.join(workspaceRoot, ROUTES_FILE_PATH);
				if (!fs.existsSync(routesFilePath)) {
					vscode.window.showErrorMessage(`Routes file not found at ${routesFilePath}`);
					return;
				}

				const routesContent = fs.readFileSync(routesFilePath, 'utf8');
				const importRegex = /import\s+['"]([^'"]*\.dart)['"]/g;
				
				let importPath = null;
				let match;
				while ((match = importRegex.exec(routesContent)) !== null) {
					const [, path] = match;
					if (path.includes(snakeCaseName)) {
						importPath = path;
						console.log(`Auto Route Finder: Found matching import: ${importPath}`);
						break;
					}
				}

				if (!importPath) {
					vscode.window.showErrorMessage(`No import found containing ${snakeCaseName} in routes.gr.dart`);
					return;
				}

				// Step 3: Convert package:app_name/path to lib/path
				let filePath = importPath;
				if (importPath.startsWith('package:')) {
					const packageMatch = importPath.match(/^package:[^/]+\/(.+)$/);
					if (packageMatch) {
						filePath = path.join('lib', packageMatch[1]);
					}
				}

				// Step 4: Create full path and open file
				const fullPath = path.join(workspaceRoot, filePath);
				console.log(`Auto Route Finder: Opening file: ${fullPath}`);

				if (!fs.existsSync(fullPath)) {
					vscode.window.showErrorMessage(`File not found: ${fullPath}`);
					return;
				}

				const fileUri = vscode.Uri.file(fullPath);
				const document = await vscode.workspace.openTextDocument(fileUri);
				const editor = await vscode.window.showTextDocument(document);
				
				// Find the class definition and focus on it
				const text = document.getText();
				const classRegex = new RegExp(`class\\s+${widgetName}\\s+extends\\s+\\w+`, 'g');
				const classMatch = classRegex.exec(text);
				
				if (classMatch) {
					const position = document.positionAt(classMatch.index);
					editor.selection = new vscode.Selection(position, position);
					editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
				}
				
				vscode.window.showInformationMessage(`Jumped to ${widgetName}`);
			} catch (error) {
				console.error('Error jumping to definition:', error);
				vscode.window.showErrorMessage(`Failed to open file: ${error}`);
			}
		}
	);

	// Register refresh command for debugging
	const refreshCommand = vscode.commands.registerCommand(
		'auto-route-finder.refresh',
		() => {
			console.log('Auto Route Finder: Manual refresh triggered');
			codeLensProvider.refresh();
			vscode.window.showInformationMessage('Auto Route Finder: Refreshed route definitions');
		}
	);

	// Listen for configuration changes (simplified - just refresh on any config change)
	const configChangeListener = vscode.workspace.onDidChangeConfiguration(() => {
		console.log('Auto Route Finder: Configuration changed, refreshing...');
		codeLensProvider.refresh();
	});

	// Listen for file changes to refresh route definitions
	const fileChangeListener = vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
		if (document.fileName.endsWith('routes.gr.dart')) {
			codeLensProvider.refresh();
		}
	});

	// Register all disposables
	context.subscriptions.push(
		codeLensDisposable,
		jumpToDefinitionCommand,
		refreshCommand,
		configChangeListener,
		fileChangeListener
	);

	// Show welcome message
	vscode.window.showInformationMessage(
		'Auto Route Finder is active! Looking for routes at lib/routes.gr.dart'
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}
