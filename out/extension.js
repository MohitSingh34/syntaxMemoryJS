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
const indexer_1 = require("./indexer"); // ✨
const utils_1 = require("./utils");
function activate(context) {
    console.log('[Syntax Memory] Extension successfully loaded!');
    const notesPaths = (0, utils_1.getNotesPaths)();
    // ✨ Load Notes into RAM on Startup
    (0, indexer_1.initIndexer)(context, notesPaths);
    (0, providers_1.registerProviders)(context);
    const exportCommand = (0, dashboard_1.registerDashboardCommand)(context);
    // ✨ Start tracking silently in background
    (0, tracker_1.startSyntaxTracker)(context);
    // ✨ Naya Command: Manual Refresh for Index
    const refreshCmd = vscode.commands.registerCommand("syntaxmemory.refreshNotesIndex", () => {
        (0, indexer_1.buildIndex)((0, utils_1.getNotesPaths)());
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
    context.subscriptions.push(exportCommand, refreshCmd, openNotesCmd, openImageCmd);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map