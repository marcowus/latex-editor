import React, { useState, useMemo } from 'react';
import {
  History,
  RotateCcw,
  Clock,
  FileCode,
  Check,
  X,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Search,
  Tag,
  Plus,
  Trash2,
  Sparkles,
  ShieldCheck,
  Filter,
  FileText
} from 'lucide-react';
import { WorkspaceState } from '../types/latex';
import { HistoryRecord, MilestoneSnapshot } from '../types/history';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: WorkspaceState;
  historyRecords: HistoryRecord[];
  snapshots: MilestoneSnapshot[];
  onRestoreWorkspace: (restored: WorkspaceState, notice?: string) => void;
  onCreateSnapshot: (name: string, description?: string) => void;
  onDeleteSnapshot: (id: string) => void;
  onClearHistory?: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  workspace,
  historyRecords,
  snapshots,
  onRestoreWorkspace,
  onCreateSnapshot,
  onDeleteSnapshot,
  onClearHistory,
}) => {
  const [activeTab, setActiveTab] = useState<'history' | 'milestones'>('history');

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');

  // Expanded diff records
  const [expandedRecordIds, setExpandedRecordIds] = useState<Record<string, boolean>>({});

  // Rollback confirmation
  const [confirmRollbackId, setConfirmRollbackId] = useState<string | null>(null);

  // Milestone creation form
  const [isCreatingMilestone, setIsCreatingMilestone] = useState(false);
  const [milestoneName, setMilestoneName] = useState('');
  const [milestoneDesc, setMilestoneDesc] = useState('');

  // Action feedback
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3500);
  };

  // Toggle diff expansion
  const toggleDiff = (id: string) => {
    setExpandedRecordIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Handle Rollback
  const handleExecuteRollback = (record: HistoryRecord) => {
    onRestoreWorkspace(
      {
        files: JSON.parse(JSON.stringify(record.snapshot.files)),
        activeFileId: record.snapshot.activeFileId,
        rootIds: [...record.snapshot.rootIds],
        diskPath: workspace.diskPath,
      },
      `已安全回退至「${record.summary}」`
    );
    setConfirmRollbackId(null);
    showNotice(`成功回退至版本: ${record.summary} (系统已自动保留回退前备份)`);
  };

  // Handle Milestone creation
  const handleSaveMilestone = () => {
    const name = milestoneName.trim() || `里程碑快照 #${snapshots.length + 1}`;
    onCreateSnapshot(name, milestoneDesc.trim() || undefined);
    setMilestoneName('');
    setMilestoneDesc('');
    setIsCreatingMilestone(false);
    showNotice(`已创建命名里程碑「${name}」`);
  };

  // Format timestamp helper
  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
    });
  };

  // Filter history records
  const filteredHistory = useMemo(() => {
    return historyRecords.filter((rec) => {
      const matchesQuery =
        !searchQuery.trim() ||
        rec.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rec.fileDiffs.some((f) => f.fileName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        rec.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesTag = selectedTag === 'all' || rec.tags.includes(selectedTag);

      return matchesQuery && matchesTag;
    });
  }, [historyRecords, searchQuery, selectedTag]);

  // Unique tags for filter pills
  const availableTags = useMemo(() => {
    const set = new Set<string>();
    historyRecords.forEach((r) => r.tags.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [historyRecords]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden text-slate-800">
        {/* Top Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-indigo-600 rounded-lg text-white shadow-xs">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm leading-none text-slate-100">
                  历史修改记录与安全回退中心
                </h3>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-indigo-300 border border-slate-700">
                  Auto-Track & Diff
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                全自动记录历次修改摘要与差异，支持可视化 Diff 比对与一键无损安全回退
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 pt-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`pb-2 text-xs font-medium flex items-center gap-1.5 border-b-2 transition-colors ${
                activeTab === 'history'
                  ? 'border-indigo-600 text-indigo-600 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              自动修改记录 ({historyRecords.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('milestones')}
              className={`pb-2 text-xs font-medium flex items-center gap-1.5 border-b-2 transition-colors ${
                activeTab === 'milestones'
                  ? 'border-indigo-600 text-indigo-600 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              里程碑快照 ({snapshots.length})
            </button>
          </div>

          <div className="flex items-center gap-2 pb-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>回退前自动保留逆向备份，无丢失风险</span>
          </div>
        </div>

        {/* Notice Alert Banner */}
        {actionNotice && (
          <div className="px-4 py-2 bg-emerald-50 text-emerald-800 text-xs font-medium flex items-center justify-between border-b border-emerald-200 shrink-0">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{actionNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionNotice(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Tab 1: Auto History & Diff Summaries */}
        {activeTab === 'history' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Toolbar: Search and Tag Filter */}
            <div className="p-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="按文件名、摘要关键词或标签搜索修改记录..."
                    className="w-full pl-8 pr-6 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Tag Filters */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setSelectedTag('all')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    selectedTag === 'all'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  全部
                </button>
                {availableTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTag(tag)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                      selectedTag === tag
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>

              {onClearHistory && historyRecords.length > 0 && (
                <button
                  type="button"
                  onClick={onClearHistory}
                  title="清空当前历史修改记录缓存"
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition-colors text-xs flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">清空历史</span>
                </button>
              )}
            </div>

            {/* History List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
              {filteredHistory.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs border-2 border-dashed border-slate-200 rounded-xl m-2">
                  <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-medium text-slate-600">暂无匹配的修改记录</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    在编辑区输入、通过 AI 助手写入代码或插入 Zotero 引用时，将自动在此捕获版本记录
                  </p>
                </div>
              ) : (
                filteredHistory.map((record) => {
                  const isExpanded = Boolean(expandedRecordIds[record.id]);
                  const isConfirming = confirmRollbackId === record.id;

                  // Source pill styling
                  const sourceBg =
                    record.source === 'ai'
                      ? 'bg-purple-100 text-purple-800 border-purple-200'
                      : record.source === 'zotero'
                      ? 'bg-rose-100 text-rose-800 border-rose-200'
                      : record.source === 'rollback'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : 'bg-indigo-50 text-indigo-700 border-indigo-200';

                  return (
                    <div
                      key={record.id}
                      className="bg-white border border-slate-200 hover:border-indigo-200 rounded-lg p-3.5 shadow-2xs transition-all space-y-2.5"
                    >
                      {/* Record Card Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${sourceBg}`}
                            >
                              {record.sourceLabel}
                            </span>

                            <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                              <span>{formatDate(record.timestamp)}</span>
                              <span>{formatTime(record.timestamp)}</span>
                            </span>

                            {/* Tags */}
                            {record.tags.map((t) => (
                              <span
                                key={t}
                                className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 text-slate-600 border border-slate-200/80"
                              >
                                {t}
                              </span>
                            ))}
                          </div>

                          {/* Summary headline */}
                          <h4 className="font-semibold text-xs text-slate-900 leading-snug">
                            {record.summary}
                          </h4>
                        </div>

                        {/* Rollback and Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          {isConfirming ? (
                            <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1 animate-in fade-in">
                              <span className="text-[11px] text-rose-700 font-semibold flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                确认回退到此节点？
                              </span>
                              <button
                                type="button"
                                onClick={() => handleExecuteRollback(record)}
                                className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-medium shadow-2xs transition-colors"
                              >
                                确认恢复
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmRollbackId(null)}
                                className="px-1.5 py-0.5 text-slate-500 hover:text-slate-800 text-[11px]"
                              >
                                取消
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmRollbackId(record.id)}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 border border-indigo-200 hover:border-indigo-600 rounded text-xs font-semibold flex items-center gap-1 transition-colors shadow-2xs"
                              title="将工作区回退恢复至该时刻，回退前会自动备份当前状态"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>回退到此版本</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* File Change Stats and Diff Toggle */}
                      <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-[11px] flex items-center gap-1">
                            <FileCode className="w-3 h-3 text-slate-400" />
                            <span>
                              变更 {record.fileDiffs.length} 个文件:
                              <strong className="text-slate-700 ml-1">
                                {record.fileDiffs.map((f) => f.fileName).join(', ')}
                              </strong>
                            </span>
                          </span>

                          <div className="flex items-center gap-1 text-[11px] font-mono">
                            <span className="text-emerald-600 font-semibold">
                              +{record.totalAddedLines}
                            </span>
                            <span className="text-rose-600 font-semibold">
                              -{record.totalRemovedLines}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleDiff(record.id)}
                          className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                        >
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          {isExpanded ? '收起代码 Diff' : '展开查看代码 Diff'}
                        </button>
                      </div>

                      {/* Expanded Visual Line-by-Line Diff Preview */}
                      {isExpanded && (
                        <div className="mt-2.5 space-y-2 pt-2 border-t border-slate-200">
                          {record.fileDiffs.map((fd, fIdx) => (
                            <div
                              key={fIdx}
                              className="rounded-lg border border-slate-200 overflow-hidden bg-slate-950 text-slate-100 text-[11px] font-mono"
                            >
                              <div className="bg-slate-900 px-3 py-1.5 flex items-center justify-between border-b border-slate-800">
                                <span className="font-semibold text-slate-200">{fd.fileName}</span>
                                <div className="text-[10px] space-x-2">
                                  <span className="text-emerald-400">+{fd.addedLines} 行</span>
                                  <span className="text-rose-400">-{fd.removedLines} 行</span>
                                </div>
                              </div>

                              <div className="p-2.5 max-h-56 overflow-y-auto space-y-0.5 select-text">
                                {fd.diffLines && fd.diffLines.length > 0 ? (
                                  fd.diffLines.map((line, lIdx) => (
                                    <div
                                      key={lIdx}
                                      className={`flex items-start px-1.5 py-0.5 rounded leading-relaxed ${
                                        line.type === 'add'
                                          ? 'bg-emerald-950/80 text-emerald-300 font-medium'
                                          : line.type === 'del'
                                          ? 'bg-rose-950/80 text-rose-300 font-medium line-through'
                                          : 'text-slate-400'
                                      }`}
                                    >
                                      <span className="w-6 shrink-0 text-right select-none opacity-50 text-[10px] mr-2">
                                        {line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}
                                      </span>
                                      <span className="whitespace-pre-wrap break-all flex-1">
                                        {line.content || ' '}
                                      </span>
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-slate-500 py-1">无详细文本变更片段</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Named Milestones */}
        {activeTab === 'milestones' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Action Top Bar */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-600">
                当前工程含 <strong className="text-slate-900">{Object.keys(workspace.files).length}</strong> 个文件/文件夹
              </span>
              <button
                type="button"
                onClick={() => setIsCreatingMilestone(true)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>新建命名里程碑</span>
              </button>
            </div>

            {/* Create Milestone Form */}
            {isCreatingMilestone && (
              <div className="p-4 bg-indigo-50/50 border-b border-indigo-100 flex flex-col gap-2 shrink-0 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-indigo-950">保存当前工程为命名里程碑</span>
                  <button
                    type="button"
                    onClick={() => setIsCreatingMilestone(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="快照名称 (例如: IEEE TAC 终稿提交版, 修正引言前)..."
                  value={milestoneName}
                  onChange={(e) => setMilestoneName(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded text-xs bg-white"
                />
                <input
                  type="text"
                  placeholder="可选说明备注 (例如: 补充了第三节李雅普诺夫障碍推导)..."
                  value={milestoneDesc}
                  onChange={(e) => setMilestoneDesc(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded text-xs bg-white"
                />
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsCreatingMilestone(false)}
                    className="px-3 py-1 text-slate-600 hover:text-slate-900 text-xs"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveMilestone}
                    className="px-3.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded text-xs shadow-2xs"
                  >
                    确认保存
                  </button>
                </div>
              </div>
            )}

            {/* Milestones List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-slate-50/50">
              {snapshots.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs border-2 border-dashed border-slate-200 rounded-xl m-2">
                  <Tag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-medium text-slate-600">暂无命名里程碑快照</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    点击上方按钮可将当前论文工程保存为永久命名的阶段版本
                  </p>
                </div>
              ) : (
                snapshots.map((s) => (
                  <div
                    key={s.id}
                    className="p-3.5 bg-white border border-slate-200 hover:border-slate-300 rounded-lg shadow-2xs transition-all space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-xs text-slate-900 flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{s.name}</span>
                        </div>
                        {s.description && (
                          <p className="text-[11px] text-slate-500 mt-0.5">{s.description}</p>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {formatDate(s.timestamp)} {formatTime(s.timestamp)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                      <span className="text-[11px] text-slate-500">
                        包含 {s.fileCount} 个文件
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onRestoreWorkspace(
                              {
                                files: JSON.parse(JSON.stringify(s.files)),
                                activeFileId: s.activeFileId,
                                rootIds: [...s.rootIds],
                                diskPath: workspace.diskPath,
                              },
                              `已还原至里程碑快照「${s.name}」`
                            );
                            showNotice(`已还原至里程碑快照「${s.name}」！`);
                          }}
                          className="px-2.5 py-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>一键还原</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteSnapshot(s.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                          title="删除快照"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span className="text-[11px]">
            自动记录保存在浏览器安全缓存中，执行任何回退前均会自动创建“回退前保护备份”。
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded font-medium transition-colors"
          >
            完成并关闭
          </button>
        </div>
      </div>
    </div>
  );
};
