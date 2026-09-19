import React, { useState, useEffect, useId } from 'react';
import {
  BookOpen,
  Search,
  Check,
  Copy,
  ExternalLink,
  Plus,
  RefreshCw,
  Server,
  Zap,
  FileText,
  AlertCircle,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  Settings,
  Database
} from 'lucide-react';

export interface ZoteroItem {
  key: string;
  title: string;
  itemType: string;
  date: string;
  year: string;
  publicationTitle: string;
  doi: string;
  url: string;
  authorSummary: string;
  citekey: string;
}

interface ZoteroStatus {
  connected: boolean;
  mcpUrl: string;
  bbtUrl: string;
  mcpInfo?: {
    serverInfo?: { name: string; version: string };
    protocolVersion?: string;
    availableTools?: string[];
  };
  bbtAvailable: boolean;
}

interface ZoteroModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertCitation: (citeKey: string) => void;
  onBibAppended?: (citeKey: string, filename: string) => void;
  workspacePath?: string;
}

export const ZoteroModal: React.FC<ZoteroModalProps> = ({
  isOpen,
  onClose,
  onInsertCitation,
  onBibAppended,
  workspacePath,
}) => {
  const [status, setStatus] = useState<ZoteroStatus | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'settings'>('search');

  // Search states
  const [searchQuery, setSearchQuery] = useState('control');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ZoteroItem[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [searchTime, setSearchTime] = useState<string>('');

  // Item detail / BibTeX preview
  const [expandedItemKey, setExpandedItemKey] = useState<string | null>(null);
  const [itemBibtexMap, setItemBibtexMap] = useState<Record<string, string>>({});
  const [isLoadingBibtex, setIsLoadingBibtex] = useState<string | null>(null);

  // Action status indicators
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [insertedKey, setInsertedKey] = useState<string | null>(null);
  const [appendingKey, setAppendingKey] = useState<string | null>(null);
  const [appendedKey, setAppendedKey] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Settings states
  const [customMcpPort, setCustomMcpPort] = useState('23120');
  const [customBbtPort, setCustomBbtPort] = useState('23119');

  const searchInputId = useId();

  // Show auto-dismiss toast
  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Check connection status
  const checkStatus = async () => {
    setIsCheckingStatus(true);
    try {
      const res = await fetch('/api/zotero/status');
      const data: ZoteroStatus = await res.json();
      setStatus(data);
    } catch {
      setStatus({
        connected: false,
        mcpUrl: `http://127.0.0.1:${customMcpPort}/mcp`,
        bbtUrl: `http://127.0.0.1:${customBbtPort}`,
        bbtAvailable: false,
      });
    } finally {
      setIsCheckingStatus(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkStatus();
      if (searchResults.length === 0 && searchQuery) {
        handleSearch(searchQuery);
      }
    }
  }, [isOpen]);

  // Execute search via backend MCP proxy
  const handleSearch = async (queryToSearch = searchQuery) => {
    const q = queryToSearch.trim();
    if (!q) return;

    setIsSearching(true);
    try {
      const res = await fetch('/api/zotero/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, limit: 30 }),
      });
      const data = await res.json();
      if (res.ok) {
        setSearchResults(data.items || []);
        setTotalResults(data.total || 0);
        setSearchTime(data.searchTime || '');
      } else {
        showToast(data.error || '搜索文献失败', 'error');
      }
    } catch (e: any) {
      showToast(`网络通信异常: ${e.message}`, 'error');
    } finally {
      setIsSearching(false);
    }
  };

  // Fetch or toggle BibTeX preview for an item
  const handleToggleBibtex = async (item: ZoteroItem) => {
    if (expandedItemKey === item.key) {
      setExpandedItemKey(null);
      return;
    }

    setExpandedItemKey(item.key);
    if (!itemBibtexMap[item.key]) {
      setIsLoadingBibtex(item.key);
      try {
        const res = await fetch('/api/zotero/item-details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemKey: item.key }),
        });
        const data = await res.json();
        if (data.bibtex) {
          setItemBibtexMap((prev) => ({ ...prev, [item.key]: data.bibtex }));
        }
      } catch (err) {
        console.error('Failed to load bibtex:', err);
      } finally {
        setIsLoadingBibtex(null);
      }
    }
  };

  // Copy BibTeX or Citekey
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    showToast(`已复制到剪贴板: ${text.slice(0, 30)}...`, 'info');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Insert \cite{...} into active editor
  const handleInsertCite = (item: ZoteroItem) => {
    onInsertCitation(item.citekey);
    setInsertedKey(item.key);
    showToast(`已在光标处插入 \\cite{${item.citekey}}`, 'success');
    setTimeout(() => setInsertedKey(null), 2500);
  };

  // Append BibTeX to references.bib
  const handleAppendBib = async (item: ZoteroItem) => {
    setAppendingKey(item.key);
    try {
      const res = await fetch('/api/zotero/append-bib', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item, targetDir: workspacePath || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setAppendedKey(item.key);
        showToast(data.message || `已添加 ${item.citekey} 至 references.bib`, 'success');
        if (onBibAppended) {
          onBibAppended(item.citekey, 'references.bib');
        }
      } else {
        showToast(data.error || '添加文献条目失败', 'error');
      }
    } catch (e: any) {
      showToast(`追加请求失败: ${e.message}`, 'error');
    } finally {
      setAppendingKey(null);
    }
  };

  if (!isOpen) return null;

  const quickQueries = ['Control', 'Koopman', 'Barrier', 'Strict-Feedback', 'Dead-Zone', 'Prescribed-Time'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-slate-800">
        {/* Top Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-red-600 via-rose-500 to-indigo-600 flex items-center justify-center text-white shadow-xs font-bold text-sm">
              Z
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm leading-none text-slate-100">
                  Zotero 文献库 MCP 互联
                </h3>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-rose-300 border border-slate-700">
                  Model Context Protocol
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                检索本地学术文献库，支持一键光标引文与 BibTeX 自动化同步
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Status pill */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                status?.connected
                  ? 'bg-emerald-950/60 border-emerald-600 text-emerald-300'
                  : 'bg-amber-950/60 border-amber-600 text-amber-300'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  status?.connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span className="text-[11px]">
                {isCheckingStatus
                  ? '检测中...'
                  : status?.connected
                  ? 'Zotero MCP 在线 (:23120)'
                  : '未连接 (请启动 Zotero)'}
              </span>
            </div>

            <button
              type="button"
              onClick={checkStatus}
              title="刷新连接状态"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isCheckingStatus ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 pt-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('search')}
              className={`pb-2 text-xs font-medium flex items-center gap-1.5 border-b-2 transition-colors ${
                activeTab === 'search'
                  ? 'border-indigo-600 text-indigo-600 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              文献检索库 ({totalResults > 0 ? `${totalResults} 条` : '全部'})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`pb-2 text-xs font-medium flex items-center gap-1.5 border-b-2 transition-colors ${
                activeTab === 'settings'
                  ? 'border-indigo-600 text-indigo-600 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              MCP 通信配置与诊断
            </button>
          </div>

          {searchTime && (
            <span className="text-[11px] text-slate-400 font-mono pb-2">
              MCP 响应用时: {searchTime}
            </span>
          )}
        </div>

        {/* Toast alert banner */}
        {toastMessage && (
          <div
            className={`px-4 py-2 text-xs font-medium flex items-center justify-between shrink-0 transition-all ${
              toastMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200'
                : toastMessage.type === 'info'
                ? 'bg-indigo-50 text-indigo-800 border-b border-indigo-200'
                : 'bg-rose-50 text-rose-800 border-b border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>{toastMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Tab 1: Literature Search */}
        {activeTab === 'search' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search toolbar */}
            <div className="p-4 bg-white border-b border-slate-200 space-y-2 shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSearch();
                }}
                className="flex items-center gap-2"
              >
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    id={searchInputId}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="输入检索词（如论文标题、作者名、DOI、年份或关键词）..."
                    className="w-full pl-9 pr-8 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  检索 Zotero
                </button>
              </form>

              {/* Quick search tags */}
              <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-500 pt-0.5">
                <span>快速筛选:</span>
                {quickQueries.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => {
                      setSearchQuery(q);
                      handleSearch(q);
                    }}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded text-slate-600 transition-colors border border-slate-200/80"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Results list area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
              {isSearching ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2.5">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                  <span className="text-xs">正在通过 MCP 协议高速检索本地 Zotero 资料库...</span>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2 border-2 border-dashed border-slate-200 rounded-xl m-2">
                  <BookOpen className="w-8 h-8 text-slate-300" />
                  <p className="text-xs font-medium text-slate-600">未检索到匹配的文献条目</p>
                  <p className="text-[11px] text-slate-400">
                    请确认本地 Zotero 处于运行状态，或尝试搜索其他关键词
                  </p>
                </div>
              ) : (
                searchResults.map((item) => {
                  const isExpanded = expandedItemKey === item.key;
                  const bibtex = itemBibtexMap[item.key];

                  return (
                    <div
                      key={item.key}
                      className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs hover:border-indigo-300 transition-all space-y-2.5"
                    >
                      {/* Title & Type badge */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {item.itemType}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-700 border border-slate-200">
                              Key: {item.citekey}
                            </span>
                            {item.year && (
                              <span className="text-[10px] text-slate-500 font-medium">
                                ({item.year})
                              </span>
                            )}
                          </div>
                          <h4 className="font-semibold text-xs text-slate-900 leading-snug">
                            {item.title}
                          </h4>
                        </div>

                        {/* Top action buttons */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Insert \cite button */}
                          <button
                            type="button"
                            onClick={() => handleInsertCite(item)}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-medium flex items-center gap-1 shadow-2xs transition-colors"
                            title="在当前编辑区光标处插入 \cite{...}"
                          >
                            {insertedKey === item.key ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-300" /> 已插入
                              </>
                            ) : (
                              <>
                                <Plus className="w-3 h-3" /> 插入 \cite
                              </>
                            )}
                          </button>

                          {/* Append to references.bib */}
                          <button
                            type="button"
                            disabled={appendingKey === item.key}
                            onClick={() => handleAppendBib(item)}
                            className="px-2 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 border border-slate-300 rounded text-xs font-medium flex items-center gap-1 transition-colors"
                            title="自动将标准 BibTeX 条目追加至当前工程的 references.bib 文件"
                          >
                            {appendingKey === item.key ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : appendedKey === item.key ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <FileText className="w-3 h-3" />
                            )}
                            同步 BibTeX
                          </button>
                        </div>
                      </div>

                      {/* Authors & Publication metadata */}
                      <div className="text-[11px] text-slate-500 flex items-center gap-3 flex-wrap">
                        {item.authorSummary && (
                          <span className="truncate max-w-sm">
                            <strong className="text-slate-700">作者:</strong> {item.authorSummary}
                          </span>
                        )}
                        {item.publicationTitle && (
                          <span className="truncate max-w-sm">
                            <strong className="text-slate-700">出版物:</strong> {item.publicationTitle}
                          </span>
                        )}
                        {item.doi && (
                          <span className="font-mono text-slate-400 text-[10px]">
                            DOI: {item.doi}
                          </span>
                        )}
                      </div>

                      {/* Footer actions: Open in Zotero, Copy key, View BibTeX */}
                      <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleBibtex(item)}
                            className="text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-0.5"
                          >
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            {isExpanded ? '收起 BibTeX' : '查看 BibTeX 条目'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCopy(item.citekey, `key-${item.key}`)}
                            className="text-slate-500 hover:text-slate-700 flex items-center gap-1"
                            title="仅复制引用键"
                          >
                            {copiedKey === `key-${item.key}` ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            复制键名
                          </button>
                        </div>

                        {/* Open in native desktop Zotero */}
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-slate-400 hover:text-rose-600 flex items-center gap-1 text-[11px]"
                            title="在桌面端 Zotero 客户端中定位该条目"
                          >
                            在 Zotero 中定位 <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                      {/* Expanded BibTeX block */}
                      {isExpanded && (
                        <div className="mt-2 bg-slate-950 text-slate-100 p-3 rounded-md text-[11px] font-mono relative group">
                          {isLoadingBibtex === item.key ? (
                            <div className="py-2 flex items-center gap-2 text-slate-400">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>正在生成规范 BibTeX...</span>
                            </div>
                          ) : (
                            <>
                              <pre className="whitespace-pre-wrap select-text leading-relaxed">
                                {bibtex || '未能获取 BibTeX 详情'}
                              </pre>
                              {bibtex && (
                                <button
                                  type="button"
                                  onClick={() => handleCopy(bibtex, `bib-${item.key}`)}
                                  className="absolute top-2 right-2 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] flex items-center gap-1 transition-colors"
                                >
                                  {copiedKey === `bib-${item.key}` ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-400" /> 已复制
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" /> 复制 BibTeX
                                    </>
                                  )}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Settings & Diagnostics */}
        {activeTab === 'settings' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs bg-white">
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                <Server className="w-4 h-4 text-indigo-600" />
                Zotero 本地 MCP 通信协议诊断
              </h4>
              <p className="text-slate-600 leading-relaxed">
                当前系统通过内置的 Model Context Protocol (MCP) JSON-RPC 2.0 客户端与您本地的 Zotero 通信。
                无需联网上传数据，完全在本地环回网络 (127.0.0.1) 中安全流转。
              </p>
            </div>

            {/* Diagnostic card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-slate-400 text-[11px] block">MCP 服务端点 (JSON-RPC)</span>
                  <div className="font-mono text-slate-800 text-xs flex items-center gap-2">
                    <span>{status?.mcpUrl || 'http://127.0.0.1:23120/mcp'}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] ${
                        status?.connected
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {status?.connected ? '在线响应正常' : '未连接'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-400 text-[11px] block">Better BibTeX 插件端点</span>
                  <div className="font-mono text-slate-800 text-xs flex items-center gap-2">
                    <span>{status?.bbtUrl || 'http://127.0.0.1:23119'}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] ${
                        status?.bbtAvailable
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {status?.bbtAvailable ? '就绪' : '未探测到'}
                    </span>
                  </div>
                </div>
              </div>

              {status?.mcpInfo && (
                <div className="pt-3 border-t border-slate-200 space-y-1.5">
                  <span className="text-slate-400 text-[11px] block font-medium">
                    已激活的 MCP 工具清单 ({status.mcpInfo.availableTools?.length || 0} 个):
                  </span>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-2 bg-white rounded border border-slate-200 font-mono text-[10px] text-slate-700">
                    {status.mcpInfo.availableTools?.map((t) => (
                      <span key={t} className="px-1.5 py-0.5 bg-slate-100 rounded text-indigo-700">
                        {t}
                      </span>
                    )) || <span>search_library, get_item_details, get_collections...</span>}
                  </div>
                </div>
              )}
            </div>

            {/* Custom port settings */}
            <div className="space-y-3 pt-2">
              <h5 className="font-semibold text-xs text-slate-800">自定义通信端口</h5>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-600 text-[11px] block">Zotero MCP 端口</label>
                  <input
                    type="text"
                    value={customMcpPort}
                    onChange={(e) => setCustomMcpPort(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 text-[11px] block">Better BibTeX 端口</label>
                  <input
                    type="text"
                    value={customBbtPort}
                    onChange={(e) => setCustomBbtPort(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Troubleshooting guide */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-amber-900 text-xs">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertCircle className="w-4 h-4 text-amber-700" />
                排查与连接建议
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-800 leading-relaxed">
                <li>
                  请确保您的桌面端 <strong>Zotero</strong> 已经启动；
                </li>
                <li>
                  在 Zotero 的「工具」-「附加组件」中确认已启用 <strong>Zotero MCP Plugin</strong>；
                </li>
                <li>
                  默认服务端口为 <code>23120</code>，若修改过端口请在上方设置中保持一致并点击测试。
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0 text-xs">
          <div className="text-slate-500 text-[11px] flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>支持一键向当前工程自动追加 BibTeX 条目并去重</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-medium transition-colors"
          >
            完成并关闭
          </button>
        </div>
      </div>
    </div>
  );
};
