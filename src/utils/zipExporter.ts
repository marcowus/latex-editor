import JSZip from 'jszip';
import { WorkspaceState, FileItem } from '../types/latex';

export async function exportWorkspaceAsZip(workspace: WorkspaceState, projectName = 'latex-project'): Promise<void> {
  const zip = new JSZip();

  // Helper to build file path from workspace
  const getFullPath = (file: FileItem): string => {
    let current: FileItem | undefined = file;
    const parts: string[] = [file.name];

    while (current && current.parentId) {
      current = workspace.files[current.parentId];
      if (current) {
        parts.unshift(current.name);
      }
    }

    return parts.join('/');
  };

  // Add all files into zip
  for (const file of Object.values(workspace.files)) {
    if (file.type === 'folder') continue;

    const fullPath = getFullPath(file);
    const content = file.content || '';
    zip.file(fullPath, content);
  }

  // Generate blob and trigger browser download
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectName.replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, '_')}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
