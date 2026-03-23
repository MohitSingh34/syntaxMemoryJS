import * as vscode from "vscode";
import * as path from 'path';
// Yahan se getNotesPaths hata diya hai
import { getNotesFast } from "./indexer";


const SUPPORTED_LANGS = [
    "javascript", "javascriptreact", 
    "typescript", "typescriptreact", 
    "css", "html", "json"
];

export function registerProviders(context: vscode.ExtensionContext) {
    const hoverProvider = vscode.languages.registerHoverProvider(
        SUPPORTED_LANGS,
        {
            provideHover(document, position) {
                try {
                    const wordRegex = /[a-zA-Z0-9_$]+(?:\.[a-zA-Z0-9_$]+)*/;
                    const range = document.getWordRangeAtPosition(position, wordRegex);
                    
                    if (!range) return;
                    const hoveredWord = document.getText(range);
                    
                    // ✨ FIX: File line-by-line read karne ke bajaye direct RAM se utha rahe hain!
                    const noteBlocks = getNotesFast(hoveredWord);

                    if (noteBlocks.length > 0) {
                        const md = new vscode.MarkdownString();
                        md.isTrusted = true;
                        md.supportHtml = true;
                        md.appendMarkdown(`### 📝 Notes for \`${hoveredWord}\`\n---\n`);

                        noteBlocks.forEach((noteBlock, index) => {
                            try {
                                let processedContent = noteBlock.content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
                                    try {
                                        if (!url || url.trim() === "") throw new Error("Empty URL");
                                        const safeUrl = url.replace(/"/g, '&quot;');
                                        const args = encodeURIComponent(JSON.stringify([url]));
                                        return `<a href="command:syntaxmemory.openImage?${args}" title="Click to open full image"><img src="${safeUrl}" width="200" alt="${alt}"></a>`;
                                    } catch (e) {
                                        return `\n\n> ⚠️ *Oops! Is image link me kuch syntax error hai.* \n\n`;
                                    }
                                });

                                md.appendMarkdown(`${processedContent}\n\n`);
                                const fileName = path.basename(noteBlock.sourceFile);
                                const args = encodeURIComponent(JSON.stringify([hoveredWord, noteBlock.sourceFile]));
                                md.appendMarkdown(`*📂 Source: [${fileName}](command:syntaxmemory.openNotes?${args})*\n\n`);
                            } catch (blockError) {}

                            if (index < noteBlocks.length - 1) md.appendMarkdown(`---\n\n`);
                        });
                        return new vscode.Hover(md);
                    }
                } catch (error: any) {}
            }
        }
    );

    context.subscriptions.push(hoverProvider);
}