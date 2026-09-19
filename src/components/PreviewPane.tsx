import React, { useState, useRef, useEffect } from 'react';
import {
  RefreshCw,
  Printer,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileText,
  AlertTriangle,
  AlertCircle,
  ListTree,
  ChevronDown,
  ExternalLink,
  BookOpen,
  Eye,
  Navigation,
  CheckCircle2,
  ArrowRight,
  FileDown
} from 'lucide-react';
import { CompileResult, Diagnostic, LatexEngine } from '../types/latex';

interface PreviewPaneProps {
  compileResult: CompileResult;
  isCompiling: boolean;
  autoCompile: boolean;
  onToggleAutoCompile: () => void;
  onRecompile: () => void;
  onJumpToLine: (line: number) => void;
  onSyncToSource?: (loc: { line: number; fileId?: string; fileName?: string }) => void;
  forwardSyncTarget?: { line: number; timestamp: number } | null;
  selectedEngine?: LatexEngine;
  onChangeEngine?: (engine: LatexEngine) => void;
  onExportMd?: () => void;
}

export const PreviewPane: React.FC<PreviewPaneProps> = ({
  compileResult,
  isCompiling,
  autoCompile,
  onToggleAutoCompile,
  onRecompile,
  onJumpToLine,
  onSyncToSource,
  forwardSyncTarget,
  selectedEngine,
  onChangeEngine,
  onExportMd,
}) => {
  const paperRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(100);
  const [viewMode, setViewMode] = useState<'paged' | 'continuous'>('paged');
  const [showOutline, setShowOutline] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 15, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 15, 50));
  const handleResetZoom = () => setZoom(100);

  const handlePrintPdf = () => {
    window.print();
  };

  // Forward SyncTeX: Watch for code editor line forward jump
  useEffect(() => {
    if (!forwardSyncTarget || !paperRef.current) return;
    const { line } = forwardSyncTarget;
    const nodes = paperRef.current.querySelectorAll<HTMLElement>('[data-source-line]');
    if (!nodes || nodes.length === 0) return;

    let closestNode: HTMLElement | null = null;
    let minDiff = Infinity;

    nodes.forEach(node => {
      const lineAttr = node.getAttribute('data-source-line');
      if (lineAttr) {
        const nodeLine = parseInt(lineAttr, 10);
        const diff = Math.abs(nodeLine - line);
        if (diff < minDiff) {
          minDiff = diff;
          closestNode = node;
        }
      }
    });

    if (closestNode) {
      (closestNode as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
      (closestNode as HTMLElement).classList.add('forward-sync-flash');
      setSyncFeedback(`正向定位：聚焦至第 ${line} 行对应内容`);
      const timer = setTimeout(() => {
        closestNode?.classList.remove('forward-sync-flash');
        setSyncFeedback(null);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [forwardSyncTarget]);

  // Reverse SyncTeX: Click or double click on preview elements to locate source code
  const handlePreviewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const targetEl = e.target as HTMLElement;

    // Smooth scroll if clicking on internal link like \ref <a href="#tbl-1">
    const anchorEl = targetEl.closest('a');
    if (anchorEl) {
      const href = anchorEl.getAttribute('href');
      if (href && href.startsWith('#')) {
        const targetId = href.slice(1);
        const targetNode = paperRef.current?.querySelector(`#${targetId}`);
        if (targetNode) {
          e.preventDefault();
          targetNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
          targetNode.classList.add('forward-sync-flash');
          setTimeout(() => targetNode.classList.remove('forward-sync-flash'), 2200);
        }
      }
    }

    // Toggle button for TikZ code view if clicked
    const toggleBtn = targetEl.closest('[data-toggle-target]');
    if (toggleBtn) {
      e.stopPropagation();
      const targetId = toggleBtn.getAttribute('data-toggle-target');
      if (targetId) {
        const el = paperRef.current?.querySelector(`#${targetId}`);
        if (el) {
          el.classList.toggle('hidden');
          const isHidden = el.classList.contains('hidden');
          toggleBtn.textContent = isHidden ? '查看 TikZ 源码' : '收起源码';
        }
      }
      return;
    }

    const syncNode = targetEl.closest('[data-source-line]');
    if (!syncNode) return;
    const lineStr = syncNode.getAttribute('data-source-line');
    const fileId = syncNode.getAttribute('data-source-file-id') || undefined;
    const fileName = syncNode.getAttribute('data-source-file-name') || undefined;

    if (lineStr) {
      const line = parseInt(lineStr, 10);
      if (!isNaN(line)) {
        if (onSyncToSource) {
          onSyncToSource({ line, fileId, fileName });
        } else {
          onJumpToLine(line);
        }
        setSyncFeedback(`已精准定位至代码第 ${line} 行${fileName ? ` (${fileName})` : ''}`);
        setTimeout(() => setSyncFeedback(null), 2400);
      }
    }
  };

  const errorCount = compileResult.diagnostics.filter(d => d.type === 'error').length;
  const warningCount = compileResult.diagnostics.filter(d => d.type === 'warning').length;

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 border-l border-slate-200 relative overflow-hidden select-none">
      {/* SyncTeX Feedback Floating Toast */}
      {syncFeedback && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-40 bg-slate-900/90 text-white text-xs px-3.5 py-1.5 rounded-full shadow-lg flex items-center gap-2 border border-slate-700 pointer-events-none transition-all duration-200">
          <Navigation className="w-3.5 h-3.5 text-amber-300 shrink-0" />
          <span className="font-medium">{syncFeedback}</span>
        </div>
      )}

      {/* Top Preview Toolbar */}
      <div className="px-3 py-2 bg-white border-b border-slate-200 flex items-center justify-between gap-2 text-xs">
        {/* Left Status & Compilation */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isCompiling
                  ? 'bg-amber-500 animate-ping'
                  : errorCount > 0
                  ? 'bg-red-500'
                  : 'bg-emerald-500'
              }`}
            />
            <span className="font-semibold text-slate-700">实时渲染</span>
          </div>

          <span className="text-[11px] text-slate-400 font-mono">
            {isCompiling ? '编译中...' : `${compileResult.compileTimeMs} ms`}
          </span>

          <button
            type="button"
            title="手动重新编译"
            onClick={onRecompile}
            className={`p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors ${
              isCompiling ? 'animate-spin text-indigo-600' : ''
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <label className="flex items-center gap-1 cursor-pointer text-[11px] text-slate-600 ml-1">
            <input
              type="checkbox"
              checked={autoCompile}
              onChange={onToggleAutoCompile}
              className="rounded text-indigo-600 focus:ring-indigo-500 w-3 h-3 cursor-pointer"
            />
            <span>实时跟随</span>
          </label>

          {/* SyncTeX Indicator Pill */}
          <div
            title="反向搜索 (SyncTeX)：在预览区点击或双击任意章节、公式、段落、表格或定理，即可自动定位并高亮中间对应的 LaTeX 代码行"
            className="hidden lg:flex items-center gap-1 text-[11px] text-indigo-700 bg-indigo-50/90 border border-indigo-200/80 px-2 py-0.5 rounded cursor-help"
          >
            <Navigation className="w-3 h-3 text-indigo-600" />
            <span className="font-medium">反向定位</span>
            <span className="text-[10px] text-indigo-500 font-normal hidden xl:inline">(点预览跳源码)</span>
          </div>
        </div>

        {/* Right Preview Controls */}
        <div className="flex items-center gap-1">
          {/* Outline button */}
          <button
            type="button"
            onClick={() => setShowOutline(!showOutline)}
            className={`p-1 rounded flex items-center gap-1 transition-colors ${
              showOutline ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
            }`}
            title="文档大纲导航"
          >
            <ListTree className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">大纲</span>
          </button>

          {/* Engine Selector (XeLaTeX / pdfLaTeX) */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200 text-[11px]">
            <button
              type="button"
              onClick={() => onChangeEngine?.('xelatex')}
              title="XeLaTeX 排版引擎：完美兼容 UTF-8、中文 CTeX、xeCJK、现代字体与复杂数学公式"
              className={`px-1.5 py-0.5 rounded transition-all ${
                (selectedEngine === 'xelatex' || (!selectedEngine && compileResult.engine === 'xelatex'))
                  ? 'bg-indigo-600 text-white font-medium shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              XeLaTeX
            </button>
            <button
              type="button"
              onClick={() => onChangeEngine?.('pdflatex')}
              title="pdfLaTeX 排版引擎：经典 LaTeX 编译器，支持 inputenc/fontenc 与 CJKutf8"
              className={`px-1.5 py-0.5 rounded transition-all ${
                (selectedEngine === 'pdflatex' || (!selectedEngine && compileResult.engine === 'pdflatex'))
                  ? 'bg-indigo-600 text-white font-medium shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              pdfLaTeX
            </button>
          </div>

          {/* View mode toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200 text-[11px]">
            <button
              type="button"
              onClick={() => setViewMode('paged')}
              className={`px-1.5 py-0.5 rounded ${
                viewMode === 'paged' ? 'bg-white shadow-2xs font-medium text-slate-900' : 'text-slate-500'
              }`}
            >
              A4纸张
            </button>
            <button
              type="button"
              onClick={() => setViewMode('continuous')}
              className={`px-1.5 py-0.5 rounded ${
                viewMode === 'continuous' ? 'bg-white shadow-2xs font-medium text-slate-900' : 'text-slate-500'
              }`}
            >
              连续
            </button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-0.5 bg-slate-100 px-1 py-0.5 rounded border border-slate-200">
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-0.5 text-slate-600 hover:text-slate-900 rounded"
              title="缩小"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span
              onClick={handleResetZoom}
              title="点击重置为 100%"
              className="cursor-pointer text-[10px] font-mono px-1 text-slate-600 hover:text-indigo-600"
            >
              {zoom}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-0.5 text-slate-600 hover:text-slate-900 rounded"
              title="放大"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>

          {/* Diagnostics toggle */}
          <button
            type="button"
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className={`px-2 py-1 rounded flex items-center gap-1 font-medium transition-colors ${
              errorCount > 0
                ? 'bg-red-50 text-red-700 border border-red-200'
                : warningCount > 0
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {errorCount > 0 ? (
              <AlertCircle className="w-3.5 h-3.5 text-red-600" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            )}
            <span className="text-[11px]">{errorCount > 0 ? `${errorCount} 错误` : `${warningCount} 诊断`}</span>
          </button>

          {/* Export Markdown */}
          {onExportMd && (
            <button
              type="button"
              onClick={onExportMd}
              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded font-medium text-xs flex items-center gap-1 shadow-2xs transition-colors"
              title="导出为 Markdown (.md) 文档 (含图表与公式)"
            >
              <FileDown className="w-3.5 h-3.5 text-indigo-600" />
              <span>导出 MD</span>
            </button>
          )}

          {/* Export / Print PDF */}
          <button
            type="button"
            onClick={handlePrintPdf}
            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium text-xs flex items-center gap-1 shadow-2xs transition-colors"
            title="打印或另存为 PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>导出 PDF</span>
          </button>
        </div>
      </div>

      {/* Main Preview Scroll Area */}
      <div className="flex-1 overflow-auto p-4 flex justify-center items-start print:p-0 print:bg-white bg-slate-200/70">
        {/* Outline Sidebar drawer */}
        {showOutline && (
          <div className="w-56 bg-white/95 backdrop-blur-xs border-r border-slate-200 h-full p-3 overflow-y-auto shrink-0 shadow-lg absolute left-0 top-10 bottom-0 z-20">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-2">
              <span className="font-bold text-xs text-slate-700 flex items-center gap-1">
                <ListTree className="w-3.5 h-3.5 text-indigo-600" /> 目录大纲
              </span>
              <button onClick={() => setShowOutline(false)} className="text-slate-400 hover:text-slate-600 text-xs">
                ✕
              </button>
            </div>
            {compileResult.toc.length === 0 ? (
              <p className="text-xs text-slate-400">暂无检测到 \\section 标题</p>
            ) : (
              <div className="space-y-1">
                {compileResult.toc.map((item, idx) => (
                  <a
                    key={idx}
                    href={`#${item.id}`}
                    style={{ paddingLeft: `${(item.level - 1) * 10}px` }}
                    className="block text-xs text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/50 py-1 px-1.5 rounded truncate transition-colors"
                  >
                    {item.title}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Paper Container with Click-to-Source (SyncTeX) delegation */}
        <div
          ref={paperRef}
          onClick={handlePreviewClick}
          onDoubleClick={handlePreviewClick}
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
            fontFamily: (selectedEngine === 'xelatex' || compileResult.engine === 'xelatex')
              ? '"Noto Serif SC", "Source Han Serif SC", "Songti SC", "SimSun", STSong, "Times New Roman", Georgia, serif'
              : '"Times New Roman", "Nimbus Roman", Georgia, "Noto Serif SC", "SimSun", serif',
          }}
          className={`transition-transform duration-100 ${
            viewMode === 'paged'
              ? 'w-[794px] min-h-[1123px] bg-white shadow-xl rounded-xs p-16 my-2 text-slate-900 border border-slate-300/80 print:shadow-none print:border-none print:m-0 print:p-8'
              : 'w-full max-w-4xl bg-white shadow-md rounded-md p-10 my-2 text-slate-900 border border-slate-200'
          }`}
        >
          {/* Authentic Academic Paper Header */}
          <div className="text-center mb-8 border-b border-slate-100 pb-6">
            <h1
              data-source-line={compileResult.titleLoc?.line || 1}
              data-source-file-id={compileResult.titleLoc?.fileId}
              data-source-file-name={compileResult.titleLoc?.fileName}
              data-latex-sync="true"
              title={`点击定位到 \\title 源码 (第 ${compileResult.titleLoc?.line || 1} 行)`}
              className="latex-sync-node text-2xl sm:text-3xl font-serif font-bold text-slate-900 tracking-tight leading-snug mb-3 cursor-pointer hover:text-indigo-600 transition-colors"
            >
              {compileResult.title}
            </h1>

            {compileResult.authors.length > 0 && (
              <div
                data-source-line={compileResult.authorsLoc?.line || 1}
                data-source-file-id={compileResult.authorsLoc?.fileId}
                data-source-file-name={compileResult.authorsLoc?.fileName}
                data-latex-sync="true"
                title={`点击定位到 \\author 源码 (第 ${compileResult.authorsLoc?.line || 1} 行)`}
                className="latex-sync-node text-sm font-serif text-slate-700 flex flex-wrap justify-center gap-4 my-2 cursor-pointer hover:text-indigo-600 transition-colors"
              >
                {compileResult.authors.map((author, idx) => (
                  <span key={idx} className="font-medium">
                    {author}
                  </span>
                ))}
              </div>
            )}

            {compileResult.date && (
              <div className="text-xs font-serif text-slate-500 mt-1 italic">{compileResult.date}</div>
            )}

            {/* Abstract Block */}
            {compileResult.abstract && (
              <div
                data-source-line={compileResult.abstractLoc?.line || 1}
                data-source-file-id={compileResult.abstractLoc?.fileId}
                data-source-file-name={compileResult.abstractLoc?.fileName}
                data-latex-sync="true"
                title={`点击定位到摘要 (Abstract) 源码 (第 ${compileResult.abstractLoc?.line || 1} 行)`}
                className="latex-sync-node max-w-xl mx-auto mt-6 text-left p-4 bg-slate-50/70 border border-slate-200 rounded-sm cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/20 transition-all group"
              >
                <div className="text-xs font-serif font-bold text-slate-800 text-center uppercase tracking-wider mb-1.5 group-hover:text-indigo-600 transition-colors">
                  Abstract / 摘要
                </div>
                <div
                  className="text-xs font-serif text-slate-700 leading-relaxed text-justify indent-4"
                  dangerouslySetInnerHTML={{ __html: compileResult.abstract }}
                />
              </div>
            )}
          </div>

          {/* Compiled Document Body */}
          <div
            className="latex-preview-content font-serif text-slate-900 text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: compileResult.html }}
          />

          {/* Paper Footer / Page Number */}
          {viewMode === 'paged' && (
            <div className="mt-16 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] font-serif text-slate-400 select-none print:fixed print:bottom-4 print:w-full">
              <span>LaTeX Document Preview</span>
              <span>- 1 -</span>
            </div>
          )}
        </div>
      </div>

      {/* Diagnostics Drawer (Bottom) */}
      {showDiagnostics && (
        <div className="bg-white border-t border-slate-200 max-h-48 overflow-y-auto p-3 text-xs shadow-lg z-30">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-2 font-semibold text-slate-700">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              编译诊断与错误日志 ({compileResult.diagnostics.length} 项)
            </span>
            <button
              onClick={() => setShowDiagnostics(false)}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
            >
              ✕
            </button>
          </div>

          {compileResult.diagnostics.length === 0 ? (
            <p className="text-emerald-600 font-medium py-1">✓ 语法检查完毕，未发现语法冲突或错误。</p>
          ) : (
            <div className="space-y-1">
              {compileResult.diagnostics.map((diag, idx) => (
                <div
                  key={idx}
                  onClick={() => onJumpToLine(diag.line)}
                  className={`flex items-start justify-between p-2 rounded cursor-pointer transition-colors ${
                    diag.type === 'error'
                      ? 'bg-red-50 text-red-800 hover:bg-red-100/80 border-l-3 border-red-500'
                      : 'bg-amber-50 text-amber-800 hover:bg-amber-100/80 border-l-3 border-amber-500'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="font-mono font-bold text-xs bg-white px-1.5 py-0.5 rounded shadow-2xs border border-slate-200">
                      第 {diag.line} 行
                    </span>
                    <span>{diag.message}</span>
                  </div>
                  <span className="text-[11px] underline shrink-0 font-medium">跳转定位</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
