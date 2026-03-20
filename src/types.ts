export const DEFAULT_BUILT_INS = [
  "console", "Math", "Object", "Array", "String", "Number", "JSON",
  "Promise", "document", "window", "localStorage", "sessionStorage",
  "navigator", "this",
];

export interface MemoryData {
  count: number;
  usageDates: string[];
  paths: string[];
}

export interface NoteBlock {
  content: string;
  sourceFile: string;
}