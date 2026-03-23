import * as vscode from 'vscode';
import * as fs from 'fs';
import { registerDashboardCommand } from './dashboard';
import { registerProviders } from './providers';
import { startSyntaxTracker } from './tracker';
import { initIndexer, buildIndex } from './indexer'; // ✨
import { getNotesPaths } from './utils';

export function activate(context: vscode.ExtensionContext) {
    console.log('[Syntax Memory] Extension successfully loaded!');

    const notesPaths = getNotesPaths();
    
    // ✨ Load Notes into RAM on Startup
    initIndexer(context, notesPaths);

    registerProviders(context);
    const exportCommand = registerDashboardCommand(context);
    
    // ✨ Start tracking silently in background
    startSyntaxTracker(context);

    // ✨ Naya Command: Manual Refresh for Index
    const refreshCmd = vscode.commands.registerCommand("syntaxmemory.refreshNotesIndex", () => {
        buildIndex(getNotesPaths());
    });

    const openNotesCmd = vscode.commands.registerCommand("syntaxmemory.openNotes", async (searchWord: string, targetPath: string) => {
        if (!targetPath || !fs.existsSync(targetPath)) return;
        const uri = vscode.Uri.file(targetPath);
        const doc = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside, preserveFocus: false });
        const text = doc.getText();
        const lines = text.split('\n');
        let targetLine = 0;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim() === `@de ${searchWord}`) { targetLine = i; break; }
        }
        const pos = new vscode.Position(targetLine, 0);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
    });

    const openImageCmd = vscode.commands.registerCommand("syntaxmemory.openImage", async (imageUrl: string) => {
        let cleanPath = imageUrl.startsWith('file://') ? imageUrl.replace('file://', '') : imageUrl;
        const uri = vscode.Uri.file(cleanPath);
        await vscode.commands.executeCommand('vscode.open', uri, vscode.ViewColumn.Beside);
    });

    context.subscriptions.push(exportCommand, refreshCmd, openNotesCmd, openImageCmd);
}

export function deactivate() {}