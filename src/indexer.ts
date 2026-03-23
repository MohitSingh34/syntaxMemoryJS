import * as vscode from "vscode";
import * as fs from 'fs';
import * as path from 'path';
import { NoteBlock } from "./types";

interface IndexEntry {
    sourceFile: string;
    startLine: number;
    endLine: number;
}

// RAM Cache
let ramIndex: Record<string, IndexEntry[]> = {};
let indexPath = '';

export function initIndexer(context: vscode.ExtensionContext, notesPaths: string[]) {
    // Index JSON extension ki global storage me save hoga taaki tumhara workspace clean rahe
    indexPath = path.join(context.globalStorageUri.fsPath, 'notes_index.json');
    
    if (!fs.existsSync(context.globalStorageUri.fsPath)) {
        fs.mkdirSync(context.globalStorageUri.fsPath, { recursive: true });
    }
    
    if (fs.existsSync(indexPath)) {
        try {
            ramIndex = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
        } catch (e) {
            buildIndex(notesPaths); // Agar file corrupt hai to rebuild karo
        }
    } else {
        buildIndex(notesPaths);
    }
}

export function buildIndex(notesPaths: string[]) {
    ramIndex = {};
    for (const rawPath of notesPaths) {
        let cleanPath = rawPath.startsWith('file://') ? rawPath.replace('file://', '') : rawPath;
        if (!fs.existsSync(cleanPath) || !fs.statSync(cleanPath).isFile()) continue;

        const content = fs.readFileSync(cleanPath, 'utf-8');
        const lines = content.split('\n');
        
        let currentWord: string | null = null;
        let startLine = -1;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith("@de ")) {
                if (currentWord && startLine !== -1) {
                    if (!ramIndex[currentWord]) ramIndex[currentWord] = [];
                    ramIndex[currentWord].push({ sourceFile: cleanPath, startLine, endLine: i - 1 });
                }
                currentWord = line.replace("@de ", "").trim();
                startLine = i + 1;
            }
        }
        if (currentWord && startLine !== -1) {
            if (!ramIndex[currentWord]) ramIndex[currentWord] = [];
            ramIndex[currentWord].push({ sourceFile: cleanPath, startLine, endLine: lines.length - 1 });
        }
    }
    fs.writeFileSync(indexPath, JSON.stringify(ramIndex, null, 2), 'utf-8');
    vscode.window.showInformationMessage("Syntax Memory: Notes Index Refreshed! ⚡");
}

export function getNotesFast(word: string): NoteBlock[] {
    const entries = ramIndex[word];
    if (!entries) return [];

    let notes: NoteBlock[] = [];
    for (const entry of entries) {
        if (!fs.existsSync(entry.sourceFile)) continue;
        
        // Fast line reading logic
        const content = fs.readFileSync(entry.sourceFile, 'utf-8');
        const lines = content.split('\n');
        let noteContent = lines.slice(entry.startLine, entry.endLine + 1).join('\n').trim();
        
        noteContent = noteContent.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
            let parsedUrl = url.trim();
            if (!parsedUrl.match(/^(http|https|file|data):/i)) {
                const mdDir = path.dirname(entry.sourceFile);
                const resolvedPath = path.resolve(mdDir, parsedUrl);
                parsedUrl = vscode.Uri.file(resolvedPath).toString();
            }
            return `![${alt}](${parsedUrl})`;
        });
        
        if (noteContent !== "") {
            notes.push({ content: noteContent, sourceFile: entry.sourceFile });
        }
    }
    return notes;
}

export function checkNoteExistsFast(word: string): boolean {
    return !!ramIndex[word] && ramIndex[word].length > 0;
}