import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';     // ✨ Naya import
import * as path from 'path'; // ✨ Naya import
import { getNotesPaths, getChainAtCursor } from './utils';

// ✨ CROSS-PLATFORM PATH GENERATOR
// Ye automatically Linux me '/home/mohit/Projects/notes/...' 
// aur Windows me 'C:\Users\mohit\Projects\notes\...' bana dega
const PENDING_JSON_PATH = path.join(os.homedir(), 'Projects', 'notes', 'pending_chatgpt.json');

// ... (Baki ka pura code bilkul waisa hi rahega) ...
export function checkNoteExists(word: string, notesPaths: string[]): boolean {
    for (const rawPath of notesPaths) {
        try {
            let cleanPath = rawPath.startsWith('file://') ? rawPath.replace('file://', '') : rawPath;
            if (fs.existsSync(cleanPath) && fs.statSync(cleanPath).isFile()) {
                const content = fs.readFileSync(cleanPath, 'utf-8');
                const regex = new RegExp(`^@de\\s+${word.replace(/\./g, '\\.')}\\s*$`, 'm');
                if (regex.test(content)) return true;
            }
        } catch (error) {
            console.warn(`Error reading notes file: ${rawPath}`);
        }
    }
    return false;
}

export function isAlreadyPending(entry: string): boolean {
    if (!fs.existsSync(PENDING_JSON_PATH)) return false;
    try {
        const pendingWords: string[] = JSON.parse(fs.readFileSync(PENDING_JSON_PATH, 'utf-8'));
        return pendingWords.includes(entry);
    } catch (e) {
        return false;
    }
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

export function cleanupPendingJson(notesPaths: string[]) {
    if (!fs.existsSync(PENDING_JSON_PATH)) return;
    try {
        let pendingWords: string[] = JSON.parse(fs.readFileSync(PENDING_JSON_PATH, 'utf-8'));
        let updated = false;
        
        pendingWords = pendingWords.filter(entry => {
            // Entry format "javascript console.log" hai. 
            // Check karne ke liye hum language ko hata kar sirf "console.log" uthayenge.
            const parts = entry.split(" ");
            const chain = parts.length > 1 ? parts.slice(1).join(" ") : entry;
            
            const exists = checkNoteExists(chain, notesPaths);
            if (exists) updated = true;
            return !exists; 
        });
        
        if (updated) {
            fs.writeFileSync(PENDING_JSON_PATH, JSON.stringify(pendingWords, null, 2), 'utf-8');
        }
    } catch (e) {
        console.warn("Failed to cleanup pending JSON", e);
    }
}

let lastPromptTime = 0;
export async function triggerChatGPTCheck(chain: string, languageId: string) {
    const currentTime = Date.now();
    if (currentTime - lastPromptTime < 3000) return; 

    const notesPaths = getNotesPaths();
    const existsInNotes = checkNoteExists(chain, notesPaths);
    
    // VS Code ke language IDs ko thoda readable banate hain ChatGPT ke liye
    let readableLang = languageId;
    if (languageId === "javascriptreact") readableLang = "react";
    if (languageId === "typescriptreact") readableLang = "react typescript";

    // Format: "react useEffect" ya "javascript console.log"
    const jsonEntry = `${readableLang} ${chain}`;
    const isPending = isAlreadyPending(jsonEntry);

    if (!existsInNotes && !isPending) {
        lastPromptTime = currentTime; 
        const answer = await vscode.window.showInformationMessage(
            `Syntax Memory: "${chain}" ka note nahi mila. ChatGPT se banwayein?`,
            'Yes', 'No'
        );
        if (answer === 'Yes') {
            addToPendingJson(jsonEntry);
            vscode.window.showInformationMessage(`"${chain}" queued for ChatGPT as '${jsonEntry}'!`);
        }
    }
}

export function startSyntaxTracker(context: vscode.ExtensionContext) {
    const notesPaths = getNotesPaths();
    cleanupPendingJson(notesPaths);

    vscode.workspace.onDidChangeTextDocument(async (event) => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || event.document !== editor.document) return;
        if (event.contentChanges.length === 0) return;

        const change = event.contentChanges[0];
        if (change.text === "") return; 

        const isInlineCompletion = change.text.length > 2;
        const isSyntaxEnd = ["(", ";", "\n"].includes(change.text);

        if (isInlineCompletion || isSyntaxEnd) {
            setTimeout(async () => {
                if (!vscode.window.activeTextEditor) return;
                const position = vscode.window.activeTextEditor.selection.active;
                const chain = getChainAtCursor(event.document, position);

                if (chain && chain.length > 2 && chain.includes('.')) {
                    // Yahan hum document ki current language id bhej rahe hain
                    triggerChatGPTCheck(chain, event.document.languageId);
                }
            }, 150); 
        }
    });
}