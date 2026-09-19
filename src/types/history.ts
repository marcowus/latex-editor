import { FileItem } from './latex';

export type HistorySource = 'manual' | 'ai' | 'zotero' | 'wizard' | 'rollback' | 'template';

export interface FileDiffSummary {
  filePath: string;
  fileName: string;
  status: 'modified' | 'created' | 'deleted';
  addedLines: number;
  removedLines: number;
  diffLines?: {
    type: 'add' | 'del' | 'normal';
    content: string;
    lineNo?: number;
  }[];
}

export interface HistoryRecord {
  id: string;
  timestamp: number;
  source: HistorySource;
  sourceLabel: string;
  summary: string;
  details?: string[];
  tags: string[];
  fileDiffs: FileDiffSummary[];
  totalAddedLines: number;
  totalRemovedLines: number;
  snapshot: {
    files: Record<string, FileItem>;
    activeFileId: string;
    rootIds: string[];
  };
}

export interface MilestoneSnapshot {
  id: string;
  name: string;
  description?: string;
  timestamp: number;
  fileCount: number;
  files: Record<string, FileItem>;
  activeFileId: string;
  rootIds: string[];
}
