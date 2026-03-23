import * as vscode from "vscode";

export function getNotesPaths(): string[] {
  return vscode.workspace.getConfiguration("syntaxmemory").get<string[]>("notesFilePaths") || [];
}

export function getCustomBuiltIns(): string[] {
  return vscode.workspace.getConfiguration("syntaxmemory").get<string[]>("customBuiltIns") || [];
}

export function getChainAtCursor(document: vscode.TextDocument, position: vscode.Position): string | null {
    const linePrefix = document.lineAt(position).text.substring(0, position.character);
    const cleanPrefix = linePrefix.replace(/[\s\(\)\[\]{};]+$/, '');
    const match = cleanPrefix.match(/([a-zA-Z0-9_$]+(?:\.[a-zA-Z0-9_$]+)*)$/);
    return match ? match[1] : null;
}

export function getEnableChatGPTPrompt(): boolean {
  return vscode.workspace.getConfiguration("syntaxmemory").get<boolean>("enableChatGPTPrompt", true);
}