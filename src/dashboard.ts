import * as vscode from "vscode";
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { MemoryData, NoteBlock } from "./types";
import { getNotesPaths, getNotesForWord } from "./utils";

export function registerDashboardCommand(context: vscode.ExtensionContext) {
    return vscode.commands.registerCommand("syntaxmemory.exportMemoryHTML", () => {
        let usageMemory = context.globalState.get<{ [key: string]: MemoryData }>("mohitWorkspaceMemory", {});
        const notesPaths = getNotesPaths();
        const groupedData: { [prefix: string]: { prop: string, count: number, days: number }[] } = {};
        
        const injectedNotes: { [prop: string]: NoteBlock[] } = {};
        
        for (const [key, data] of Object.entries(usageMemory)) {
            const [prefix, prop] = key.split("|");
            if (!groupedData[prefix]) { 
                groupedData[prefix] = []; 
            }
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

        const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mohit's Cognitive Syntax</title>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500&family=Inter:wght@400;500;600&display=swap');
        
        :root {
            /* Strictly OLED & Monochrome base */
            --bg-base: #000000;
            --bg-surface: #0a0a0a;
            --bg-hover: #141414;
            --border-dim: #262626;
            --border-bright: #404040;
            
            /* Text */
            --text-main: #ffffff;
            --text-secondary: #a3a3a3;
            --text-muted: #525252;
            
            /* Allowed Accents (No Blue/Purple) */
            --accent-green: #22c55e;
            --accent-amber: #f59e0b;
        }

        /* -------------------------------------------
           GLOBAL & DASHBOARD STYLES
        ------------------------------------------- */
        body {
            background-color: var(--bg-base); color: var(--text-main); 
            font-family: 'Inter', sans-serif;
            margin: 0; padding: 30px 40px; box-sizing: border-box;
            background-image: none !important; /* Aggressive block */
        }
        
        .header { margin-bottom: 30px; border-bottom: 1px solid var(--border-dim); padding-bottom: 20px; }
        .header h1 { color: var(--text-main); font-size: 1.8rem; margin: 0 0 5px 0; font-weight: 600; letter-spacing: -0.5px; }
        .header p { color: var(--text-secondary); font-size: 0.9rem; margin: 0; }
        
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
        
        .card { 
            background-color: var(--bg-surface); 
            border: 1px solid var(--border-dim); 
            border-radius: 4px; overflow: hidden; 
        }
        .card-title {
            background-color: var(--bg-base); padding: 10px 12px; 
            font-family: 'Fira Code', monospace; font-size: 0.85rem; 
            font-weight: 600; color: var(--text-secondary); 
            border-bottom: 1px solid var(--border-dim); text-transform: uppercase; 
        }
        
        .prop-list { display: flex; flex-direction: column; }
        .prop-item {
            display: flex; justify-content: space-between; align-items: center; 
            padding: 10px 12px; border-bottom: 1px solid var(--border-dim); transition: all 0.2s;
        }
        .prop-item:last-child { border-bottom: none; }
        .prop-item.has-note { cursor: pointer; }
        .prop-item.has-note:hover { 
            background-color: var(--bg-hover); 
            border-left: 3px solid var(--accent-green); 
            padding-left: 9px; 
        }
        
        .prop-main { display: flex; align-items: center; gap: 8px; }
        .prop-name { font-family: 'Fira Code', monospace; font-size: 0.85rem; color: var(--text-main); }
        .note-icon { font-size: 0.8rem; filter: grayscale(100%) contrast(200%); }
        
        .indicator { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .indicator.success { background-color: var(--accent-green); }
        .indicator-warning { font-size: 0.65rem; margin-right: 2px; cursor: help; filter: grayscale(100%); }
        .count-pill { font-size: 0.75rem; color: var(--text-muted); font-weight: 600; font-family: 'Fira Code', monospace; }

        /* -------------------------------------------
           MODAL STYLES
        ------------------------------------------- */
        .modal-overlay {
            display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.95); backdrop-filter: blur(4px);
            justify-content: center; align-items: center; z-index: 100;
        }
        .modal-overlay.active { display: flex; }
        
        .modal-content {
            background: var(--bg-base); border: 1px solid var(--border-bright); border-radius: 6px;
            width: 90vw; height: 90vh; display: flex; flex-direction: column;
            resize: both; overflow: hidden; min-width: 300px; min-height: 300px;
        }
        
        .modal-header {
            padding: 15px 20px; border-bottom: 1px solid var(--border-dim);
            display: flex; justify-content: space-between; align-items: center; background: var(--bg-surface);
        }
        .modal-title { font-family: 'Fira Code', monospace; color: var(--text-main); font-size: 1.1rem; margin: 0; }
        
        .close-btn { background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 1.2rem; transition: color 0.2s; }
        .close-btn:hover { color: #ffffff; }
        
        .modal-body { padding: 30px; overflow-y: auto; flex-grow: 1; background: var(--bg-base); }
        
        /* -------------------------------------------
           DOCUMENT VIEWER (MARKDOWN CONTENT)
        ------------------------------------------- */
        .def-block {
            background: var(--bg-base); border: 1px solid var(--border-dim);
            border-radius: 6px; margin-bottom: 30px; overflow: hidden;
        }
        
        .def-header {
            background: var(--bg-surface); padding: 12px 20px;
            border-bottom: 1px solid var(--border-dim); display: flex; align-items: center;
        }
        .mac-dots { display: flex; gap: 6px; margin-right: 15px; }
        .mac-dot { width: 10px; height: 10px; border-radius: 50%; border: 1px solid var(--border-bright); background: transparent; }
        .mac-dot.red { background: var(--border-bright); } /* Flat monochrome dots */
        
        .def-header-title { font-family: 'Inter', sans-serif; font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; letter-spacing: 1px; }

        .def-content { 
            padding: 35px; 
            background-color: var(--bg-base) !important;
            background-image: none !important;
            color: var(--text-main);
            font-size: 1.05rem;
        }
        
        .def-content h1, .def-content h2, .def-content h3 {
            color: #ffffff; border-bottom: 1px solid var(--border-dim);
            padding-bottom: 10px; margin-top: 0; margin-bottom: 20px; font-weight: 500;
        }
        
        .def-content p {
            line-height: 1.7; color: var(--text-secondary); background: var(--bg-surface); 
            border: 1px solid var(--border-dim); border-left: 3px solid var(--text-muted);
            padding: 15px 20px; border-radius: 4px; font-family: 'Fira Code', monospace; 
            white-space: pre-wrap; margin-bottom: 20px;
        }
        
        .def-content a { color: #ffffff; text-decoration: underline; text-underline-offset: 4px; transition: color 0.2s; }
        .def-content a:hover { color: var(--accent-amber); }

        .def-content blockquote {
            border-left: 3px solid var(--border-bright); background: var(--bg-surface);
            margin: 20px 0; padding: 15px 25px; font-style: italic; color: var(--text-secondary);
        }

        .def-content ul, .def-content ol { padding-left: 25px; color: var(--text-secondary); line-height: 1.8; margin-bottom: 20px; font-family: 'Fira Code', monospace; }
        .def-content li { margin-bottom: 8px; }

        .def-content pre { 
            background: var(--bg-surface); padding: 20px; border-radius: 6px; 
            overflow-x: auto; border: 1px solid var(--border-dim); margin: 25px 0;
        }
        .def-content code { font-family: 'Fira Code', monospace; font-size: 0.9em; color: var(--text-main); }
        .def-content p code, .def-content li code {
            color: var(--text-main); background: var(--bg-hover); 
            border: 1px solid var(--border-dim); padding: 2px 6px; border-radius: 4px; 
        }
        
        .def-content img { 
            max-width: 100%; max-height: 50vh; object-fit: contain; 
            border: 1px solid var(--border-dim); border-radius: 6px; padding: 2px; 
            background: var(--bg-base); display: block; margin: 20px 0; filter: grayscale(15%);
        }
        
        .def-footer {
            background: var(--bg-surface); padding: 15px 25px; border-top: 1px solid var(--border-dim);
            display: flex; justify-content: space-between; align-items: center; gap: 10px;
        }
        
        .file-link {
            color: var(--text-secondary); font-family: 'Fira Code', monospace; font-size: 0.8rem;
            text-decoration: none; word-break: break-all; transition: color 0.2s; cursor: pointer; 
        }
        .file-link:hover { color: #ffffff; }
        
        .copy-btn {
            background: var(--bg-base); color: var(--text-secondary); border: 1px solid var(--border-dim);
            padding: 6px 14px; border-radius: 4px; font-size: 0.8rem; font-family: 'Fira Code', monospace;
            cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 6px; flex-shrink: 0;
        }
        .copy-btn:hover { background: var(--bg-hover); color: #ffffff; border-color: var(--border-bright); }
        .copy-btn.copied { background: var(--bg-surface); color: var(--accent-green); border-color: var(--accent-green); }

        /* Full page layout overrides */
        .full-page-container { max-width: 1000px; margin: 0 auto; background: var(--bg-base); border: 1px solid var(--border-dim); border-radius: 8px; padding: 40px; }

        /* -------------------------------------------
           HJS OVERRIDES (AGGRESSIVELY KILL ALL BLUES/PURPLES)
        ------------------------------------------- */
        .hljs { background: var(--bg-surface) !important; color: var(--text-main) !important; }
        .hljs-keyword, .hljs-selector-tag, .hljs-literal, .hljs-section, .hljs-link { color: var(--accent-amber) !important; }
        .hljs-function .hljs-keyword { color: var(--accent-amber) !important; }
        .hljs-subst { color: var(--text-main) !important; }
        .hljs-string, .hljs-title, .hljs-name, .hljs-type, .hljs-attribute, .hljs-symbol, .hljs-bullet, .hljs-addition, .hljs-template-tag, .hljs-template-variable { color: var(--accent-green) !important; }
        .hljs-comment, .hljs-quote, .hljs-deletion, .hljs-meta { color: var(--text-muted) !important; font-style: italic; }
        .hljs-number, .hljs-built_in, .hljs-variable { color: #ffffff !important; }
        .hljs-operator, .hljs-punctuation { color: var(--text-secondary) !important; }
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
        const injectedNotes = ${JSON.stringify(injectedNotes)};

        marked.setOptions({
            highlight: function(code, lang) {
                if (lang && hljs.getLanguage(lang)) {
                    return hljs.highlight(code, { language: lang }).value;
                }
                return hljs.highlightAuto(code).value;
            },
            breaks: true
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

        function openFullPageNote(prop, index) {
            const block = injectedNotes[prop][index];
            const rawNoteContent = block.content;
            const sourceFile = block.sourceFile;

            let parsedMarkdown = "";
            try {
                parsedMarkdown = marked.parse(rawNoteContent);
            } catch (error) {
                parsedMarkdown = "<div style='color:var(--accent-amber);'>⚠️ Error parsing markdown syntax.</div>";
            }

            const standaloneHtml = \`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Notes Viewer: \${prop} (\${sourceFile})</title>
                    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
                    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
                    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500&family=Inter:wght@400;500;600&display=swap');
                        \${document.querySelector('style').innerHTML} 
                        body { background: var(--bg-base) !important; color: var(--text-main); font-family: 'Inter', sans-serif; margin: 0; padding: 50px; box-sizing: border-box;}
                        .full-page-container { max-width: 1000px; margin: 0 auto; background: var(--bg-base); border: 1px solid var(--border-dim); border-radius: 8px; padding: 40px; }
                        .def-content { padding: 0 !important; background: transparent !important;}
                    </style>
                </head>
                <body>
                    <div class="full-page-container">
                        <div class="def-header" style="margin-bottom:30px;">
                            <div class="mac-dots">
                                <div class="mac-dot red"></div>
                                <div class="mac-dot yellow"></div>
                                <div class="mac-dot green"></div>
                            </div>
                            <span class="def-header-title">Themed Note Viewer</span>
                        </div>
                        
                        <div class="def-content">
                            \${parsedMarkdown}
                        </div>
                        
                        <div class="def-footer" style="margin-top:40px; border-radius:8px;">
                            <span class="file-link" style="cursor:default; color:var(--text-secondary);">Source file: \${sourceFile}</span>
                        </div>
                    </div>
                </body>
                </html>
            \`;

            const newWindow = window.open('', '_blank');
            if (newWindow) {
                newWindow.document.write(standaloneHtml);
                newWindow.document.close(); 
            } else {
                alert('Oops! New tab kholne me browser ne popup block kar diya. Please allow popups.');
            }
        }

        function openNoteModal(prop) {
            const modal = document.getElementById('noteModal');
            const title = document.getElementById('modalTitle');
            const body = document.getElementById('modalBody');

            title.innerText = "." + prop;
            const noteBlocks = injectedNotes[prop] || [];
            
            if(noteBlocks.length === 0) {
                body.innerHTML = "<div style='text-align:center; color:var(--text-muted); padding:40px;'>No deep notes found for this syntax.</div>";
            } else {
                let generatedHtml = "";
                
                noteBlocks.forEach((block, index) => {
                    let parsedMarkdown = "";
                    try {
                        parsedMarkdown = marked.parse(block.content);
                    } catch (error) {
                        parsedMarkdown = "<div style='color:var(--accent-amber);'>⚠️ Error parsing markdown syntax.</div>";
                    }
                    
                    generatedHtml += \`
                        <div class="def-block">
                            <div class="def-header">
                                <div class="mac-dots">
                                    <div class="mac-dot red"></div>
                                    <div class="mac-dot yellow"></div>
                                    <div class="mac-dot green"></div>
                                </div>
                                <span class="def-header-title">Document Viewer (Click path to view full page)</span>
                            </div>
                            <div class="def-content">
                                \${parsedMarkdown}
                            </div>
                            <div class="def-footer">
                                <span class="file-link" 
                                    onclick="openFullPageNote('\${prop}', \${index})"
                                    title="Click to view full notes in themed new tab">📁 \${block.sourceFile}</span>
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
            if (e) {
                e.preventDefault();
            }
            document.getElementById('noteModal').classList.remove('active');
        }

        document.addEventListener('keydown', function(event) {
            if (event.key === "Escape") {
                closeModal();
            }
        });
    </script>
</body>
</html>`;

        // 🔥 Dynamic filename for total cache busting
        const uniqueFilename = `mohit_syntax_memory_${Date.now()}.html`;
        const tempPath = path.join(os.tmpdir(), uniqueFilename);
        
        fs.writeFileSync(tempPath, htmlContent, 'utf8');
        
        vscode.env.openExternal(vscode.Uri.file(tempPath));
    });
}