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
const dashboard_1 = require("./dashboard");
const providers_1 = require("./providers");
const tracker_1 = require("./tracker");
function activate(context) {
    console.log('[Syntax Memory] Extension successfully loaded in Modular Mode!');
    (0, providers_1.registerProviders)(context);
    const exportCommand = (0, dashboard_1.registerDashboardCommand)(context);
    context.subscriptions.push(exportCommand);
    (0, tracker_1.startSyntaxTracker)(context);
    const recordCommand = vscode.commands.registerCommand("syntaxmemory.recordUsage", (memoryKey, filePath) => {
        let usageMemory = context.globalState.get("mohitWorkspaceMemory", {});
        const currentData = usageMemory[memoryKey] || { count: 0, usageDates: [], paths: [] };
        currentData.count += 1;
        const today = new Date().toISOString().split('T')[0];
        if (!currentData.usageDates)
            currentData.usageDates = [];
        if (!currentData.usageDates.includes(today))
            currentData.usageDates.push(today);
        if (!currentData.paths)
            currentData.paths = [];
        if (!currentData.paths.includes(filePath))
            currentData.paths.push(filePath);
        usageMemory[memoryKey] = currentData;
        context.globalState.update("mohitWorkspaceMemory", usageMemory);
        const chain = memoryKey.replace("|", ".");
        // Get current language context from active editor
        const editor = vscode.window.activeTextEditor;
        const langId = editor ? editor.document.languageId : 'javascript';
        (0, tracker_1.triggerChatGPTCheck)(chain, langId);
    });
    const openNotesCmd = vscode.commands.registerCommand("syntaxmemory.openNotes", async (searchWord, targetPath) => {
        if (!targetPath || !fs.existsSync(targetPath))
            return;
        const uri = vscode.Uri.file(targetPath);
        const doc = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside, preserveFocus: false });
        const text = doc.getText();
        const lines = text.split('\n');
        let targetLine = 0;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim() === `@de ${searchWord}`) {
                targetLine = i;
                break;
            }
        }
        const pos = new vscode.Position(targetLine, 0);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
    });
    const openImageCmd = vscode.commands.registerCommand("syntaxmemory.openImage", async (imageUrl) => {
        let cleanPath = imageUrl.startsWith('file://') ? imageUrl.replace('file://', '') : imageUrl;
        const uri = vscode.Uri.file(cleanPath);
        await vscode.commands.executeCommand('vscode.open', uri, vscode.ViewColumn.Beside);
    });
    context.subscriptions.push(recordCommand, openNotesCmd, openImageCmd);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map