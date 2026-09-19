import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Header } from './components/Header';
import { FileTree } from './components/FileTree';
import { CodeEditor } from './components/CodeEditor';
import { PreviewPane } from './components/PreviewPane';
import { TableWizardModal } from './components/TableWizardModal';
import { MathPaletteModal } from './components/MathPaletteModal';
import { WordCountModal } from './components/WordCountModal';
import { SnapshotManagerModal } from './components/SnapshotManagerModal';
import { LLMAssistantPanel } from './components/LLMAssistantPanel';
import { LLMDocModal } from './components/LLMDocModal';
import { ImportZipModal } from './components/ImportZipModal';
import { ExportMdModal } from './components/ExportMdModal';
import { ZoteroModal } from './components/ZoteroModal';
import { FileItem, FileType, WorkspaceState, CompileResult, LatexEngine } from './types/latex';
import { TEMPLATES } from './data/templates';
import { compileLatex } from './utils/latexParser';
import { extractBibEntries, extractLabels } from './utils/bibParser';
import { exportWorkspaceAsZip } from './utils/zipExporter';
import { CheckCircle2, AlertCircle } from 'lucide-react';

const STORAGE_KEY = 'latex_studio_workspace_v2';

// Helper to construct initial workspace from template
function createWorkspaceFromTemplate(templateId: string): WorkspaceState {
  const tmpl = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[0];
  const files: Record<string, FileItem> = {};
  const rootIds: string[] = [];

  // Group paths
  for (const [relPath, info] of Object.entries(tmpl.files)) {
    if (relPath.includes('/')) {
      const parts = relPath.split('/');
      const folderName = parts[0];
      const fileName = parts[1];
      const folderId = `folder_${folderName}`;

      if (!files[folderId]) {
        files[folderId] = {
          id: folderId,
          name: folderName,
          path: `/${folderName}`,
          type: 'folder',
          children: [],
          isOpen: true,
        };
        rootIds.push(folderId);
      }

      const fileId = `file_${relPath.replace(/[^a-zA-Z0-9]/g, '_')}`;
      files[fileId] = {
        id: fileId,
        name: fileName,
        path: `/${relPath}`,
        type: info.type,
        content: info.content,
        parentId: folderId,
      };
      files[folderId].children?.push(fileId);
    } else {
      const fileId = `file_${relPath.replace(/[^a-zA-Z0-9]/g, '_')}`;
      files[fileId] = {
        id: fileId,
        name: info.name,
        path: `/${relPath}`,
        type: info.type,
        content: info.content,
        parentId: null,
      };
      rootIds.push(fileId);
    }
  }

  // Find main.tex id
  const mainEntry = Object.values(files).find(f => f.name === tmpl.mainFile);
  const activeFileId = mainEntry ? mainEntry.id : rootIds[0];

  return {
    files,
    rootIds,
    activeFileId,
  };
}

