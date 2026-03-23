import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getNotesPaths, getChainAtCursor, getEnableChatGPTPrompt } from './utils';
import { checkNoteExistsFast } from './indexer';
import { MemoryData } from './types';



const PENDING_JSON_PATH = path.join(os.homedir(), 'Projects', 'notes', 'pending_chatgpt.json');

// ... (isAlreadyPending, addToPendingJson, cleanupPendingJson functions wese hi rahenge) ...
export function isAlreadyPending(entry: string): boolean {
    if (!fs.existsSync(PENDING_JSON_PATH)) return false;
    try {
        const pendingWords: string[] = JSON.parse(fs.readFileSync(PENDING_JSON_PATH, 'utf-8'));
        return pendingWords.includes(entry);
    } catch (e) { return false; }
}

export function addToPendingJson(entry: string) {
    let pendingWords: string[] = [];
    if (fs.existsSync(PENDING_JSON_PATH)) {
        try { pendingWords = JSON.parse(fs.readFileSync(PENDING_JSON_PATH, 'utf-8')); } 
        catch (e) { pendingWords = []; }
    }
    if (!pendingWords.includes(entry)) {
        pendingWords.push(entry);
        fs.writeFileSync(PENDING_JSON_PATH, JSON.stringify(pendingWords, null, 2), 'utf-8');
    }
}

export function cleanupPendingJson() {
    if (!fs.existsSync(PENDING_JSON_PATH)) return;
    try {
        let pendingWords: string[] = JSON.parse(fs.readFileSync(PENDING_JSON_PATH, 'utf-8'));
        let updated = false;
        
        pendingWords = pendingWords.filter(entry => {
            const parts = entry.split(" ");
            const chain = parts.length > 1 ? parts.slice(1).join(" ") : entry;
            
            const exists = checkNoteExistsFast(chain);
            if (exists) updated = true;
            return !exists; 
        });
        
        if (updated) fs.writeFileSync(PENDING_JSON_PATH, JSON.stringify(pendingWords, null, 2), 'utf-8');
    } catch (e) { console.warn("Failed to cleanup pending JSON", e); }
}

let lastPromptTime = 0;
export async function triggerChatGPTCheck(chain: string, languageId: string) {
// ✨ THE GATEKEEPER: Agar user ne setting off ki hai, toh seedha exit kar jao
    if (!getEnableChatGPTPrompt()) return;

    const currentTime = Date.now();
    if (currentTime - lastPromptTime < 3000) return;

    const existsInNotes = checkNoteExistsFast(chain);
    
    let readableLang = languageId;
    if (languageId === "javascriptreact") readableLang = "react";
    if (languageId === "typescriptreact") readableLang = "react typescript";

    const jsonEntry = `${readableLang} ${chain}`;
    const isPending = isAlreadyPending(jsonEntry);

    if (!existsInNotes && !isPending) {
        lastPromptTime = currentTime; 
        
        // ✨ FIX: 5 Second Timeout Logic
        const answerPromise = vscode.window.showInformationMessage(
            `Syntax Memory: "${chain}" ka note nahi mila. ChatGPT se banwayein?`,
            'Yes', 'No'
        );
        
        // Race condition: Agar 5 sec me answer nahi diya, toh auto-expire ho jayega
        const timeoutPromise = new Promise<string | undefined>(resolve => setTimeout(() => resolve('TIMEOUT'), 5000));
        const answer = await Promise.race([answerPromise, timeoutPromise]);

        if (answer === 'Yes') {
            addToPendingJson(jsonEntry);
            vscode.window.showInformationMessage(`"${chain}" queued for ChatGPT!`);
        }
    }
}

// ✨ FIX: Silent Usage Tracking Function
function recordUsageSilently(context: vscode.ExtensionContext, chain: string, filePath: string) {
    const parts = chain.split(".");
    if (parts.length < 2) return;
    const memoryKey = `${parts[0]}|${parts.slice(1).join('.')}`;

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
}

export function startSyntaxTracker(context: vscode.ExtensionContext) {
    cleanupPendingJson();

    vscode.workspace.onDidChangeTextDocument(async (event) => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || event.document !== editor.document || event.contentChanges.length === 0) return;

        const change = event.contentChanges[0];
        
        // Jaise hi user ( ya ; dabayega, hum tracking trigger kar denge silently
        const isSyntaxEnd = ["(", ";", "\n", " "].includes(change.text);

        if (isSyntaxEnd || change.text.length > 2) {
            setTimeout(async () => {
                if (!vscode.window.activeTextEditor) return;
                const position = vscode.window.activeTextEditor.selection.active;
                const chain = getChainAtCursor(event.document, position);

                if (chain && chain.length > 2 && chain.includes('.')) {
                    // 1. Bina UI disturb kiye count badhao
                    recordUsageSilently(context, chain, event.document.uri.fsPath);
                    // 2. Check karo notes me hai ya nahi
                    triggerChatGPTCheck(chain, event.document.languageId);
                }
            }, 100); 
        }
    });
}