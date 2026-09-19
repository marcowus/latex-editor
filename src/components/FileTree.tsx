import React, { useState } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  Plus,
  Trash2,
  Edit2,
  Download,
  Upload,
  BookOpen,
  Check,
  X,
  FilePlus,
  FolderPlus,
  FolderArchive,
  HardDrive,
} from 'lucide-react';
import { FileItem, FileType, WorkspaceState } from '../types/latex';
import { TEMPLATES } from '../data/templates';
import JSZip from 'jszip';

interface FileTreeProps {
  workspace: WorkspaceState;
  onSelectFile: (fileId: string) => void;
  onUpdateFile: (fileId: string, content: string) => void;
  onCreateFile: (name: string, type: FileType, parentId?: string | null) => void;
  onDeleteFile: (fileId: string) => void;
  onRenameFile: (fileId: string, newName: string) => void;
  onLoadTemplate: (templateId: string) => void;
  onOpenImportZip?: () => void;
}

export const FileTree: React.FC<FileTreeProps> = ({
  workspace,
  onSelectFile,
  onCreateFile,
  onDeleteFile,
  onRenameFile,
  onLoadTemplate,
  onOpenImportZip,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [newFileInputParent, setNewFileInputParent] = useState<string | null | undefined>(undefined);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});

  const toggleFolder = (folderId: string) => {
    setCollapsedFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  };

  const handleStartRename = (file: FileItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(file.id);
    setEditName(file.name);
  };

  const handleSaveRename = (fileId: string) => {
    if (editName.trim()) {
      onRenameFile(fileId, editName.trim());
    }
    setEditingId(null);
  };

  const handleConfirmCreate = () => {
    if (!newItemName.trim()) {
      setNewFileInputParent(undefined);
      return;
    }
    const name = newItemName.trim();
    let type: FileType = 'tex';
    if (isCreatingFolder) {
      type = 'folder';
    } else if (name.endsWith('.bib')) {
      type = 'bib';
    } else if (name.endsWith('.sty')) {
      type = 'sty';
    } else if (name.endsWith('.cls')) {
      type = 'cls';
    } else if (name.endsWith('.svg')) {
      type = 'svg';
    } else if (!name.includes('.')) {
      type = 'tex';
    }

    const finalName = !isCreatingFolder && !name.includes('.') ? `${name}.tex` : name;
    onCreateFile(finalName, type, newFileInputParent);
    setNewFileInputParent(undefined);
    setNewItemName('');
    setIsCreatingFolder(false);
  };

  // Export entire workspace as ZIP
  const handleExportZip = async () => {
    const zip = new JSZip();
    for (const file of Object.values(workspace.files)) {
      if (file.type !== 'folder') {
        zip.file(file.path.replace(/^\//, ''), file.content || '');
      }
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'latex-project.zip';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import local file (.tex, .bib, .txt)
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = evt => {
      const content = (evt.target?.result as string) || '';
      let type: FileType = 'tex';
      if (file.name.endsWith('.bib')) type = 'bib';
      else if (file.name.endsWith('.sty')) type = 'sty';
      else if (file.name.endsWith('.txt')) type = 'txt';
      onCreateFile(file.name, type, null);
      // Wait a tick to set content
      setTimeout(() => {
        // find file
        const created = Object.values(workspace.files).find(f => f.name === file.name);
        if (created) {
          created.content = content;
        }
      }, 50);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const getFileIcon = (file: FileItem) => {
    if (file.type === 'folder') {
      return collapsedFolders[file.id] ? (
        <Folder className="w-4 h-4 text-amber-500 shrink-0" />
      ) : (
        <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
      );
    }
    if (file.type === 'bib') {
      return <FileText className="w-4 h-4 text-emerald-500 shrink-0" />;
    }
    if (file.type === 'sty' || file.type === 'cls') {
      return <FileCode className="w-4 h-4 text-purple-500 shrink-0" />;
    }
    return <FileCode className="w-4 h-4 text-blue-500 shrink-0" />;
  };

  const renderItem = (fileId: string, level = 0) => {
    const file = workspace.files[fileId];
    if (!file) return null;

    const isSelected = workspace.activeFileId === file.id;
    const isFolder = file.type === 'folder';
    const isCollapsed = collapsedFolders[file.id];

    return (
      <div key={file.id} className="select-none text-xs">
        <div
          onClick={() => {
            if (isFolder) toggleFolder(file.id);
            else onSelectFile(file.id);
          }}
          style={{ paddingLeft: `${level * 14 + 12}px` }}
          className={`group flex items-center justify-between py-1.5 pr-2 rounded-md cursor-pointer transition-all ${
            isSelected
              ? 'bg-indigo-50 text-indigo-700 font-semibold border-l-2 border-indigo-600'
              : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
          }`}
        >
          <div className="flex items-center gap-1.5 truncate mr-1">
            {getFileIcon(file)}
            {editingId === file.id ? (
              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSaveRename(file.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  autoFocus
                  className="px-1 py-0.5 text-xs bg-white border border-indigo-400 rounded outline-hidden w-24 text-slate-800"
                />
                <button
                  onClick={() => handleSaveRename(file.id)}
                  className="p-0.5 text-emerald-600 hover:bg-emerald-50 rounded"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="p-0.5 text-slate-400 hover:bg-slate-100 rounded"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <span className="truncate">{file.name}</span>
            )}
          </div>

          {/* Action buttons on hover */}
          {editingId !== file.id && (
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0 transition-opacity">
              {isFolder && (
                <button
                  title="在此目录下新建文件"
                  onClick={e => {
                    e.stopPropagation();
                    setNewFileInputParent(file.id);
                    setIsCreatingFolder(false);
                    setNewItemName('');
                  }}
                  className="p-1 hover:text-indigo-600 hover:bg-slate-200/60 rounded"
                >
                  <Plus className="w-3 h-3" />
                </button>
              )}
              <button
                title="重命名"
                onClick={e => handleStartRename(file, e)}
                className="p-1 hover:text-indigo-600 hover:bg-slate-200/60 rounded"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              {file.name !== 'main.tex' && (
                <button
                  title="删除文件"
                  onClick={e => {
                    e.stopPropagation();
                    if (confirm(`确定删除 ${file.name} 吗？`)) {
                      onDeleteFile(file.id);
                    }
                  }}
                  className="p-1 hover:text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Render children if folder is open */}
        {isFolder && !isCollapsed && file.children && (
          <div>
            {file.children.map(childId => renderItem(childId, level + 1))}
            {newFileInputParent === file.id && (
              <div
                style={{ paddingLeft: `${(level + 1) * 14 + 12}px` }}
                className="flex items-center gap-1 py-1 pr-2"
              >
                <FileCode className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder={isCreatingFolder ? '文件夹名称...' : '文件名.tex...'}
                  value={newItemName}
                  onChange={e => setNewItemName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleConfirmCreate();
                    if (e.key === 'Escape') setNewFileInputParent(undefined);
                  }}
                  autoFocus
                  className="px-1.5 py-0.5 text-xs bg-white border border-indigo-400 rounded outline-hidden w-28 text-slate-800"
                />
                <button onClick={handleConfirmCreate} className="p-0.5 text-emerald-600 hover:bg-emerald-50 rounded">
                  <Check className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setNewFileInputParent(undefined)}
                  className="p-0.5 text-slate-400 hover:bg-slate-100 rounded"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 border-r border-slate-200 select-none">
      {/* Top Header of Explorer */}
      <div className="p-3 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Folder className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">工作文件夹</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            title="新建文件"
            onClick={() => {
              setNewFileInputParent(null);
              setIsCreatingFolder(false);
              setNewItemName('');
            }}
            className="p-1 text-slate-600 hover:text-indigo-600 hover:bg-slate-200/70 rounded transition-colors"
          >
            <FilePlus className="w-3.5 h-3.5" />
          </button>
          <button
            title="新建文件夹"
            onClick={() => {
              setNewFileInputParent(null);
              setIsCreatingFolder(true);
              setNewItemName('');
            }}
            className="p-1 text-slate-600 hover:text-indigo-600 hover:bg-slate-200/70 rounded transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick Template & Action Bar */}
      <div className="px-3 py-2 bg-slate-100/70 border-b border-slate-200/80 flex items-center justify-between text-xs">
        <button
          onClick={() => setShowTemplateModal(true)}
          className="flex items-center gap-1.5 text-indigo-700 font-medium hover:text-indigo-900 transition-colors py-1 px-1.5 rounded hover:bg-indigo-50/80"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>模板库</span>
        </button>

        <div className="flex items-center gap-1.5">
          {onOpenImportZip && (
            <button
              title="导入 ZIP 压缩包至 E 盘工作区"
              onClick={onOpenImportZip}
              className="p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded transition-colors"
            >
              <FolderArchive className="w-3.5 h-3.5" />
            </button>
          )}
          <label
            title="导入本地单个 .tex 或 .bib 文件"
            className="cursor-pointer p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <input type="file" accept=".tex,.bib,.sty,.txt" onChange={handleImportFile} className="hidden" />
          </label>
          <button
            title="打包导出整个工程 (ZIP)"
            onClick={handleExportZip}
            className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Root creation input */}
      {newFileInputParent === null && (
        <div className="px-3 py-1.5 bg-indigo-50/50 border-b border-indigo-100 flex items-center gap-1.5 text-xs">
          {isCreatingFolder ? (
            <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          ) : (
            <FileCode className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          )}
          <input
            type="text"
            placeholder={isCreatingFolder ? '文件夹名称...' : '新文件名 (如 chapter.tex)...'}
            value={newItemName}
            onChange={e => setNewItemName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleConfirmCreate();
              if (e.key === 'Escape') setNewFileInputParent(undefined);
            }}
            autoFocus
            className="px-1.5 py-0.5 text-xs bg-white border border-indigo-400 rounded outline-hidden w-full text-slate-800"
          />
          <button onClick={handleConfirmCreate} className="p-0.5 text-emerald-600 hover:bg-emerald-50 rounded shrink-0">
            <Check className="w-3 h-3" />
          </button>
          <button
            onClick={() => setNewFileInputParent(undefined)}
            className="p-0.5 text-slate-400 hover:bg-slate-100 rounded shrink-0"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* File Tree List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {workspace.rootIds.map(id => renderItem(id, 0))}
      </div>

      {/* Workspace Footer Info */}
      <div className="p-2.5 bg-slate-100/90 border-t border-slate-200 text-[11px] text-slate-500 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span>工程文件: {Object.keys(workspace.files).length} 项</span>
          {workspace.diskPath ? (
            <span
              title={`已关联 E 盘物理文件夹:\n${workspace.diskPath}`}
              className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 flex items-center gap-1 font-medium cursor-help"
            >
              <HardDrive className="w-3 h-3" /> E 盘同步
            </span>
          ) : (
            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              本地已存储
            </span>
          )}
        </div>
        {workspace.diskPath && (
          <div
            title={workspace.diskPath}
            onClick={onOpenImportZip}
            className="text-[10px] font-mono text-slate-600 truncate cursor-pointer hover:text-indigo-600 hover:underline flex items-center gap-1 bg-white/60 px-1.5 py-0.5 rounded border border-slate-200"
          >
            <span>📁</span>
            <span className="truncate">{workspace.diskPath}</span>
          </div>
        )}
      </div>

      {/* Template Selector Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-800">切换 LaTeX 预设模板</h3>
              </div>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              选择模板将重置工作文件夹中的示例内容。请确保重要草稿已保存或下载备份。
            </p>

            <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
              {TEMPLATES.map(tmpl => (
                <div
                  key={tmpl.id}
                  onClick={() => {
                    onLoadTemplate(tmpl.id);
                    setShowTemplateModal(false);
                  }}
                  className="group p-3.5 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer flex items-start justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-slate-800 group-hover:text-indigo-700">
                        {tmpl.name}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-700">
                        {tmpl.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">{tmpl.description}</p>
                  </div>
                  <button className="shrink-0 text-xs px-2.5 py-1.5 rounded-md font-medium text-indigo-600 bg-indigo-50 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    载入
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
