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
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const DEFAULT_BUILT_INS = [
    "console", "Math", "Object", "Array", "String", "Number", "JSON",
    "Promise", "document", "window", "localStorage", "sessionStorage",
    "navigator", "this",
];
function getNotesPaths() {
    return vscode.workspace.getConfiguration("syntaxmemory").get("notesFilePaths") || [];
}
function getCustomBuiltIns() {
    return vscode.workspace.getConfiguration("syntaxmemory").get("customBuiltIns") || [];
}
// 🔥 Helper Function: Extract multiple note blocks for a specific word
function getNotesForWord(word, notesPaths) {
    let notes = [];
    for (const rawPath of notesPaths) {
        try {
            let cleanPath = rawPath.startsWith('file://') ? rawPath.replace('file://', '') : rawPath;
            if (fs.existsSync(cleanPath) && fs.statSync(cleanPath).isFile()) {
                const content = fs.readFileSync(cleanPath, 'utf-8');
                const lines = content.split('\n');
                let isRecording = false;
                let currentNote = "";
                const saveCurrentNote = () => {
                    if (currentNote.trim() !== "") {
                        let finalContent = currentNote.trim().replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
                            let parsedUrl = url.trim();
                            if (!parsedUrl.match(/^(http|https|file|data):/i)) {
                                const mdDir = path.dirname(cleanPath);
                                const resolvedPath = path.resolve(mdDir, parsedUrl);
                                parsedUrl = vscode.Uri.file(resolvedPath).toString();
                            }
                            return `![${alt}](${parsedUrl})`;
                        });
                        notes.push({ content: finalContent, sourceFile: cleanPath });
                        currentNote = "";
                    }
                };
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (line.startsWith("@de ")) {
                        if (isRecording)
                            saveCurrentNote();
                        if (line === `@de ${word}`)
                            isRecording = true;
                        else
                            isRecording = false;
                        continue;
                    }
                    if (isRecording) {
                        currentNote += lines[i] + "  \n";
                    }
                }
                if (isRecording)
                    saveCurrentNote();
            }
        }
        catch (error) {
            console.warn(`[Syntax Memory] Skipping invalid or unreadable path: ${rawPath}`, error);
        }
    }
    return notes;
}
function activate(context) {
    let usageMemory = context.globalState.get("mohitWorkspaceMemory", {});
    let settingsBuiltIns = getCustomBuiltIns();
    let savedBuiltIns = context.globalState.get("knownBuiltIns", []);
    let knownBuiltIns = new Set([...DEFAULT_BUILT_INS, ...settingsBuiltIns, ...savedBuiltIns]);
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration("syntaxmemory.customBuiltIns")) {
            const newSettings = getCustomBuiltIns();
            knownBuiltIns = new Set([...DEFAULT_BUILT_INS, ...newSettings, ...savedBuiltIns]);
        }
    }));
    let askedPrefixes = new Set();
    let isQueryingBuiltIn = false;
    function getContextPrefix(lineText) {
        const cleanText = lineText.replace(/\([^)]*\)/g, "").replace(/\[[^\]]*\]/g, "");
        const match = cleanText.match(/([a-zA-Z0-9_$]+(?:\.[a-zA-Z0-9_$]+)*)\.$/);
        if (!match)
            return null;
        return match[1].split(".")[0];
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
                let rawPrefix = getContextPrefix(linePrefixText);
                const builtInList = await vscode.commands.executeCommand("vscode.executeCompletionItemProvider", document.uri, position);
                if (!builtInList || !builtInList.items)
                    return [];
                if (!rawPrefix)
                    return builtInList.items;
                if (!knownBuiltIns.has(rawPrefix)) {
                    if (!askedPrefixes.has(rawPrefix) && rawPrefix.length > 1) {
                        askedPrefixes.add(rawPrefix);
                        vscode.window.showInformationMessage(`Hey! '${rawPrefix}' naya lag raha hai. Kya ise future ke liye memory me save karein?`, "Haan, Save karo", "Nahi").then(choice => {
                            if (choice === "Haan, Save karo") {
                                savedBuiltIns.push(rawPrefix);
                                knownBuiltIns.add(rawPrefix);
                                context.globalState.update("knownBuiltIns", savedBuiltIns);
                                vscode.window.showInformationMessage(`Done! '${rawPrefix}' added to memory.`);
                            }
                        });
                    }
                    return builtInList.items;
                }
                const currentPrefix = rawPrefix;
                const modifiedItems = builtInList.items.map((item) => {
                    const originalLabel = typeof item.label === "string" ? item.label : item.label.label;
                    const memoryKey = `${currentPrefix}|${originalLabel}`;
                    const memoryEntry = usageMemory[memoryKey] || { count: 0, usageDates: [], paths: [] };
                    const count = memoryEntry.count;
                    const invisibleChar = "\u200B";
                    if (typeof item.label === "string")
                        item.label = originalLabel + invisibleChar;
                    else
                        item.label.label = originalLabel + invisibleChar;
                    if (!item.insertText)
                        item.insertText = originalLabel;
                    else if (typeof item.insertText === "string")
                        item.insertText = item.insertText.replace("\u200B", "");
                    if (count > 0) {
                        const uniqueDaysCount = memoryEntry.usageDates ? memoryEntry.usageDates.length : 1;
                        item.detail = `🔥 Used ${count} times (${uniqueDaysCount} days) | ${item.detail || ""}`;
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
    const recordCommand = vscode.commands.registerCommand("syntaxmemory.recordUsage", (memoryKey, filePath) => {
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
    });
    // ==========================================================
    // SLEEK BROWSER DASHBOARD (PITCH BLACK & FEATURE RICH)
    // ==========================================================
    const exportHTMLCommand = vscode.commands.registerCommand("syntaxmemory.exportMemoryHTML", () => {
        const notesPaths = getNotesPaths();
        const groupedData = {};
        const injectedNotes = {};
        for (const [key, data] of Object.entries(usageMemory)) {
            const [prefix, prop] = key.split("|");
            if (!groupedData[prefix])
                groupedData[prefix] = [];
            const uniqueDays = data.usageDates ? data.usageDates.length : 1;
            groupedData[prefix].push({ prop, count: data.count, days: uniqueDays });
            if (injectedNotes[prop] === undefined) {
                const noteBlocks = getNotesForWord(prop, notesPaths);
                if (noteBlocks.length > 0) {
                    injectedNotes[prop] = noteBlocks;
                }
            }
        }
        let cardsHtml = "";
        for (const [prefix, items] of Object.entries(groupedData)) {
            items.sort((a, b) => b.days - a.days || b.count - a.count);
            let listHtml = "";
            items.forEach(item => {
                const isMastered = item.days >= 5;
                const hasNote = !!injectedNotes[item.prop];
                const statusIndicator = isMastered
                    ? `<div class="indicator success" title="Mastered (5+ days)"></div>`
                    : `<span class="indicator-warning" title="Needs Improvement (${item.days}/5 days)">⚠️</span>`;
                listHtml += `
              <div class="prop-item ${hasNote ? 'has-note' : ''}" ${hasNote ? `onclick="openNoteModal('${item.prop}')"` : ''}>
                  <div class="prop-main">
                      ${statusIndicator}
                      <span class="prop-name">.${item.prop}</span>
                      ${hasNote ? `<span class="note-icon">📝</span>` : ''}
                  </div>
                  <span class="count-pill">${item.count}</span>
              </div>`;
            });
            cardsHtml += `
          <div class="card">
              <div class="card-title">${prefix}</div>
              <div class="prop-list">
                  ${listHtml}
              </div>
          </div>`;
        }
        // ✨ Deep Black Theme HTML - Document Viewer Edition
        const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mohit's Cognitive Syntax</title>
    <!-- Marked.js & Highlight.js for Pro Code Highlighting -->
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/tokyo-night-dark.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500&family=Inter:wght@400;500;600&display=swap');
        
        :root {
            --bg-deep: #0a0a0f;
            --bg-card: #14141e;
            --bg-card-hover: #1c1c28;
            --border-color: #2a2a3c;
            --text-primary: #e0e0e0;
            --text-secondary: #8c8c9b;
            --accent-purple: #cba6f7;
            --accent-blue: #89b4fa;
            --accent-pink: #f5c2e7;
        }

        body {
            background-color: var(--bg-deep); color: var(--text-primary); font-family: 'Inter', sans-serif;
            margin: 0; padding: 30px 40px; box-sizing: border-box;
        }
        .header { margin-bottom: 30px; border-bottom: 1px solid var(--border-color); padding-bottom: 20px; }
        .header h1 { color: var(--accent-purple); font-size: 1.8rem; margin: 0 0 5px 0; font-weight: 600; text-shadow: 0 0 10px rgba(203,166,247,0.2); }
        .header p { color: var(--text-secondary); font-size: 0.9rem; margin: 0; }
        
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
        .card { background-color: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; }
        .card-title {
            background-color: #0d0d14; padding: 8px 12px; font-family: 'Fira Code', monospace;
            font-size: 0.95rem; font-weight: 500; color: var(--accent-blue); border-bottom: 1px solid var(--border-color);
        }
        .prop-list { display: flex; flex-direction: column; }
        .prop-item {
            display: flex; justify-content: space-between; align-items: center; 
            padding: 8px 12px; border-bottom: 1px solid var(--border-color); transition: background 0.1s;
        }
        .prop-item:last-child { border-bottom: none; }
        .prop-item.has-note { cursor: pointer; }
        .prop-item.has-note:hover { background-color: var(--bg-card-hover); }
        
        .prop-main { display: flex; align-items: center; gap: 8px; }
        .prop-name { font-family: 'Fira Code', monospace; font-size: 0.85rem; color: #f5e0dc; }
        .note-icon { font-size: 0.8rem; opacity: 0.7; }
        
        .indicator { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .indicator.success { background-color: #a6e3a1; box-shadow: 0 0 8px rgba(166, 227, 161, 0.4); }
        .indicator-warning { font-size: 0.65rem; margin-right: 2px; cursor: help; }
        .count-pill { font-size: 0.75rem; color: var(--text-secondary); font-weight: 500; }

        /* Sleek Modal CSS */
        .modal-overlay {
            display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(8px);
            justify-content: center; align-items: center; z-index: 100;
        }
        .modal-overlay.active { display: flex; }
        .modal-content {
            background: var(--bg-deep); border: 1px solid var(--border-color); border-radius: 12px;
            width: 90vw; height: 90vh; display: flex; flex-direction: column;
            box-shadow: 0 0 40px rgba(0,0,0,0.8); resize: both; overflow: hidden;
            min-width: 300px; min-height: 300px;
        }
        .modal-header {
            padding: 15px 20px; border-bottom: 1px solid var(--border-color);
            display: flex; justify-content: space-between; align-items: center; background: #08080c;
        }
        .modal-title { font-family: 'Fira Code', monospace; color: var(--text-primary); font-size: 1.1rem; margin: 0; }
        .close-btn { background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 1.2rem; }
        .close-btn:hover { color: #f38ba8; }
        
        .modal-body {
            padding: 30px; overflow-y: auto; flex-grow: 1; background: var(--bg-deep);
        }
        
        /* 🔥 THE COOL DOCUMENT BOX (Obsidian/KDE Vibe) 🔥 */
        .def-block {
            background: #181825; 
            border: 1px solid #313244;
            border-radius: 12px; 
            margin-bottom: 30px; 
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0,0,0,0.4);
        }
        
        /* Mac-Style Document Header */
        .def-header {
            background: #11111b;
            padding: 12px 20px;
            border-bottom: 1px solid #313244;
            display: flex;
            align-items: center;
        }
        .mac-dots { display: flex; gap: 8px; margin-right: 15px; }
        .mac-dot { width: 12px; height: 12px; border-radius: 50%; }
        .mac-dot.red { background: #f38ba8; }
        .mac-dot.yellow { background: #f9e2af; }
        .mac-dot.green { background: #a6e3a1; }
        .def-header-title { font-family: 'Inter', sans-serif; font-size: 0.85rem; color: #a6adc8; font-weight: 500; letter-spacing: 0.5px; }

        /* Enhanced Markdown Styling inside the Cool Box */
        .def-content { 
            padding: 35px; 
            background-color: #1e1e2e;
            /* Cool Hacker Dot-Matrix Background */
            background-image: radial-gradient(#313244 1px, transparent 1px);
            background-size: 20px 20px;
            color: #cdd6f4;
            font-size: 1.05rem; /* Larger, readable text */
        }
        
        .def-content h1, .def-content h2, .def-content h3 {
            color: var(--accent-blue);
            border-bottom: 1px solid rgba(137, 180, 250, 0.2);
            padding-bottom: 10px;
            margin-top: 0;
            margin-bottom: 20px;
            font-weight: 600;
        }
        
        /* Fixed Paragraphs for Raw Code missing Backticks */
        .def-content p {
            line-height: 1.8;
            color: #bac2de;
            margin-bottom: 20px;
            /* Extra breathing room for generic text */
        }
        
        .def-content a { color: var(--accent-purple); text-decoration: none; border-bottom: 1px dashed var(--accent-purple); }
        .def-content a:hover { text-decoration: solid; color: var(--accent-pink); }

        /* Blockquotes for Callouts */
        .def-content blockquote {
            border-left: 4px solid var(--accent-purple);
            background: rgba(203, 166, 247, 0.08);
            margin: 20px 0;
            padding: 15px 25px;
            border-radius: 0 8px 8px 0;
            font-style: italic;
            color: #a6adc8;
        }

        /* Lists */
        .def-content ul, .def-content ol { padding-left: 25px; color: #bac2de; line-height: 1.8; margin-bottom: 20px; }
        .def-content li { margin-bottom: 8px; }

        /* Code Snippets styling */
        .def-content pre { 
            background: #0d0d14; 
            padding: 20px; 
            border-radius: 10px; 
            overflow-x: auto; 
            border: 1px solid #313244; 
            box-shadow: inset 0 2px 10px rgba(0,0,0,0.6); 
            margin: 25px 0;
        }
        .def-content code { 
            font-family: 'Fira Code', monospace; 
            font-size: 0.9em;
        }
        /* Inline code */
        .def-content p code, .def-content li code {
            color: var(--accent-pink); 
            background: rgba(245, 194, 231, 0.1); 
            padding: 3px 6px; 
            border-radius: 4px; 
        }
        
        /* Image constraints */
        .def-content img { 
            max-width: 100%; 
            max-height: 50vh; 
            object-fit: contain; 
            border: 2px solid #313244; 
            border-radius: 10px; 
            padding: 5px; 
            background: #08080c; 
            display: block; 
            margin: 20px 0; 
            resize: both; 
            overflow: hidden; 
            box-shadow: 0 5px 15px rgba(0,0,0,0.5);
        }
        
        /* The Sexy File Footer */
        .def-footer {
            background: #11111b; padding: 15px 25px; border-top: 1px solid #313244;
            display: flex; justify-content: space-between; align-items: center; gap: 10px;
        }
        .file-link {
            color: var(--text-secondary); font-family: 'Fira Code', monospace; font-size: 0.85rem;
            text-decoration: none; word-break: break-all; transition: color 0.2s;
            display: flex; align-items: center; gap: 8px; border: none;
        }
        .file-link:hover { color: var(--text-primary); }
        .copy-btn {
            background: #1e1e2e; color: #cdd6f4; border: 1px solid #313244;
            padding: 8px 16px; border-radius: 6px; font-size: 0.85rem; font-weight: 500;
            cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 6px; flex-shrink: 0;
        }
        .copy-btn:hover { background: #313244; color: #fff; border-color: var(--accent-blue); box-shadow: 0 0 10px rgba(137,180,250,0.2); }
        .copy-btn.copied { background: #a6e3a1; color: #11111b; border-color: #a6e3a1; }

    </style>
</head>
<body>
    <div class="header">
        <h1>Syntax Analytics</h1>
        <p>Green dot = 5+ days mastered. Click on items with 📝 to view your deep notes.</p>
    </div>
    
    <div class="grid">
        ${cardsHtml}
    </div>

    <!-- Hidden Modal Structure -->
    <div class="modal-overlay" id="noteModal" onclick="closeModal(event)">
        <div class="modal-content" onclick="event.stopPropagation()">
            <div class="modal-header">
                <h3 class="modal-title" id="modalTitle">.methodName</h3>
                <button class="close-btn" onclick="closeModal(event)">&times;</button>
            </div>
            <div class="modal-body" id="modalBody">
                Loading notes...
            </div>
        </div>
    </div>

    <script>
        // Injecting the raw markdown array
        const injectedNotes = ${JSON.stringify(injectedNotes)};

        // Configure Marked to use Highlight.js for code blocks
        marked.setOptions({
            highlight: function(code, lang) {
                if (lang && hljs.getLanguage(lang)) {
                    return hljs.highlight(code, { language: lang }).value;
                }
                return hljs.highlightAuto(code).value;
            },
            breaks: true // Preserves single line breaks (helpful if you forget markdown syntax)
        });

        function copyPath(btnElement, pathText) {
            navigator.clipboard.writeText(pathText).then(() => {
                const originalText = btnElement.innerHTML;
                btnElement.innerHTML = "✅ Copied!";
                btnElement.classList.add('copied');
                setTimeout(() => {
                    btnElement.innerHTML = originalText;
                    btnElement.classList.remove('copied');
                }, 2000);
            }).catch(err => {
                alert("Failed to copy path: " + err);
            });
        }

        function openNoteModal(prop) {
            const modal = document.getElementById('noteModal');
            const title = document.getElementById('modalTitle');
            const body = document.getElementById('modalBody');

            title.innerText = "." + prop;
            const noteBlocks = injectedNotes[prop] || [];
            
            if(noteBlocks.length === 0) {
                body.innerHTML = "<div style='text-align:center; color:#8c8c9b; padding:40px;'>No deep notes found for this syntax.</div>";
            } else {
                let generatedHtml = "";
                
                noteBlocks.forEach(block => {
                    let parsedMarkdown = "";
                    try {
                        parsedMarkdown = marked.parse(block.content);
                    } catch (error) {
                        parsedMarkdown = "<div style='color:#f38ba8;'>⚠️ Error parsing markdown syntax.</div>";
                    }
                    
                    // The ultra-premium 'Cool Box' Document Viewer
                    generatedHtml += \`
                        <div class="def-block">
                            <div class="def-header">
                                <div class="mac-dots">
                                    <div class="mac-dot red"></div>
                                    <div class="mac-dot yellow"></div>
                                    <div class="mac-dot green"></div>
                                </div>
                                <span class="def-header-title">Document Viewer</span>
                            </div>
                            <div class="def-content">
                                \${parsedMarkdown}
                            </div>
                            <div class="def-footer">
                                <a href="file://\${block.sourceFile}" target="_blank" class="file-link" title="Click to attempt opening in browser">📁 \${block.sourceFile}</a>
                                <button class="copy-btn" onclick="copyPath(this, '\${block.sourceFile.replace(/\\\\/g, '\\\\\\\\')}')">📋 Copy Path</button>
                            </div>
                        </div>
                    \`;
                });
                
                body.innerHTML = generatedHtml;
            }
            
            modal.classList.add('active');
        }

        function closeModal(e) {
            if (e) e.preventDefault();
            document.getElementById('noteModal').classList.remove('active');
        }

        document.addEventListener('keydown', function(event) {
            if (event.key === "Escape") closeModal();
        });
    </script>
</body>
</html>`;
        const tempPath = path.join(os.tmpdir(), 'mohit_syntax_memory.html');
        fs.writeFileSync(tempPath, htmlContent, 'utf8');
        vscode.env.openExternal(vscode.Uri.file(tempPath));
    });
    // ==========================================================
    // HOVER PROVIDER 
    // ==========================================================
    const hoverProvider = vscode.languages.registerHoverProvider(["javascript", "css", "html", "typescript"], {
        provideHover(document, position) {
            try {
                const range = document.getWordRangeAtPosition(position);
                if (!range)
                    return;
                const hoveredWord = document.getText(range);
                const notesPaths = getNotesPaths();
                if (!notesPaths || notesPaths.length === 0)
                    return;
                const noteBlocks = getNotesForWord(hoveredWord, notesPaths);
                if (noteBlocks.length > 0) {
                    const md = new vscode.MarkdownString();
                    md.isTrusted = true;
                    md.supportHtml = true;
                    md.appendMarkdown(`### 📝 Notes for \`${hoveredWord}\`\n---\n`);
                    noteBlocks.forEach((noteBlock, index) => {
                        try {
                            let processedContent = noteBlock.content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
                                try {
                                    if (!url || url.trim() === "")
                                        throw new Error("Empty URL");
                                    const safeUrl = url.replace(/"/g, '&quot;');
                                    const args = encodeURIComponent(JSON.stringify([url]));
                                    return `<a href="command:syntaxmemory.openImage?${args}" title="Click to open full image"><img src="${safeUrl}" width="200" alt="${alt}"></a>`;
                                }
                                catch (e) {
                                    return `\n\n> ⚠️ *Oops! Is image link me kuch syntax error hai.* \n\n`;
                                }
                            });
                            md.appendMarkdown(`${processedContent}\n\n`);
                            const fileName = path.basename(noteBlock.sourceFile);
                            const args = encodeURIComponent(JSON.stringify([hoveredWord, noteBlock.sourceFile]));
                            md.appendMarkdown(`*📂 Source: [${fileName}](command:syntaxmemory.openNotes?${args})*\n\n`);
                        }
                        catch (blockError) {
                            md.appendMarkdown(`\n\n> ⚠️ *Oops! Is specific note ko render karne me error aayi.* \n\n`);
                        }
                        if (index < noteBlocks.length - 1) {
                            md.appendMarkdown(`---\n\n`);
                        }
                    });
                    return new vscode.Hover(md);
                }
            }
            catch (error) {
                const errorMd = new vscode.MarkdownString();
                errorMd.appendMarkdown(`⚠️ **Oops! Kuch error huyi md file dekhne me.**\n\n> Details: ${error.message}`);
                return new vscode.Hover(errorMd);
            }
        }
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
    context.subscriptions.push(provider, recordCommand, hoverProvider, openNotesCmd, openImageCmd, exportHTMLCommand);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map