import { FileItem } from './latex';

export interface SnapshotItem {
  id: string;
  name: string;
  description?: string;
  timestamp: number;
  fileCount: number;
  files: Record<string, FileItem>;
  activeFileId: string;
  rootIds: string[];
}
