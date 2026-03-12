import * as vscode from "vscode";
import * as fs from 'fs';
import * as path from 'path';

const KNOWN_BUILT_INS = new Set([
  "console", "Math", "Object", "Array", "String", "Number", "JSON", 
  "Promise", "document", "window", "localStorage", "sessionStorage", 
  "navigator", "this",
]);

interface MemoryData {
  count: number;
  paths: string[];
}

function getNotesPaths(): string[] {
  return vscode.workspace.getConfiguration("syntaxmemory").get<string[]>("notesFilePaths") || [];
}

export function activate(context: vscode.ExtensionContext) {
  let usageMemory = context.globalState.get<{ [key: string]: MemoryData }>("mohitWorkspaceMemory", {});
  let isQueryingBuiltIn = false;

  function getContextPrefix(lineText: string): string {
    const cleanText = lineText.replace(/\([^)]*\)/g, "").replace(/\[[^\]]*\]/g, "");
    const match = cleanText.match(/([a-zA-Z0-9_$]+(?:\.[a-zA-Z0-9_$]+)*)\.$/);
    if (!match) return "GLOBAL";

    let parts = match[1].split(".");
    if (!KNOWN_BUILT_INS.has(parts[0])) {
      parts[0] = "VARIABLE";
    }
    return parts.join(".");
  }

  // ==========================================================
  // COMPLETION PROVIDER
  // ==========================================================
  const provider = vscode.languages.registerCompletionItemProvider(
    ["javascript", "css", "html", "typescript"],
    {
      async provideCompletionItems(document, position) {
        if (isQueryingBuiltIn) return [];
        isQueryingBuiltIn = true;

        try {
          const linePrefixText = document.lineAt(position.line).text.substring(0, position.character);
          const currentPrefix = getContextPrefix(linePrefixText);

          const builtInList = await vscode.commands.executeCommand<vscode.CompletionList>(
            "vscode.executeCompletionItemProvider", document.uri, position
          );

          if (!builtInList || !builtInList.items) return [];

          const modifiedItems = builtInList.items.map((item) => {
            const originalLabel = typeof item.label === "string" ? item.label : item.label.label;
            const memoryKey = `${currentPrefix}|${originalLabel}`;

            const memoryEntry = usageMemory[memoryKey] || { count: 0, paths: [] };
            const count = memoryEntry.count;

            const invisibleChar = "\u200B";
            if (typeof item.label === "string") {
              item.label = originalLabel + invisibleChar;
            } else {
              item.label.label = originalLabel + invisibleChar;
            }

            if (!item.insertText) {
              item.insertText = originalLabel;
            } else if (typeof item.insertText === "string") {
              item.insertText = item.insertText.replace("\u200B", "");
            }

            if (count > 0) {
              item.detail = `🔥 Used ${count} times (Ctx: ${currentPrefix}) | ${item.detail || ""}`;
              const sortPriority = (10000 - count).toString().padStart(4, "0");
              item.sortText = ` ${sortPriority}_${originalLabel}`;
              item.preselect = true;
            } else {
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
        } catch (e) {
          console.error(e);
          return [];
        } finally {
          isQueryingBuiltIn = false;
        }
      },
    },
    ".", " "
  );

  // ==========================================================
  // ACTION COMMAND
  // ==========================================================
  const recordCommand = vscode.commands.registerCommand(
    "syntaxmemory.recordUsage",
    (memoryKey: string, filePath: string) => {
      const currentData = usageMemory[memoryKey] || { count: 0, paths: [] };
      currentData.count += 1;

      if (!currentData.paths.includes(filePath)) {
        currentData.paths.push(filePath);
      }

      usageMemory[memoryKey] = currentData;
      context.globalState.update("mohitWorkspaceMemory", usageMemory);
    }
  );

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
    } else {
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
  // HOVER PROVIDER: SMART LINKS & MULTI-FILE TITLES
  // ==========================================================
  const hoverProvider = vscode.languages.registerHoverProvider(
    ["javascript", "css", "html", "typescript"],
    {
      provideHover(document, position) {
        const range = document.getWordRangeAtPosition(position);
        if (!range) return;
        const hoveredWord = document.getText(range);

        const notesPaths = getNotesPaths();
        
        if (!notesPaths || notesPaths.length === 0) {
            const md = new vscode.MarkdownString("⚠️ **Syntax Memory:** Please add your notes file paths in VS Code Settings (`syntaxmemory.notesFilePaths`).");
            return new vscode.Hover(md);
        }

        let foundNotes: { file: string, content: string }[] = [];

        for (const filePath of notesPaths) {
          if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n');
            let isRecording = false;
            let currentNoteContent = "";

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim();
              
              if (line === `@de ${hoveredWord}`) {
                isRecording = true;
                continue; 
              }
              
              if (isRecording && line.startsWith("@de ")) break; 
              if (isRecording) {
                  currentNoteContent += lines[i] + "\n";
              }
            }

            if (currentNoteContent.trim() !== "") {
              foundNotes.push({ file: filePath, content: currentNoteContent.trim() });
            }
          }
        }

        if (foundNotes.length > 0) {
          const md = new vscode.MarkdownString();
          md.isTrusted = true; 
          
          md.appendMarkdown(`### 📝 Notes for \`${hoveredWord}\`\n---\n`);
          
          for (const note of foundNotes) {
              const fileName = path.basename(note.file);
              
              // ACTIONABLE: Multi-file Title Header
              md.appendMarkdown(`#### 📄 From: \`${fileName}\`\n`);
              
              const lines = note.content.split('\n');
              let safeCodeContent = "";
              let extractedLinks: string[] = [];
              const urlRegex = /(https?:\/\/[^\s]+)/g;

              for (const line of lines) {
                  // ACTIONABLE: Link Extraction Logic
                  const links = line.match(urlRegex);
                  if (links) extractedLinks.push(...links);
                  
                  safeCodeContent += line + "\n";
              }

              // Code safe rahega aur HTML tags properly dikhenge
              md.appendCodeblock(safeCodeContent.trim(), 'html');
              
              // Agar us note me links the, toh unhe niche clickable bana kar dikhao
              if (extractedLinks.length > 0) {
                  const uniqueLinks = [...new Set(extractedLinks)]; // Remove duplicates
                  md.appendMarkdown(`**🔗 Quick Links:**\n`);
                  uniqueLinks.forEach(link => {
                      md.appendMarkdown(`* [${link}](${link})\n`);
                  });
              }
              md.appendMarkdown(`\n---\n`);
          }
          
          md.appendMarkdown(`**📂 Open Source Files:**\n\n`);
          
          foundNotes.forEach((note) => {
              const fileName = path.basename(note.file); 
              const args = encodeURIComponent(JSON.stringify([hoveredWord, note.file]));
              md.appendMarkdown(`[✏️ Edit in \`${fileName}\`](command:syntaxmemory.openNotes?${args})  \n`);
          });
          
          return new vscode.Hover(md);
        }
      }
    }
  );

  // ==========================================================
  // SPLIT SCREEN COMMAND
  // ==========================================================
  const openNotesCmd = vscode.commands.registerCommand("syntaxmemory.openNotes", async (searchWord: string, targetPath: string) => {
    if (!targetPath || !fs.existsSync(targetPath)) return;

    const uri = vscode.Uri.file(targetPath); 
    
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc, {
      viewColumn: vscode.ViewColumn.Beside, 
      preserveFocus: false
    });

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

  context.subscriptions.push(provider, recordCommand, hoverProvider, openNotesCmd, viewMemoryCommand);
}

export function deactivate() {}