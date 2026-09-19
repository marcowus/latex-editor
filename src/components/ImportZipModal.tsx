import React, { useState, useEffect, useRef } from 'react';
import {
  FolderArchive,
  HardDrive,
  Upload,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileCode,
  X,
  Loader2,
  RefreshCw,
  FolderSync
} from 'lucide-react';
import { WorkspaceState } from '../types/latex';

interface ExistingProject {
  name: string;
  path: string;
  hasMainTex: boolean;
  modified: number;
}

interface ImportZipModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDiskPath?: string;
  onImportSuccess: (workspace: WorkspaceState, diskPath: string) => void;
}

export const ImportZipModal: React.FC<ImportZipModalProps> = ({
  isOpen,
  onClose,
  currentDiskPath,
  onImportSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'localPath' | 'history'>('upload');
  
  // Upload tab state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProjectName, setUploadProjectName] = useState('');
  
  // Local path tab state
  const [localZipPath, setLocalZipPath] = useState('');
  const [localProjectName, setLocalProjectName] = useState('');
  
  // Existing projects
  const [existingProjects, setExistingProjects] = useState<ExistingProject[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  
  // Progress & loading
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch project list when opening or switching to history tab
  const fetchProjects = async () => {
    setIsLoadingProjects(true);
    try {
      const res = await fetch('/api/workspace/list-projects');
      if (res.ok) {
        const data = await res.json();
        setExistingProjects(data.projects || []);
      }
    } catch (err) {
      console.error('Failed to list E: workspace projects', err);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchProjects();
      setErrorMessage(null);
      setStatusMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const cleanName = file.name.replace(/\.[^/.]+$/, '');
      setUploadProjectName(cleanName);
      setErrorMessage(null);
    }
  };

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // Import via file upload (Base64)
  const handleImportUploadedFile = async () => {
    if (!selectedFile) {
      setErrorMessage('请先选择或拖入一个 .zip 压缩包');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setStatusMessage('正在读取并上传 ZIP 文件...');

    try {
      const base64Data = await fileToBase64(selectedFile);
      setStatusMessage('正在解压至 E:\\latex_workspace 并解析文件结构...');

      const response = await fetch('/api/workspace/import-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zipBase64: base64Data,
          projectName: uploadProjectName.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok || data.status === 'error') {
        throw new Error(data.error || '解压失败');
      }

      setStatusMessage(`解压成功！共提取 ${data.extractedCount} 个文件`);
      onImportSuccess(data.workspace, data.diskPath);
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err: any) {
      setErrorMessage(err.message || '上传与解压出现异常');
    } finally {
      setIsProcessing(false);
    }
  };

  // Import via local path
  const handleImportLocalPath = async () => {
    if (!localZipPath.trim()) {
      setErrorMessage('请输入本地 ZIP 文件的完整路径');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setStatusMessage('正在读取指定路径并解压至 E:\\latex_workspace...');

    try {
      const response = await fetch('/api/workspace/import-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zipFilePath: localZipPath.trim(),
          projectName: localProjectName.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok || data.status === 'error') {
        throw new Error(data.error || '解压失败');
      }

      setStatusMessage(`解压成功！共提取 ${data.extractedCount} 个文件`);
      onImportSuccess(data.workspace, data.diskPath);
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err: any) {
      setErrorMessage(err.message || '路径导入与解压出现异常');
    } finally {
      setIsProcessing(false);
    }
  };

  // Load existing project
  const handleLoadExisting = async (project: ExistingProject) => {
    setIsProcessing(true);
    setErrorMessage(null);
    setStatusMessage(`正在载入工程: ${project.name}...`);

    try {
      const response = await fetch('/api/workspace/load-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: project.path }),
      });

      const data = await response.json();
      if (!response.ok || data.status === 'error') {
        throw new Error(data.error || '载入工程失败');
      }

      onImportSuccess(data.workspace, data.diskPath);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || '加载工程出现异常');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 text-slate-800 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 space-y-5 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                导入 ZIP 压缩包至 E 盘工作区
              </h3>
              <p className="text-xs text-slate-500">
                将论文工程 ZIP 解压到物理磁盘 <code className="text-indigo-600 font-mono bg-indigo-50 px-1 py-0.5 rounded">E:\latex_workspace\</code> 并实时双向同步
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Active Workspace Alert */}
        {currentDiskPath && (
          <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200/80 rounded-lg text-xs text-emerald-800">
            <FolderSync className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="truncate">
              当前活动工作区: <strong className="font-mono">{currentDiskPath}</strong>
            </span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`pb-2.5 px-4 flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'upload'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            上传 ZIP 文件
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('localPath')}
            className={`pb-2.5 px-4 flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'localPath'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            输入本地 ZIP 路径
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('history');
              fetchProjects();
            }}
            className={`pb-2.5 px-4 flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            E 盘已有工程 ({existingProjects.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-[220px]">
          {/* TAB 1: File Upload */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file && file.name.endsWith('.zip')) {
                    setSelectedFile(file);
                    setUploadProjectName(file.name.replace(/\.zip$/i, ''));
                    setErrorMessage(null);
                  } else {
                    setErrorMessage('请拖放有效的 .zip 格式压缩文件');
                  }
                }}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                  selectedFile
                    ? 'border-indigo-500 bg-indigo-50/40'
                    : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                  <FolderArchive className="w-6 h-6" />
                </div>
                {selectedFile ? (
                  <div>
                    <p className="text-sm font-bold text-slate-800">{selectedFile.name}</p>
                    <p className="text-xs text-slate-500">
                      文件大小: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB (点击可更换)
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-semibold text-slate-700">点击选择 ZIP 文件，或将文件拖入此区域</p>
                    <p className="text-xs text-slate-400 mt-0.5">支持含 main.tex、sections、图片等完整 LaTeX 压缩包</p>
                  </div>
                )}
              </div>

              {/* Project Name and Target Directory Setting */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    解压工程文件夹名称:
                  </label>
                  <input
                    type="text"
                    value={uploadProjectName}
                    onChange={(e) => setUploadProjectName(e.target.value)}
                    placeholder="如: my_paper_v1"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-hidden focus:border-indigo-500 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    解压目标绝对路径:
                  </label>
                  <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 font-mono text-xs truncate">
                    E:\latex_workspace\{uploadProjectName.trim() || 'my_project'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Local Path */}
          {activeTab === 'localPath' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-700 font-semibold mb-1">
                  本地 .zip 压缩包绝对路径:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={localZipPath}
                    onChange={(e) => {
                      setLocalZipPath(e.target.value);
                      if (!localProjectName) {
                        const base = e.target.value.split(/[\\/]/).pop()?.replace(/\.zip$/i, '') || '';
                        setLocalProjectName(base);
                      }
                    }}
                    placeholder="例如: d:\论文程序归档_20260808\latex-editor.zip"
                    className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-hidden focus:border-indigo-500 text-xs font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  可直接复制本地文件管理器中的完整路径粘贴到此处，后端将直接在本地高效读取与解包。
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    解压工程文件夹名称:
                  </label>
                  <input
                    type="text"
                    value={localProjectName}
                    onChange={(e) => setLocalProjectName(e.target.value)}
                    placeholder="如: latex_paper"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-hidden focus:border-indigo-500 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    解压目标绝对路径:
                  </label>
                  <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 font-mono text-xs truncate">
                    E:\latex_workspace\{localProjectName.trim() || 'latex_paper'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: History / Existing Projects */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>E:\latex_workspace 目录下的工程列表:</span>
                <button
                  onClick={fetchProjects}
                  className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingProjects ? 'animate-spin' : ''}`} />
                  <span>刷新</span>
                </button>
              </div>

              {isLoadingProjects ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                  <span className="text-xs">正在扫描 E 盘工程目录...</span>
                </div>
              ) : existingProjects.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs border border-dashed rounded-lg">
                  E:\latex_workspace 暂无已有工程。请通过前两个标签页导入 ZIP 文件。
                </div>
              ) : (
                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                  {existingProjects.map((proj) => {
                    const isCurrent = currentDiskPath && currentDiskPath.toLowerCase() === proj.path.toLowerCase();
                    return (
                      <div
                        key={proj.name}
                        className={`p-3 rounded-lg border flex items-center justify-between gap-3 transition-all ${
                          isCurrent
                            ? 'border-emerald-300 bg-emerald-50/50'
                            : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/20'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-800 truncate">{proj.name}</span>
                            {proj.hasMainTex && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-200/60">
                                含 main.tex
                              </span>
                            )}
                            {isCurrent && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700">
                                当前工作区
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                            <span className="font-mono truncate">{proj.path}</span>
                            <span className="flex items-center gap-1 shrink-0">
                              <Clock className="w-3 h-3" />
                              {new Date(proj.modified).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleLoadExisting(proj)}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold shrink-0 transition-colors ${
                            isCurrent
                              ? 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                              : 'bg-indigo-600 text-white hover:bg-indigo-700'
                          }`}
                        >
                          {isCurrent ? '重新加载' : '打开工程'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Status & Error feedback */}
        {statusMessage && (
          <div className="flex items-center gap-2 text-xs text-indigo-700 bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-100 animate-in fade-in">
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200 animate-in fade-in">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Modal Action Buttons */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>导入后将自动切换工作区并开启实时编译与磁盘回写</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
            >
              取消
            </button>

            {activeTab === 'upload' && (
              <button
                type="button"
                onClick={handleImportUploadedFile}
                disabled={isProcessing || !selectedFile}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-md shadow-xs flex items-center gap-1.5 transition-colors"
              >
                {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>解压至 E 盘并载入</span>
              </button>
            )}

            {activeTab === 'localPath' && (
              <button
                type="button"
                onClick={handleImportLocalPath}
                disabled={isProcessing || !localZipPath.trim()}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-md shadow-xs flex items-center gap-1.5 transition-colors"
              >
                {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>读取解压并载入</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
