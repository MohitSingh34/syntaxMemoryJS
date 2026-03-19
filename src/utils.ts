import * as vscode from "vscode";
import * as fs from 'fs';
import * as path from 'path';
import { NoteBlock } from "./types";

export function getNotesPaths(): string[] {
  return vscode.workspace.getConfiguration("syntaxmemory").get<string[]>("notesFilePaths") || [];
}

export function getCustomBuiltIns(): string[] {
  return vscode.workspace.getConfiguration("syntaxmemory").get<string[]>("customBuiltIns") || [];
}

export function getContextPrefix(lineText: string): string | null {
  const cleanText = lineText.replace(/\([^)]*\)/g, "").replace(/\[[^\]]*\]/g, "");
  const match = cleanText.match(/([a-zA-Z0-9_$]+(?:\.[a-zA-Z0-9_$]+)*)\.$/);
  if (!match) return null;
  return match[1].split(".")[0]; 
}

// 🔥 Helper Function: Extract multiple note blocks for a specific word safely
export function getNotesForWord(word: string, notesPaths: string[]): NoteBlock[] {
  let notes: NoteBlock[] = [];
  
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
            if (isRecording) { 
                saveCurrentNote(); 
            }
            if (line === `@de ${word}`) { 
                isRecording = true; 
            } else { 
                isRecording = false; 
            }
            continue;
          }

          if (isRecording) {
            currentNote += lines[i] + "  \n";
          }
        }
        
        if (isRecording) {
            saveCurrentNote();
        }
      }
    } catch (error) {
       console.warn(`[Syntax Memory] Skipping invalid or unreadable path: ${rawPath}`, error);
    }
  }
  return notes;
}