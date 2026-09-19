export type FileType = 'tex' | 'bib' | 'sty' | 'cls' | 'txt' | 'svg' | 'folder';

export interface FileItem {
  id: string;
  name: string;
  path: string;
  type: FileType;
  content?: string; // If file
  children?: string[]; // If folder (array of IDs)
  parentId?: string | null;
  isOpen?: boolean; // For folders
}

export interface WorkspaceState {
  files: Record<string, FileItem>;
  rootIds: string[];
  activeFileId: string;
  diskPath?: string; // Physical folder on disk (e.g. E:\latex_workspace\my_paper)
}

export interface Diagnostic {
  line: number;
  message: string;
  type: 'error' | 'warning' | 'info';
}

export interface SyncLocation {
  fileId?: string;
  fileName?: string;
  line: number;
}

export type LatexEngine = 'xelatex' | 'pdflatex' | 'auto';

export interface CompileResult {
  html: string;
  title: string;
  titleLoc?: SyncLocation;
  authors: string[];
  authorsLoc?: SyncLocation;
  date: string;
  abstract: string;
  abstractLoc?: SyncLocation;
  diagnostics: Diagnostic[];
  compileTimeMs: number;
  toc: { id: string; title: string; level: number }[];
  pageCountEstimate: number;
  engine?: 'xelatex' | 'pdflatex';
}

export interface Template {
  id: string;
  name: string;
  description: string;
  badge: string;
  files: Record<string, { name: string; type: FileType; content: string }>;
  mainFile: string;
}
