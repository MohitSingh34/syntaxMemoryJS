import * as vscode from 'vscode';
import * as fs from 'fs';
import { MemoryData } from './types';
import { registerDashboardCommand } from './dashboard';
import { registerProviders } from './providers';
import { startSyntaxTracker, triggerChatGPTCheck } from './tracker';

export function activate(context: vscode.ExtensionContext) {
    console.log('[Syntax Memory] Extension successfully loaded in Modular Mode!');

    registerProviders(context);
    
    const exportCommand = registerDashboardCommand(context);
    context.subscriptions.push(exportCommand);
    
    startSyntaxTracker(context);

    const recordCommand = vscode.commands.registerCommand(
        "syntaxmemory.recordUsage",
        (memoryKey: string, filePath: string) => {
            let usageMemory = context.globalState.get<{ [key: string]: MemoryData }>("mohitWorkspaceMemory", {});
            const currentData = usageMemory[memoryKey] || { count: 0, usageDates: [], paths: [] };
            currentData.count += 1;
            
            const today = new Date().toISOString().split('T')[0];
            if (!currentData.usageDates) currentData.usageDates = [];
            if (!currentData.usageDates.includes(today)) currentData.usageDates.push(today);
            if (!currentData.paths) currentData.paths = [];
            if (!currentData.paths.includes(filePath)) currentData.paths.push(filePath);
            
            usageMemory[memoryKey] = currentData;
            context.globalState.update("mohitWorkspaceMemory", usageMemory);

            const chain = memoryKey.replace("|", "."); 
            
            // Get current language context from active editor
            const editor = vscode.window.activeTextEditor;
            const langId = editor ? editor.document.languageId : 'javascript';
            
            triggerChatGPTCheck(chain, langId);
        }
    );

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

    context.subscriptions.push(recordCommand, openNotesCmd, openImageCmd);
}

export function deactivate() {}