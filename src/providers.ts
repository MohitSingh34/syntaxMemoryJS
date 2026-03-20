import * as vscode from "vscode";
import * as fs from 'fs';
import * as path from 'path';
import { MemoryData, DEFAULT_BUILT_INS } from "./types";
import { getNotesPaths, getCustomBuiltIns, getContextPrefix, getNotesForWord } from "./utils";

const SUPPORTED_LANGS = [
    "javascript", "javascriptreact", 
    "typescript", "typescriptreact", 
    "css", "html", "json"
];

export function registerProviders(context: vscode.ExtensionContext) {
    // Ye fixed sets hain jo startup pe load honge
    let settingsBuiltIns = getCustomBuiltIns();
    let savedBuiltIns = context.globalState.get<string[]>("knownBuiltIns", []);
    let knownBuiltIns = new Set([...DEFAULT_BUILT_INS, ...settingsBuiltIns, ...savedBuiltIns]);

    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration("syntaxmemory.customBuiltIns")) {
            settingsBuiltIns = getCustomBuiltIns();
            knownBuiltIns = new Set([...DEFAULT_BUILT_INS, ...settingsBuiltIns, ...savedBuiltIns]);
        }
    }));

    let askedPrefixes = new Set<string>();
    let isQueryingBuiltIn = false;

    const completionProvider = vscode.languages.registerCompletionItemProvider(
        SUPPORTED_LANGS,
        {
            async provideCompletionItems(document, position) {
                if (isQueryingBuiltIn) return [];
                isQueryingBuiltIn = true;

                try {
                    // 🔥 THE FIX: Ab har baar jab dropdown khulega, ye fresh live data mangega!
                    let usageMemory = context.globalState.get<{ [key: string]: MemoryData }>("mohitWorkspaceMemory", {});

                    const linePrefixText = document.lineAt(position.line).text.substring(0, position.character);
                    let rawPrefix = getContextPrefix(linePrefixText);

                    const builtInList = await vscode.commands.executeCommand<vscode.CompletionList>(
                        "vscode.executeCompletionItemProvider", document.uri, position
                    );

                    if (!builtInList || !builtInList.items) return [];
                    if (!rawPrefix) return builtInList.items;

                    if (!knownBuiltIns.has(rawPrefix)) {
                        if (!askedPrefixes.has(rawPrefix) && rawPrefix.length > 1) {
                            askedPrefixes.add(rawPrefix);
                            vscode.window.showInformationMessage(
                                `Hey! '${rawPrefix}' naya lag raha hai. Kya ise future ke liye memory me save karein?`,
                                "Haan, Save karo", "Nahi"
                            ).then(choice => {
                                if (choice === "Haan, Save karo") {
                                    savedBuiltIns.push(rawPrefix as string);
                                    knownBuiltIns.add(rawPrefix as string);
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
                        
                        // Ab ye hamesha updated count dikhayega
                        const memoryEntry = usageMemory[memoryKey] || { count: 0, usageDates: [], paths: [] };
                        const count = memoryEntry.count;
                        const invisibleChar = "\u200B";

                        if (typeof item.label === "string") item.label = originalLabel + invisibleChar;
                        else item.label.label = originalLabel + invisibleChar;

                        if (!item.insertText) item.insertText = originalLabel;
                        else if (typeof item.insertText === "string") item.insertText = item.insertText.replace("\u200B", "");

                        if (count > 0) {
                            const uniqueDaysCount = memoryEntry.usageDates ? memoryEntry.usageDates.length : 1;
                            item.detail = `🔥 Used ${count} times (${uniqueDaysCount} days) | ${item.detail || ""}`;
                            const sortPriority = (10000 - count).toString().padStart(4, "0");
                            item.sortText = ` ${sortPriority}_${originalLabel}`;
                            item.preselect = true;
                        } else {
                            item.detail = `✨ Tracking Active | ${item.detail || ""}`;
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
        "."
    );

    const hoverProvider = vscode.languages.registerHoverProvider(
        SUPPORTED_LANGS,
        {
            provideHover(document, position) {
                try {
                    const wordRegex = /[a-zA-Z0-9_$]+(?:\.[a-zA-Z0-9_$]+)*/;
                    const range = document.getWordRangeAtPosition(position, wordRegex);
                    
                    if (!range) return;
                    const hoveredWord = document.getText(range);
                    const notesPaths = getNotesPaths();
                    
                    if (!notesPaths || notesPaths.length === 0) return;

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
                            } catch (blockError) {
                                md.appendMarkdown(`\n\n> ⚠️ *Oops! Is specific note ko render karne me error aayi.* \n\n`);
                            }

                            if (index < noteBlocks.length - 1) {
                                md.appendMarkdown(`---\n\n`);
                            }
                        });
                        return new vscode.Hover(md);
                    }
                } catch (error: any) {
                    const errorMd = new vscode.MarkdownString();
                    errorMd.appendMarkdown(`⚠️ **Oops! Kuch error huyi md file dekhne me.**\n\n> Details: ${error.message}`);
                    return new vscode.Hover(errorMd);
                }
            }
        }
    );

    context.subscriptions.push(completionProvider, hoverProvider);
}