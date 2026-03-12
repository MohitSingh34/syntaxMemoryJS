"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const KNOWN_BUILT_INS = new Set([
    "console", "Math", "Object", "Array", "String", "Number", "JSON",
    "Promise", "document", "window", "localStorage", "sessionStorage",
    "navigator", "this",
]);
// ACTIONABLE: Ye helper function settings se live path nikalega
function getNotesPath() {
    return vscode.workspace.getConfiguration("syntaxmemory").get("notesFilePath");
}
function activate(context) {
    // Storage Structure
    let usageMemory = context.globalState.get("mohitWorkspaceMemory", {});
    let isQueryingBuiltIn = false;
    function getContextPrefix(lineText) {
        const cleanText = lineText.replace(/\([^)]*\)/g, "").replace(/\[[^\]]*\]/g, "");
        const match = cleanText.match(/([a-zA-Z0-9_$]+(?:\.[a-zA-Z0-9_$]+)*)\.$/);
        if (!match)
            return "GLOBAL";
        let parts = match[1].split(".");
        if (!KNOWN_BUILT_INS.has(parts[0])) {
            parts[0] = "VARIABLE";
        }
        return parts.join(".");
    }
    // ==========================================================
    // COMPLETION PROVIDER
    // ==========================================================
    const provider = vscode.languages.registerCompletionItemProvider(["javascript", "css", "html", "typescript"], {
        async provideCompletionItems(document, position) {
            if (isQueryingBuiltIn)
                return [];
            isQueryingBuiltIn = true;
            try {
                const linePrefixText = document.lineAt(position.line).text.substring(0, position.character);
                const currentPrefix = getContextPrefix(linePrefixText);
                const builtInList = await vscode.commands.executeCommand("vscode.executeCompletionItemProvider", document.uri, position);
                if (!builtInList || !builtInList.items)
                    return [];
                const modifiedItems = builtInList.items.map((item) => {
                    const originalLabel = typeof item.label === "string" ? item.label : item.label.label;
                    const memoryKey = `${currentPrefix}|${originalLabel}`;
                    const memoryEntry = usageMemory[memoryKey] || { count: 0, paths: [] };
                    const count = memoryEntry.count;
                    const invisibleChar = "\u200B";
                    if (typeof item.label === "string") {
                        item.label = originalLabel + invisibleChar;
                    }
                    else {
                        item.label.label = originalLabel + invisibleChar;
                    }
                    if (!item.insertText) {
                        item.insertText = originalLabel;
                    }
                    else if (typeof item.insertText === "string") {
                        item.insertText = item.insertText.replace("\u200B", "");
                    }
                    if (count > 0) {
                        item.detail = `🔥 Used ${count} times (Ctx: ${currentPrefix}) | ${item.detail || ""}`;
                        const sortPriority = (10000 - count).toString().padStart(4, "0");
                        item.sortText = ` ${sortPriority}_${originalLabel}`;
                        item.preselect = true;
                    }
                    else {
                        item.sortText = item.sortText || originalLabel;
                    }
                    item.command = {
                        command: "syntaxmemory.recordUsage",
                        title: "Record Item Usage",
                        arguments: [memoryKey, document.uri.fsPath],
                    };
                    return item;
                });
                return modifiedItems;
            }
            catch (e) {
                console.error(e);
                return [];
            }
            finally {
                isQueryingBuiltIn = false;
            }
        },
    }, ".", " ");
    // ==========================================================
    // ACTION COMMAND: Data save karna
    // ==========================================================
    const recordCommand = vscode.commands.registerCommand("syntaxmemory.recordUsage", (memoryKey, filePath) => {
        const currentData = usageMemory[memoryKey] || { count: 0, paths: [] };
        currentData.count += 1;
        if (!currentData.paths.includes(filePath)) {
            currentData.paths.push(filePath);
        }
        usageMemory[memoryKey] = currentData;
        context.globalState.update("mohitWorkspaceMemory", usageMemory);
    });
    // ==========================================================
    // DASHBOARD
    // ==========================================================
    const outputChannel = vscode.window.createOutputChannel("Context Dashboard");
    const viewMemoryCommand = vscode.commands.registerCommand("syntaxmemory.viewMemory", () => {
        outputChannel.clear();
        outputChannel.appendLine("=== PERFECT CONTEXT HISTORY ===");
        const keys = Object.keys(usageMemory);
        if (keys.length === 0) {
            outputChannel.appendLine("Memory is clean and empty.");
        }
        else {
            keys
                .sort((a, b) => usageMemory[b].count - usageMemory[a].count)
                .forEach((key) => {
                const [prefix, prop] = key.split("|");
                const data = usageMemory[key];
                outputChannel.appendLine(`\n[${prefix}] -> ${prop}  |  Count: ${data.count}`);
                outputChannel.appendLine(`   📁 Paths: ${data.paths.join(", ")}`);
            });
        }
        outputChannel.show();
    });
    // ==========================================================
    // HOVER PROVIDER: Notes ko tooltip me dikhana
    // ==========================================================
    const hoverProvider = vscode.languages.registerHoverProvider(["javascript", "css", "html", "typescript"], {
        provideHover(document, position) {
            const range = document.getWordRangeAtPosition(position);
            if (!range)
                return;
            const hoveredWord = document.getText(range);
            // ACTIONABLE: Live settings se path nikalo
            const notesPath = getNotesPath();
            // Agar path empty hai ya set nahi kiya gaya hai
            if (!notesPath) {
                const md = new vscode.MarkdownString("⚠️ **Syntax Memory:** Please set your notes file path in VS Code Settings (`syntaxmemory.notesFilePath`).");
                return new vscode.Hover(md);
            }
            // Agar path valid hai, tab file read karo
            if (fs.existsSync(notesPath)) {
                const content = fs.readFileSync(notesPath, 'utf-8');
                const lines = content.split('\n');
                let isRecording = false;
                let noteText = "";
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (line === `@de ${hoveredWord}`) {
                        isRecording = true;
                        continue;
                    }
                    if (isRecording && line.startsWith("@de "))
                        break;
                    if (isRecording)
                        noteText += lines[i] + "\n";
                }
                if (noteText.trim() !== "") {
                    const md = new vscode.MarkdownString();
                    md.isTrusted = true;
                    md.appendMarkdown(`### 📝 Notes for \`${hoveredWord}\`\n---\n`);
                    md.appendCodeblock(noteText.trim(), 'javascript');
                    const encodedWord = encodeURIComponent(hoveredWord);
                    md.appendMarkdown(`\n\n[📂 Open Full Notes File (Split Screen)](command:syntaxmemory.openNotes?%22${encodedWord}%22)`);
                    return new vscode.Hover(md);
                }
            }
            else {
                // Agar file exist nahi karti
                const md = new vscode.MarkdownString(`⚠️ **Syntax Memory:** Notes file not found at \`${notesPath}\`.`);
                return new vscode.Hover(md);
            }
        }
    });
    // ==========================================================
    // SPLIT SCREEN COMMAND
    // ==========================================================
    const openNotesCmd = vscode.commands.registerCommand("syntaxmemory.openNotes", async (searchWord) => {
        // ACTIONABLE: Yahan bhi live settings se path nikalo
        const notesPath = getNotesPath();
        if (!notesPath)
            return; // Agar path nahi hai toh command ignore karo
        const decodedWord = decodeURIComponent(searchWord);
        const uri = vscode.Uri.file(notesPath); // Update kiya gaya
        const doc = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(doc, {
            viewColumn: vscode.ViewColumn.Beside,
            preserveFocus: false
        });
        const text = doc.getText();
        const lines = text.split('\n');
        let targetLine = 0;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim() === `@de ${decodedWord}`) {
                targetLine = i;
                break;
            }
        }
        const pos = new vscode.Position(targetLine, 0);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
    });
    context.subscriptions.push(provider, recordCommand, hoverProvider, openNotesCmd, viewMemoryCommand);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map