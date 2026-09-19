import React, { useState, useEffect } from 'react';
import { History, Plus, Trash2, RotateCcw, Clock, FileCode, Check, X, AlertTriangle } from 'lucide-react';
import { WorkspaceState } from '../types/latex';
import { SnapshotItem } from '../types/snapshot';

interface SnapshotManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: WorkspaceState;
  onRestoreWorkspace: (restored: WorkspaceState) => void;
}

const STORAGE_KEY = 'latex_editor_snapshots_v1';

export const SnapshotManagerModal: React.FC<SnapshotManagerModalProps> = ({
  isOpen,
  onClose,
  workspace,
  onRestoreWorkspace,
}) => {
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [newSnapshotName, setNewSnapshotName] = useState('');
  const [newSnapshotDesc, setNewSnapshotDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [restoreConfirmId, setRestoreConfirmId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Load snapshots from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setSnapshots(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to load snapshots:', e);
    }
  }, [isOpen]);

  const saveSnapshotsToStorage = (items: SnapshotItem[]) => {
    setSnapshots(items);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save snapshots:', e);
    }
  };

  const handleCreateSnapshot = () => {
    const name = newSnapshotName.trim() || `草稿快照 #${snapshots.length + 1}`;
    const newSnapshot: SnapshotItem = {
      id: `snapshot_${Date.now()}`,
      name,
      description: newSnapshotDesc.trim() || undefined,
      timestamp: Date.now(),
      fileCount: Object.keys(workspace.files).length,
      files: JSON.parse(JSON.stringify(workspace.files)),
      activeFileId: workspace.activeFileId,
      rootIds: [...workspace.rootIds],
    };

    const updated = [newSnapshot, ...snapshots];
    saveSnapshotsToStorage(updated);
    setNewSnapshotName('');
    setNewSnapshotDesc('');
    setIsCreating(false);
    setActionNotice(`已成功创建快照版本「${name}」`);
    setTimeout(() => setActionNotice(null), 3000);
  };

  const handleDeleteSnapshot = (id: string) => {
    const updated = snapshots.filter(s => s.id !== id);
    saveSnapshotsToStorage(updated);
    if (restoreConfirmId === id) setRestoreConfirmId(null);
  };

  const handleRestore = (snapshot: SnapshotItem) => {
    onRestoreWorkspace({
      files: JSON.parse(JSON.stringify(snapshot.files)),
      activeFileId: snapshot.activeFileId,
      rootIds: [...snapshot.rootIds],
    });
    setRestoreConfirmId(null);
    setActionNotice(`已恢复至快照版本「${snapshot.name}」！`);
    setTimeout(() => {
      setActionNotice(null);
      onClose();
    }, 1200);
  };

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 text-slate-800">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-xl w-full max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-600 rounded-md">
              <History className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">本地版本快照管理 (Version Snapshots)</h3>
              <p className="text-[11px] text-slate-400">随时保存工程关键版本，随时比对与安全一键回退恢复</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Notice Bar */}
        {actionNotice && (
          <div className="px-5 py-2 bg-emerald-50 text-emerald-800 text-xs font-medium flex items-center gap-2 border-b border-emerald-100">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* Action Top Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-600">
            当前工程含 <strong className="text-slate-900">{Object.keys(workspace.files).length}</strong> 个文件/文件夹
          </span>
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>为当前工程打快照</span>
          </button>
        </div>

        {/* Create Snapshot Form */}
        {isCreating && (
          <div className="p-4 bg-indigo-50/50 border-b border-indigo-100 space-y-2.5 text-xs">
            <div className="font-semibold text-indigo-900">新建快照节点</div>
            <div>
              <input
                type="text"
                placeholder="快照名称（如：修改审稿意见、添加实验图表、投稿终稿）"
                value={newSnapshotName}
                onChange={e => setNewSnapshotName(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-xs text-slate-800 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <input
                type="text"
                placeholder="备注说明（可选）"
                value={newSnapshotDesc}
                onChange={e => setNewSnapshotDesc(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-xs text-slate-800 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-2.5 py-1 text-slate-600 hover:bg-slate-200 rounded text-xs"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleCreateSnapshot}
                className="px-3.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded text-xs shadow-2xs"
              >
                确认保存
              </button>
            </div>
          </div>
        )}

        {/* Snapshot List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {snapshots.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              暂无保存的快照版本。点击上方按钮可为当前工作区创建第一个版本快照。
            </div>
          ) : (
            snapshots.map(snapshot => (
              <div
                key={snapshot.id}
                className="p-3 bg-white border border-slate-200 hover:border-slate-300 rounded-lg shadow-2xs transition-all space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-xs text-slate-900 flex items-center gap-1.5">
                      <span>{snapshot.name}</span>
                    </div>
                    {snapshot.description && (
                      <p className="text-[11px] text-slate-500 mt-0.5">{snapshot.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 shrink-0 font-mono">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{formatTimestamp(snapshot.timestamp)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <div className="text-[11px] text-slate-500 flex items-center gap-1">
                    <FileCode className="w-3 h-3 text-indigo-500" />
                    <span>包含 {snapshot.fileCount} 个文件</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {restoreConfirmId === snapshot.id ? (
                      <div className="flex items-center gap-1.5 animate-fade-in">
                        <span className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> 确认覆盖当前工作区？
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRestore(snapshot)}
                          className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-semibold"
                        >
                          确认恢复
                        </button>
                        <button
                          type="button"
                          onClick={() => setRestoreConfirmId(null)}
                          className="px-1.5 py-0.5 text-slate-500 hover:text-slate-700 text-[11px]"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setRestoreConfirmId(snapshot.id)}
                          className="px-2.5 py-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded text-xs font-semibold flex items-center gap-1 transition-colors"
                          title="还原恢复至此版本"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>一键还原</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSnapshot(snapshot.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                          title="删除快照"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-400">
          <span>快照安全保存在浏览器本地，不上传外部服务器</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded font-medium transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