export default function App() {
  // Initialize workspace from LocalStorage or template
  const [workspace, setWorkspace] = useState<WorkspaceState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.files && parsed.activeFileId) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return createWorkspaceFromTemplate('academic-paper');
  });

  // Layout panels toggle state
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  // Auto compile toggle & compiling state
  const [autoCompile, setAutoCompile] = useState(true);
  const [selectedEngine, setSelectedEngine] = useState<LatexEngine>('auto');
  const [isCompiling, setIsCompiling] = useState(false);
  const [jumpToLineTarget, setJumpToLineTarget] = useState<number | null>(null);
  const [forwardSyncTarget, setForwardSyncTarget] = useState<{ line: number; timestamp: number } | null>(null);

  // Modals & Panels state
  const [showTableWizard, setShowTableWizard] = useState(false);
  const [showMathPalette, setShowMathPalette] = useState(false);
  const [showWordCount, setShowWordCount] = useState(false);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [showImportZipModal, setShowImportZipModal] = useState(false);
  const [showExportMdModal, setShowExportMdModal] = useState(false);
  const [showZoteroModal, setShowZoteroModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // LLM Assistant & Doc states
  const [llmOpen, setLlmOpen] = useState(false);
  const [llmDocOpen, setLlmDocOpen] = useState(false);
  const [cursorInfo, setCursorInfo] = useState<{ line: number; col: number; selection: string }>({
    line: 1,
    col: 1,
    selection: '',
  });
  const insertSnippetRef = useRef<((snippet: string, cursorOffset?: number) => void) | null>(null);

  // Current active file
  const activeFile = workspace.files[workspace.activeFileId] || Object.values(workspace.files)[0];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  // Save to LocalStorage on workspace changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
    } catch {
      // quota exceeded fallback
    }
  }, [workspace]);

  // Parse BibTeX references & labels across all workspace files
  const bibEntries = useMemo(() => extractBibEntries(workspace.files), [workspace.files]);
  const labels = useMemo(() => extractLabels(workspace.files), [workspace.files]);

  // Find root file to compile: prefer `main.tex`, or active file if active is a .tex file
  const compileTargetSource = useMemo(() => {
    const mainFile = Object.values(workspace.files).find(f => f.name === 'main.tex');
    if (mainFile && mainFile.content) {
      return { source: mainFile.content, fileName: mainFile.name };
    }
    if (activeFile && activeFile.type === 'tex' && activeFile.content) {
      return { source: activeFile.content, fileName: activeFile.name };
    }
    return { source: activeFile?.content || '', fileName: activeFile?.name || 'main.tex' };
  }, [workspace.files, activeFile]);

  // Compiled result state
  const [compileResult, setCompileResult] = useState<CompileResult>(() =>
    compileLatex(compileTargetSource.source, {
      files: workspace.files,
      engine: selectedEngine === 'auto' ? undefined : selectedEngine,
    })
  );

  // Trigger compilation with debounce
  const debounceTimerRef = useRef<number | null>(null);

  const runCompile = (source: string, immediate = false, engineOverride?: LatexEngine) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const eng = engineOverride || selectedEngine;
    const parserOpt = {
      files: workspace.files,
      engine: eng === 'auto' ? undefined : eng,
    };

    if (immediate) {
      setIsCompiling(true);
      const res = compileLatex(source, parserOpt);
      setCompileResult(res);
      setIsCompiling(false);
      return;
    }

    setIsCompiling(true);
    debounceTimerRef.current = window.setTimeout(() => {
      const res = compileLatex(source, parserOpt);
      setCompileResult(res);
      setIsCompiling(false);
    }, 180);
  };

  // Recompile when target source changes if autoCompile is true
  useEffect(() => {
    if (autoCompile) {
      runCompile(compileTargetSource.source);
    }
  }, [compileTargetSource.source, autoCompile]);

  // Physical disk auto-save sync for E:\latex_workspace
  const diskSaveTimeoutRef = useRef<number | null>(null);

  const syncFileContentToDisk = (filePath: string, content: string) => {
    if (!workspace.diskPath) return;
    if (diskSaveTimeoutRef.current) {
      clearTimeout(diskSaveTimeoutRef.current);
    }
    diskSaveTimeoutRef.current = window.setTimeout(async () => {
      try {
        await fetch('/api/workspace/save-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            diskPath: workspace.diskPath,
            filePath,
            content,
          }),
        });
      } catch (err) {
        console.warn('Physical disk auto-save failed:', err);
      }
    }, 400);
  };

  const syncFileCreateToDisk = async (relPath: string, type: string, content?: string) => {
    if (!workspace.diskPath) return;
    try {
      await fetch('/api/workspace/create-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diskPath: workspace.diskPath,
          relPath,
          type,
          content: content || '',
        }),
      });
    } catch (err) {
      console.warn('Physical disk create-file failed:', err);
    }
  };

  const syncFileDeleteToDisk = async (relPath: string) => {
    if (!workspace.diskPath) return;
    try {
      await fetch('/api/workspace/delete-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diskPath: workspace.diskPath,
          relPath,
        }),
      });
    } catch (err) {
      console.warn('Physical disk delete-file failed:', err);
    }
  };

  // Handle active file content update from CodeEditor
  const handleUpdateContent = (newContent: string) => {
    if (!activeFile) return;

    setWorkspace(prev => ({
      ...prev,
      files: {
        ...prev.files,
        [activeFile.id]: {
          ...activeFile,
          content: newContent,
        },
      },
    }));

    if (workspace.diskPath) {
      syncFileContentToDisk(activeFile.path, newContent);
    }
  };

  // Insert snippet from Table Wizard or Math Palette modal into active document
  const handleInsertCodeSnippet = (snippet: string) => {
    if (!activeFile) return;
    const cur = activeFile.content || '';
    const updated = cur.endsWith('\n') ? cur + snippet + '\n' : cur + '\n\n' + snippet + '\n';
    handleUpdateContent(updated);
    showToast('已将代码片段插入当前文件末尾');
  };

  // Zotero citation insertion handler (inserts ~\cite{key} at cursor)
  const handleInsertZoteroCitation = (citekey: string) => {
    const citationCode = `~\\cite{${citekey}}`;
    if (insertSnippetRef.current) {
      insertSnippetRef.current(citationCode);
    } else {
      handleInsertCodeSnippet(citationCode);
    }
    showToast(`已插入引用: ~\\cite{${citekey}}`);
  };

  // Zotero BibTeX synchronization handler
  const handleZoteroBibAppended = async (citekey: string, filename: string) => {
    if (workspace.diskPath) {
      try {
        const res = await fetch(`/api/workspace/load-folder?folderPath=${encodeURIComponent(workspace.diskPath)}`);
        if (res.ok) {
          const loaded = await res.json();
          setWorkspace(prev => ({
            ...prev,
            files: loaded.files,
            rootIds: loaded.rootIds,
          }));
        }
      } catch (err) {
        console.warn('Failed to reload workspace after bib append:', err);
      }
    }
    showToast(`文献 [${citekey}] 已追加并同步至 ${filename}`);
  };

  // LLM direct code write / insertion handler
  const handleLLMApplyCode = (code: string, mode: 'replace' | 'insert') => {
    if (mode === 'insert' && insertSnippetRef.current) {
      insertSnippetRef.current(code);
      showToast('已由 AI 助手在光标处插入代码');
    } else {
      handleUpdateContent(code);
      showToast('已由 AI 助手将代码写入当前编辑区');
    }
  };

  // LLM file manipulation handlers
  const handleLLMCreateFile = (filePath: string, content: string) => {
    const cleanPath = filePath.replace(/^\//, '');
    let folderId: string | null = null;

    if (cleanPath.includes('/')) {
      const parts = cleanPath.split('/');
      const folderName = parts[0];
      const fileName = parts.slice(1).join('/');

      // Check if folder exists
      const existingFolder = Object.values(workspace.files).find(
        (f) => f.type === 'folder' && (f.name === folderName || f.path === `/${folderName}`)
      );

      if (existingFolder) {
        folderId = existingFolder.id;
      } else {
        const newFolderId = `folder_${Date.now()}`;
        const newFolder: FileItem = {
          id: newFolderId,
          name: folderName,
          path: `/${folderName}`,
          type: 'folder',
          children: [],
          parentId: null,
          isOpen: true,
        };
        folderId = newFolderId;
        setWorkspace((prev) => ({
          ...prev,
          files: { ...prev.files, [newFolderId]: newFolder },
          rootIds: [...prev.rootIds, newFolderId],
        }));
      }

      const ext = fileName.split('.').pop()?.toLowerCase();
      const fileType: FileType =
        ext === 'bib' ? 'bib' : ext === 'sty' ? 'sty' : ext === 'cls' ? 'cls' : 'tex';

      const newFileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const newFile: FileItem = {
        id: newFileId,
        name: fileName,
        path: `/${folderName}/${fileName}`,
        type: fileType,
        content: content,
        parentId: folderId,
      };

      setWorkspace((prev) => {
        const updatedFiles = { ...prev.files, [newFileId]: newFile };
        if (folderId && updatedFiles[folderId]) {
          updatedFiles[folderId] = {
            ...updatedFiles[folderId],
            children: [...(updatedFiles[folderId].children || []), newFileId],
            isOpen: true,
          };
        }
        return {
          ...prev,
          files: updatedFiles,
          activeFileId: newFileId,
        };
      });
      showToast(`已由 AI 助手创建文件: ${cleanPath}`);
      if (workspace.diskPath) {
        syncFileCreateToDisk(newFile.path, fileType, content);
      }
      return;
    }

    // Root level file
    const ext = cleanPath.split('.').pop()?.toLowerCase();
    const fileType: FileType =
      ext === 'bib' ? 'bib' : ext === 'sty' ? 'sty' : ext === 'cls' ? 'cls' : 'tex';

    const newFileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newFile: FileItem = {
      id: newFileId,
      name: cleanPath,
      path: `/${cleanPath}`,
      type: fileType,
      content: content,
      parentId: null,
    };

    setWorkspace((prev) => ({
      ...prev,
      files: { ...prev.files, [newFileId]: newFile },
      rootIds: [...prev.rootIds, newFileId],
      activeFileId: newFileId,
    }));
    showToast(`已由 AI 助手创建文件: ${cleanPath}`);
    if (workspace.diskPath) {
      syncFileCreateToDisk(newFile.path, fileType, content);
    }
  };

  const handleLLMUpdateFile = (filePath: string, content: string) => {
    const cleanPath = filePath.replace(/^\//, '');
    const matched = Object.values(workspace.files).find(
      (f) =>
        f.name.toLowerCase() === cleanPath.toLowerCase() ||
        f.path.toLowerCase() === `/${cleanPath}`.toLowerCase() ||
        f.path.toLowerCase() === cleanPath.toLowerCase()
    );

    if (matched) {
      setWorkspace((prev) => ({
        ...prev,
        files: {
          ...prev.files,
          [matched.id]: {
            ...matched,
            content,
          },
        },
      }));
      showToast(`已由 AI 助手更新文件: ${cleanPath}`);
      if (workspace.diskPath) {
        syncFileContentToDisk(matched.path, content);
      }
    } else {
      handleLLMCreateFile(filePath, content);
    }
  };

  const handleLLMDeleteFile = (filePath: string) => {
    const cleanPath = filePath.replace(/^\//, '');
    const matched = Object.values(workspace.files).find(
      (f) =>
        f.name.toLowerCase() === cleanPath.toLowerCase() ||
        f.path.toLowerCase() === `/${cleanPath}`.toLowerCase() ||
        f.path.toLowerCase() === cleanPath.toLowerCase()
    );

    if (matched) {
      handleDeleteFile(matched.id);
      showToast(`已由 AI 助手删除文件: ${cleanPath}`);
    }
  };

  const handleLLMSwitchFile = (filePath: string) => {
    const cleanPath = filePath.replace(/^\//, '');
    const matched = Object.values(workspace.files).find(
      (f) =>
        f.name.toLowerCase() === cleanPath.toLowerCase() ||
        f.path.toLowerCase() === `/${cleanPath}`.toLowerCase() ||
        f.path.toLowerCase() === cleanPath.toLowerCase()
    );

    if (matched) {
      handleSelectFile(matched.id);
      showToast(`已切换至文件: ${matched.name}`);
    }
  };

  // File explorer actions
  const handleSelectFile = (fileId: string) => {
    setWorkspace(prev => ({
      ...prev,
      activeFileId: fileId,
    }));
  };

  const handleCreateFile = (name: string, type: FileType, parentId?: string | null) => {
    const newId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newFile: FileItem = {
      id: newId,
      name,
      path: parentId ? `${workspace.files[parentId]?.path || ''}/${name}` : `/${name}`,
      type,
      content:
        type === 'folder'
          ? undefined
          : type === 'bib'
          ? '@article{sample2026,\n  author = {Zhang, Wei and Li, Ming},\n  title = {Modern Academic Publishing with LaTeX},\n  journal = {Journal of Computational Science},\n  year = {2026},\n  volume = {12},\n  pages = {100-115}\n}\n'
          : `% ${name}\n`,
      children: type === 'folder' ? [] : undefined,
      parentId: parentId || null,
      isOpen: true,
    };

    setWorkspace(prev => {
      const updatedFiles = { ...prev.files, [newId]: newFile };
      const updatedRootIds = [...prev.rootIds];

      if (parentId && updatedFiles[parentId]) {
        updatedFiles[parentId] = {
          ...updatedFiles[parentId],
          children: [...(updatedFiles[parentId].children || []), newId],
          isOpen: true,
        };
      } else {
        updatedRootIds.push(newId);
      }

      return {
        ...prev,
        files: updatedFiles,
        rootIds: updatedRootIds,
        activeFileId: type !== 'folder' ? newId : prev.activeFileId,
      };
    });

    if (workspace.diskPath) {
      syncFileCreateToDisk(newFile.path, type, newFile.content);
    }
  };

  const handleDeleteFile = (fileId: string) => {
    setWorkspace(prev => {
      const target = prev.files[fileId];
      if (!target) return prev;

      if (workspace.diskPath) {
        syncFileDeleteToDisk(target.path);
      }

      const updatedFiles = { ...prev.files };
      delete updatedFiles[fileId];

      let updatedRootIds = prev.rootIds.filter(id => id !== fileId);
      if (target.parentId && updatedFiles[target.parentId]) {
        updatedFiles[target.parentId] = {
          ...updatedFiles[target.parentId],
          children: (updatedFiles[target.parentId].children || []).filter(id => id !== fileId),
        };
      }

      const remainingIds = Object.keys(updatedFiles).filter(id => updatedFiles[id].type !== 'folder');
      const nextActive = remainingIds.length > 0 ? remainingIds[0] : '';

      return {
        ...prev,
        files: updatedFiles,
        rootIds: updatedRootIds,
        activeFileId: prev.activeFileId === fileId ? nextActive : prev.activeFileId,
      };
    });
  };

  const handleRenameFile = (fileId: string, newName: string) => {
    setWorkspace(prev => {
      const target = prev.files[fileId];
      if (!target) return prev;
      return {
        ...prev,
        files: {
          ...prev.files,
          [fileId]: {
            ...target,
            name: newName,
          },
        },
      };
    });
  };

  const handleLoadTemplate = (templateId: string) => {
    const nextWs = createWorkspaceFromTemplate(templateId);
    setWorkspace(nextWs);
    const mainFile = Object.values(nextWs.files).find(f => f.name === 'main.tex') || Object.values(nextWs.files)[0];
    runCompile(mainFile?.content || '', true);
    showToast('已加载工程模板');
  };

  // Successfully imported ZIP or loaded existing project from E: drive
  const handleImportWorkspaceSuccess = (importedWorkspace: WorkspaceState, diskPath: string) => {
    const nextWs: WorkspaceState = {
      ...importedWorkspace,
      diskPath,
    };
    setWorkspace(nextWs);

    const mainFile =
      Object.values(nextWs.files).find((f) => f.name.toLowerCase() === 'main.tex') ||
      Object.values(nextWs.files).find((f) => f.name.toLowerCase().endsWith('.tex')) ||
      Object.values(nextWs.files)[0];

    if (mainFile && mainFile.content) {
      runCompile(mainFile.content, true);
    }
    showToast(`已成功载入 E 盘工作区: ${diskPath}`);
  };

  // Download single active .tex file
  const handleDownloadActiveTex = () => {
    if (!activeFile || !activeFile.content) return;
    const blob = new Blob([activeFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.name.endsWith('.tex') ? activeFile.name : `${activeFile.name}.tex`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export full workspace to ZIP
  const handleExportZip = async () => {
    try {
      showToast('正在打包工程所有文件...');
      await exportWorkspaceAsZip(workspace, 'LatexProject');
      showToast('工程 ZIP 打包完成并开始下载');
    } catch (err) {
      console.error('Failed to export ZIP', err);
      showToast('导出 ZIP 失败，请重试');
    }
  };

  // Restore snapshot handler
  const handleRestoreWorkspace = (restored: WorkspaceState) => {
    setWorkspace(restored);
    const mainFile = Object.values(restored.files).find(f => f.name === 'main.tex') || Object.values(restored.files)[0];
    runCompile(mainFile?.content || '', true);
    showToast('已成功还原至历史版本快照');
  };

  // Jump from diagnostic to line
  const handleJumpToLine = (line: number) => {
    setJumpToLineTarget(line);
    setTimeout(() => setJumpToLineTarget(null), 300);
  };

  // Reverse SyncTeX: Locate source code from preview click
  const handleSyncToSource = (loc: { line: number; fileId?: string; fileName?: string }) => {
    let targetFileId = loc.fileId;
    if (!targetFileId && loc.fileName) {
      const matched = Object.values(workspace.files).find(
        f => f.name === loc.fileName || f.name === `${loc.fileName}.tex` || f.path.endsWith(loc.fileName!)
      );
      if (matched) targetFileId = matched.id;
    }

    if (targetFileId && targetFileId !== workspace.activeFileId && workspace.files[targetFileId]) {
      setWorkspace(prev => ({
        ...prev,
        activeFileId: targetFileId!,
      }));
      // Allow editor to mount new file before scrolling
      setTimeout(() => {
        setJumpToLineTarget(loc.line);
        setTimeout(() => setJumpToLineTarget(null), 400);
      }, 60);
    } else {
      setJumpToLineTarget(loc.line);
      setTimeout(() => setJumpToLineTarget(null), 400);
    }
  };

  // Forward SyncTeX: editor double click / button -> scroll and pulse preview
  const handleForwardSync = (line: number) => {
    setForwardSyncTarget({ line, timestamp: Date.now() });
    if (!rightOpen) {
      setRightOpen(true);
    }
  };

  const errorLines = compileResult.diagnostics.map(d => d.line);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-100 font-sans text-slate-800">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 text-white text-xs px-4 py-2.5 rounded-lg shadow-2xl flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Application Header */}
      <Header
        projectName="LaTeX Project"
        activeFileName={activeFile?.name || '无活动文件'}
        diskPath={workspace.diskPath}
        isCompiling={isCompiling}
        hasErrors={compileResult.diagnostics.some(d => d.type === 'error')}
        leftOpen={leftOpen}
        rightOpen={rightOpen}
        onToggleLeft={() => setLeftOpen(!leftOpen)}
        onToggleRight={() => setRightOpen(!rightOpen)}
        onDownloadCurrentTex={handleDownloadActiveTex}
        onOpenWordCount={() => setShowWordCount(true)}
        onOpenSnapshots={() => setShowSnapshots(true)}
        onExportZip={handleExportZip}
        onOpenExportMd={() => setShowExportMdModal(true)}
        onOpenImportZip={() => setShowImportZipModal(true)}
        onOpenTableWizard={() => setShowTableWizard(true)}
        onOpenMathPalette={() => setShowMathPalette(true)}
        llmOpen={llmOpen}
        onToggleLLM={() => setLlmOpen(prev => !prev)}
        onOpenLLMDoc={() => setLlmDocOpen(true)}
        onOpenZotero={() => setShowZoteroModal(true)}
      />

      {/* Main Multi-Panel Workspace: Left (Files) | Center (Editor) | Right (Preview) | LLM Assistant */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Workspace Folder & File Explorer (左边是工作文件夹) */}
        {leftOpen && (
          <aside className="w-64 md:w-72 shrink-0 h-full">
            <FileTree
              workspace={workspace}
              onSelectFile={handleSelectFile}
              onUpdateFile={handleUpdateContent}
              onCreateFile={handleCreateFile}
              onDeleteFile={handleDeleteFile}
              onRenameFile={handleRenameFile}
              onLoadTemplate={handleLoadTemplate}
              onOpenImportZip={() => setShowImportZipModal(true)}
            />
          </aside>
        )}

        {/* Middle Side: LaTeX Code Editor with Syntax Highlighting (中间是latex代码) */}
        <main className="flex-1 flex flex-col h-full min-w-0">
          {activeFile ? (
            <CodeEditor
              code={activeFile.content || ''}
              fileName={activeFile.name}
              onChange={handleUpdateContent}
              onSave={() => runCompile(compileTargetSource.source, true)}
              errorLines={errorLines}
              onJumpToLineTarget={jumpToLineTarget}
              bibEntries={bibEntries}
              labels={labels}
              onForwardSync={handleForwardSync}
              onOpenTableWizard={() => setShowTableWizard(true)}
              onOpenMathPalette={() => setShowMathPalette(true)}
              onCursorInfoChange={setCursorInfo}
              insertSnippetRef={insertSnippetRef}
              onToggleLLM={() => setLlmOpen(prev => !prev)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-white text-slate-400 text-sm">
              在左侧工作区选择或新建一个文件开始编辑
            </div>
          )}
        </main>

        {/* Right Side: Real-time Live Compilation & Preview Window (右边是实时编译窗口) */}
        {rightOpen && (
          <section className="flex-1 shrink-0 h-full min-w-[340px] max-w-[55vw]">
            <PreviewPane
              compileResult={compileResult}
              isCompiling={isCompiling}
              autoCompile={autoCompile}
              onToggleAutoCompile={() => setAutoCompile(!autoCompile)}
              onRecompile={() => runCompile(compileTargetSource.source, true)}
              onJumpToLine={handleJumpToLine}
              onSyncToSource={handleSyncToSource}
              forwardSyncTarget={forwardSyncTarget}
              selectedEngine={selectedEngine}
              onExportMd={() => setShowExportMdModal(true)}
              onChangeEngine={(newEng) => {
                setSelectedEngine(newEng);
                runCompile(compileTargetSource.source, true, newEng);
                showToast(`已切换排版引擎为: ${newEng === 'xelatex' ? 'XeLaTeX (UTF-8/中文)' : 'pdfLaTeX (经典兼容)'}`);
              }}
            />
          </section>
        )}

        {/* LLM Assistant Interactive Panel (大模型代码直写与文件交互面板) */}
        {llmOpen && (
          <LLMAssistantPanel
            isOpen={llmOpen}
            onClose={() => setLlmOpen(false)}
            activeFile={activeFile}
            activeFileContent={activeFile?.content || ''}
            workspace={workspace}
            cursorLine={cursorInfo.line}
            selection={cursorInfo.selection}
            onApplyCode={handleLLMApplyCode}
            onCreateFile={handleLLMCreateFile}
            onUpdateFile={handleLLMUpdateFile}
            onDeleteFile={handleLLMDeleteFile}
            onSwitchFile={handleLLMSwitchFile}
            onOpenDocModal={() => setLlmDocOpen(true)}
          />
        )}
      </div>

      {/* Modals */}
      <TableWizardModal
        isOpen={showTableWizard}
        onClose={() => setShowTableWizard(false)}
        onInsert={handleInsertCodeSnippet}
      />

      <MathPaletteModal
        isOpen={showMathPalette}
        onClose={() => setShowMathPalette(false)}
        onInsertSnippet={handleInsertCodeSnippet}
      />

      <WordCountModal
        isOpen={showWordCount}
        onClose={() => setShowWordCount(false)}
        workspace={workspace}
      />

      <SnapshotManagerModal
        isOpen={showSnapshots}
        onClose={() => setShowSnapshots(false)}
        workspace={workspace}
        onRestoreWorkspace={handleRestoreWorkspace}
      />

      {/* LLM API Documentation Modal */}
      <LLMDocModal
        isOpen={llmDocOpen}
        onClose={() => setLlmDocOpen(false)}
      />

      {/* Import ZIP to E: Drive Workspace Modal */}
      <ImportZipModal
        isOpen={showImportZipModal}
        onClose={() => setShowImportZipModal(false)}
        currentDiskPath={workspace.diskPath}
        onImportSuccess={handleImportWorkspaceSuccess}
      />

      {/* Export Markdown Modal */}
      <ExportMdModal
        isOpen={showExportMdModal}
        onClose={() => setShowExportMdModal(false)}
        workspace={workspace}
        activeFileContent={activeFile?.content || ''}
        activeFileName={activeFile?.name || 'main.tex'}
      />

      {/* Zotero MCP Literature Integration Modal */}
      <ZoteroModal
        isOpen={showZoteroModal}
        onClose={() => setShowZoteroModal(false)}
        onInsertCitation={handleInsertZoteroCitation}
        onBibAppended={handleZoteroBibAppended}
        workspacePath={workspace.diskPath}
      />
    </div>
  );
}
