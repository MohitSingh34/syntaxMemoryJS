import * as vscode from "vscode";
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { MemoryData, NoteBlock } from "./types";
// ✨ FIX: Yahan ab utils nahi, indexer use hoga
import { getNotesFast } from "./indexer";

export function registerDashboardCommand(context: vscode.ExtensionContext) {
    return vscode.commands.registerCommand("syntaxmemory.exportMemoryHTML", () => {
        let usageMemory = context.globalState.get<{ [key: string]: MemoryData }>("mohitWorkspaceMemory", {});
        
        // ✨ FIX: getNotesPaths ki yahan ab koi zaroorat nahi
        const groupedData: { [prefix: string]: { prop: string, count: number, days: number, fullChain: string }[] } = {};
        const injectedNotes: { [fullChain: string]: NoteBlock[] } = {};
        
        for (const [key, data] of Object.entries(usageMemory)) {
            const [prefix, prop] = key.split("|");
            const fullChain = key.replace("|", "."); 
            
            if (!groupedData[prefix]) { 
                groupedData[prefix] = []; 
            }
            
            const uniqueDays = data.usageDates ? data.usageDates.length : 1;
            groupedData[prefix].push({ prop, count: data.count, days: uniqueDays, fullChain });
            
            if (injectedNotes[fullChain] === undefined) {
                // ✨ FIX: Ab yahan fast RAM indexer se data aayega!
                const noteBlocks = getNotesFast(fullChain);
                if (noteBlocks.length > 0) {
                  injectedNotes[fullChain] = noteBlocks; 
                }
            }
        }

        // ... BAAKI KA PURA HTML AUR LOGIC SAME RAHEGA ...

        let cardsHtml = "";
        for (const [prefix, items] of Object.entries(groupedData)) {
            items.sort((a, b) => b.days - a.days || b.count - a.count);
            let listHtml = "";
            
            items.forEach(item => {
                const isMastered = item.days >= 5;
                const hasNote = !!injectedNotes[item.fullChain];
                
                const statusIndicator = isMastered 
                  ? `<div class="indicator success" title="Mastered (5+ days)"></div>`
                  : `<span class="indicator-warning" title="Needs Improvement (${item.days}/5 days)">⚠️</span>`;
                    
                // ✨ FIX: Ab HAR ek item clickable hai (`onclick` sab par laga hai)
                listHtml += `
                <div class="prop-item ${hasNote ? 'has-note' : ''}" onclick="openNoteModal('${item.fullChain}')" style="cursor: pointer;">
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
                <div class="card-title">${prefix} Object</div>
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
    <title>Mohit's Syntax Analytics</title>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/tokyo-night-dark.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500&family=Inter:wght@400;500;600&display=swap');
        
        :root {
            --bg-deep: #0f0f14;
            --bg-card: #1a1a24;
            --bg-card-hover: #222230;
            --border-color: #2e2e3e;
            --text-primary: #e0e0e0;
            --text-secondary: #8c8c9b;
            --accent-purple: #cba6f7;
            --accent-blue: #89b4fa;
            --accent-green: #a6e3a1;
        }

        body {
            background-color: var(--bg-deep); color: var(--text-primary); 
            font-family: 'Inter', sans-serif;
            margin: 0; padding: 40px; box-sizing: border-box;
        }
        
        .header { margin-bottom: 40px; border-bottom: 1px solid var(--border-color); padding-bottom: 20px; }
        .header h1 { color: var(--accent-purple); font-size: 2rem; margin: 0 0 8px 0; font-weight: 600; letter-spacing: -0.5px; }
        .header p { color: var(--text-secondary); font-size: 0.95rem; margin: 0; }
        
        /* CARDS GRID */
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
        
        .card { 
            background-color: var(--bg-card); 
            border: 1px solid var(--border-color); 
            border-radius: 10px; overflow: hidden; 
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .card:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 20px rgba(0,0,0,0.4);
        }

        .card-title {
            background-color: rgba(0,0,0,0.2); padding: 12px 16px; 
            font-family: 'Fira Code', monospace; font-size: 0.9rem; 
            font-weight: 600; color: var(--accent-blue); 
            border-bottom: 1px dashed var(--border-color); text-transform: uppercase; letter-spacing: 0.5px;
        }
        
        .prop-list { display: flex; flex-direction: column; }
        .prop-item {
            display: flex; justify-content: space-between; align-items: center; 
            padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.03); transition: all 0.2s;
        }
        .prop-item:last-child { border-bottom: none; }
        
        /* Subtle hover effect for all items */
        .prop-item:hover { background-color: var(--bg-card-hover); }
        
        .prop-item.has-note:hover { 
            padding-left: 20px; 
            border-left: 3px solid var(--accent-purple);
        }
        
        .prop-main { display: flex; align-items: center; gap: 10px; }
        .prop-name { font-family: 'Fira Code', monospace; font-size: 0.9rem; color: #f5e0dc; }
        .note-icon { font-size: 0.85rem; opacity: 0.8; }
        
        .indicator { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .indicator.success { background-color: var(--accent-green); box-shadow: 0 0 8px rgba(166, 227, 161, 0.4); }
        .indicator-warning { font-size: 0.7rem; margin-right: 2px; cursor: help; }
        .count-pill { font-size: 0.75rem; color: var(--text-secondary); background: rgba(0,0,0,0.3); padding: 3px 8px; border-radius: 12px; font-weight: 600; }

        /* MODAL */
        .modal-overlay {
            display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(8px);
            justify-content: center; align-items: center; z-index: 100;
        }
        .modal-overlay.active { display: flex; }
        
        .modal-content {
            background: var(--bg-deep); border: 1px solid var(--border-color); border-radius: 12px;
            width: 85vw; height: 85vh; display: flex; flex-direction: column;
            box-shadow: 0 20px 50px rgba(0,0,0,0.8); overflow: hidden;
        }
        
        .modal-header {
            padding: 18px 24px; border-bottom: 1px solid var(--border-color);
            display: flex; justify-content: space-between; align-items: center; background: #0a0a0f;
        }
        .modal-title { font-family: 'Fira Code', monospace; color: var(--text-primary); font-size: 1.2rem; margin: 0; color: var(--accent-purple); }
        
        .close-btn { background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 1.5rem; transition: color 0.2s; }
        .close-btn:hover { color: #f38ba8; }
        
        .modal-body { padding: 30px; overflow-y: auto; flex-grow: 1; }
        
        /* DOCUMENT VIEWER */
        .def-block {
            background: var(--bg-card); border: 1px solid var(--border-color);
            border-radius: 10px; margin-bottom: 30px; overflow: hidden; box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        }
        
        .def-header {
            background: #11111b; padding: 12px 20px;
            border-bottom: 1px solid var(--border-color); display: flex; align-items: center;
        }
        .mac-dots { display: flex; gap: 8px; margin-right: 15px; }
        .mac-dot { width: 12px; height: 12px; border-radius: 50%; }
        .mac-dot.red { background: #f38ba8; }
        .mac-dot.yellow { background: #f9e2af; }
        .mac-dot.green { background: #a6e3a1; }
        
        .def-header-title { font-family: 'Inter', sans-serif; font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600; letter-spacing: 1px; }

        .def-content { padding: 30px 35px; color: #cdd6f4; font-size: 1.05rem; }
        .def-content h1, .def-content h2, .def-content h3 { color: var(--accent-blue); border-bottom: 1px solid rgba(137, 180, 250, 0.2); padding-bottom: 10px; margin-top: 0; font-weight: 600; }
        .def-content p { line-height: 1.8; color: #bac2de; margin-bottom: 20px; }
        .def-content a { color: var(--accent-purple); text-decoration: none; border-bottom: 1px dashed var(--accent-purple); }
        .def-content blockquote { border-left: 4px solid var(--accent-purple); background: rgba(203, 166, 247, 0.08); margin: 20px 0; padding: 15px 25px; border-radius: 0 8px 8px 0; font-style: italic; color: #a6adc8; }
        .def-content pre { background: #08080c; padding: 20px; border-radius: 8px; overflow-x: auto; border: 1px solid var(--border-color); margin: 25px 0; }
        .def-content code { font-family: 'Fira Code', monospace; font-size: 0.9em; }
        .def-content p code, .def-content li code { color: #f5c2e7; background: rgba(245, 194, 231, 0.1); padding: 3px 6px; border-radius: 4px; }
        .def-content img { max-width: 100%; border-radius: 8px; margin: 20px 0; border: 1px solid var(--border-color); box-shadow: 0 5px 15px rgba(0,0,0,0.5); }
        
        /* THE SEXY SOURCE FOOTER */
        .def-footer {
            background: #11111b; padding: 16px 25px; border-top: 1px dashed var(--border-color);
            display: flex; justify-content: space-between; align-items: center; gap: 10px;
        }
        
        .source-wrapper { display: flex; flex-direction: column; gap: 4px; }
        .source-label { font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600; letter-spacing: 1px; }
        .file-link {
            color: var(--accent-blue); font-family: 'Fira Code', monospace; font-size: 0.9rem;
            text-decoration: none; word-break: break-all; transition: color 0.2s;
        }
        .file-link:hover { color: var(--accent-purple); text-decoration: underline; }
        
        .copy-btn {
            background: #1e1e2e; color: #cdd6f4; border: 1px solid var(--border-color);
            padding: 8px 14px; border-radius: 6px; font-size: 0.85rem; font-weight: 500; font-family: 'Inter', sans-serif;
            cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 6px;
        }
        .copy-btn:hover { background: #313244; border-color: var(--accent-blue); }
        .copy-btn.copied { background: var(--accent-green); color: #000; border-color: var(--accent-green); }

    </style>
</head>
<body>
    <div class="header">
        <h1>Syntax Analytics Center</h1>
        <p>Aapke saare mastered objects aur pending syntax ek hi jagah. Green dot = 5+ days mastered.</p>
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
            }).catch(err => alert("Failed to copy path: " + err));
        }

        // ✨ MODAL OPENER
        function openNoteModal(fullChain) {
            const modal = document.getElementById('noteModal');
            const title = document.getElementById('modalTitle');
            const body = document.getElementById('modalBody');

            title.innerText = "Syntax: " + fullChain;
            
            // Ab notes array "console.log" (fullChain) se aayega
            const noteBlocks = injectedNotes[fullChain] || [];
            
            if(noteBlocks.length === 0) {
                body.innerHTML = "<div style='text-align:center; color:var(--text-secondary); padding:50px;'><h3>Notes abhi available nahi hain!</h3><p>ChatGPT bot background me notes generate kar raha hoga, ya shayad ye file paths me abhi save nahi hue. Thodi der baad Dashboard reload karo.</p></div>";
            } else {
                let generatedHtml = "";
                
                noteBlocks.forEach((block) => {
                    let parsedMarkdown = "";
                    try { parsedMarkdown = marked.parse(block.content); } 
                    catch (error) { parsedMarkdown = "<div style='color:#f38ba8;'>⚠️ Error parsing markdown.</div>"; }
                    
                    generatedHtml += \`
                        <div class="def-block">
                            <div class="def-header">
                                <div class="mac-dots">
                                    <div class="mac-dot red"></div><div class="mac-dot yellow"></div><div class="mac-dot green"></div>
                                </div>
                                <span class="def-header-title">Developer Notes</span>
                            </div>
                            
                            <div class="def-content">
                                \${parsedMarkdown}
                            </div>
                            
                            <div class="def-footer">
                                <div class="source-wrapper">
                                    <span class="source-label">Source File</span>
                                    <a href="file://\${block.sourceFile}" target="_blank" class="file-link" title="Click to open raw file">
                                        📁 \${block.sourceFile}
                                    </a>
                                </div>
                                <button class="copy-btn" onclick="copyPath(this, '\${block.sourceFile.replace(/\\\\/g, '\\\\\\\\')}')">
                                    📋 Copy Path
                                </button>
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

        const uniqueFilename = `mohit_syntax_memory_${Date.now()}.html`;
        const tempPath = path.join(os.tmpdir(), uniqueFilename);
        
        fs.writeFileSync(tempPath, htmlContent, 'utf8');
        vscode.env.openExternal(vscode.Uri.file(tempPath));
    });
}