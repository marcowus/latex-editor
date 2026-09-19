import React, { useState, useMemo } from 'react';
import {
  FileDown,
  X,
  Copy,
  Check,
  Download,
  Archive,
  Eye,
  Code2,
  Sigma,
  Table,
  Image,
  BookOpen,
  Layers,
  Settings2,
  FileText
} from 'lucide-react';
import { WorkspaceState } from '../types/latex';
import {
  exportLatexToMarkdown,
  downloadMarkdownFile,
  exportMarkdownBundleZip,
  MdExportOptions,
} from '../utils/mdExporter';

interface ExportMdModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: WorkspaceState;
  activeFileContent?: string;
  activeFileName?: string;
}

export const ExportMdModal: React.FC<ExportMdModalProps> = ({
  isOpen,
  onClose,
  workspace,
  activeFileContent,
  activeFileName,
}) => {
  // Config states
  const [scope, setScope] = useState<'project' | 'active'>('project');
  const [mathFlavor, setMathFlavor] = useState<'standard' | 'numbered'>('standard');
  const [frontmatter, setFrontmatter] = useState<'title' | 'yaml' | 'none'>('title');
  const [embedImages, setEmbedImages] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'source' | 'preview'>('source');
  const [copied, setCopied] = useState<boolean>(false);
  const [isZipping, setIsZipping] = useState<boolean>(false);

  // Determine source code according to scope
  const targetSource = useMemo(() => {
    if (scope === 'active') {
      return activeFileContent || '';
    }
    // Prefer main.tex for project scope
    const mainFile = Object.values(workspace.files).find(
      f => f.name.toLowerCase() === 'main.tex'
    );
    if (mainFile && mainFile.content) {
      return mainFile.content;
    }
    return activeFileContent || '';
  }, [scope, activeFileContent, workspace.files]);

  // Execute export conversion
  const exportResult = useMemo(() => {
    const opts: MdExportOptions = {
      scope,
      mathFlavor,
      frontmatter,
      embedImages,
      includeBib: true,
      files: workspace.files,
      activeFileId: workspace.activeFileId,
    };
    return exportLatexToMarkdown(targetSource, opts);
  }, [targetSource, scope, mathFlavor, frontmatter, embedImages, workspace.files, workspace.activeFileId]);

  // Base safe file name
  const exportBaseName = useMemo(() => {
    const raw = exportResult.title || activeFileName?.replace(/\.tex$/i, '') || 'paper';
    return raw.replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, '_').slice(0, 50);
  }, [exportResult.title, activeFileName]);

  // Copy to clipboard handler
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportResult.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = exportResult.markdown;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  // Direct download handler
  const handleDownload = () => {
    downloadMarkdownFile(exportResult.markdown, `${exportBaseName}.md`);
  };

  // Bundle download handler
  const handleExportZip = async () => {
    try {
      setIsZipping(true);
      await exportMarkdownBundleZip(
        exportResult.markdown,
        `${exportBaseName}.md`,
        workspace,
        exportBaseName
      );
    } finally {
      setIsZipping(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 text-slate-800 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-lg shadow-xs">
              <FileDown className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold tracking-tight">导出为 Markdown (.md) 文档</h3>
                <span className="text-[11px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-1.5 py-0.5 rounded">
                  GFM / MathJax / Obsidian
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                完整转换 LaTeX 公式推导、三线表、矢量插图、定理证明、多章节合并与参考文献
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Configurations Toolbar */}
        <div className="px-5 py-3 bg-slate-50/90 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          {/* Left Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Scope Toggle */}
            <div className="flex items-center bg-white border border-slate-200 p-0.5 rounded-lg shadow-2xs">
              <button
                type="button"
                onClick={() => setScope('project')}
                className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                  scope === 'project'
                    ? 'bg-indigo-600 font-semibold text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="合并 main.tex 及所有 \input{} 关联的子章节文件"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>全工程合并</span>
              </button>
              <button
                type="button"
                onClick={() => setScope('active')}
                className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                  scope === 'active'
                    ? 'bg-indigo-600 font-semibold text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="仅导出当前编辑区打开的单个文件"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>仅当前文件</span>
              </button>
            </div>

            {/* Frontmatter Format */}
            <div className="flex items-center bg-white border border-slate-200 p-0.5 rounded-lg shadow-2xs">
              <button
                type="button"
                onClick={() => setFrontmatter('title')}
                className={`px-2 py-1 rounded-md transition-all ${
                  frontmatter === 'title'
                    ? 'bg-slate-800 font-semibold text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="采用标准 Markdown # 标题、作者行与摘要引用块"
              >
                标准大标题
              </button>
              <button
                type="button"
                onClick={() => setFrontmatter('yaml')}
                className={`px-2 py-1 rounded-md transition-all ${
                  frontmatter === 'yaml'
                    ? 'bg-slate-800 font-semibold text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="包含 YAML Frontmatter 头部 (适用于 Obsidian 与静态博客)"
              >
                YAML 头部
              </button>
            </div>

            {/* Math Flavor */}
            <div className="flex items-center bg-white border border-slate-200 p-0.5 rounded-lg shadow-2xs">
              <button
                type="button"
                onClick={() => setMathFlavor('standard')}
                className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 ${
                  mathFlavor === 'standard'
                    ? 'bg-slate-800 font-semibold text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="MathJax / KaTeX 标准 $$...$$ 与 aligned 对齐环境"
              >
                <Sigma className="w-3.5 h-3.5" />
                <span>标准 KaTeX</span>
              </button>
              <button
                type="button"
                onClick={() => setMathFlavor('numbered')}
                className={`px-2 py-1 rounded-md transition-all ${
                  mathFlavor === 'numbered'
                    ? 'bg-slate-800 font-semibold text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="保留 \begin{equation} 编号环境"
              >
                带编号环境
              </button>
            </div>

            {/* Image Embed Option */}
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-2xs hover:bg-slate-50 transition-colors">
              <input
                type="checkbox"
                checked={embedImages}
                onChange={e => setEmbedImages(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
              />
              <span>嵌入 SVG 矢量图元</span>
            </label>
          </div>

          {/* Right View Tabs */}
          <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => setActiveTab('source')}
              className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 font-medium ${
                activeTab === 'source'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Code2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>MD 源码</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 font-medium ${
                activeTab === 'preview'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5 text-emerald-600" />
              <span>渲染预览</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-[380px] max-h-[56vh] overflow-hidden flex flex-col bg-slate-900">
          {activeTab === 'source' ? (
            <div className="flex-1 p-4 overflow-auto font-mono text-xs text-slate-200 leading-relaxed select-text">
              <pre className="whitespace-pre-wrap font-mono text-xs">{exportResult.markdown}</pre>
            </div>
          ) : (
            <div className="flex-1 p-6 overflow-auto bg-white text-slate-800 prose prose-slate max-w-none text-sm select-text">
              <div className="font-mono text-xs text-slate-500 mb-4 pb-2 border-b border-slate-200">
                📄 目标文档标题: <strong className="text-slate-800">{exportResult.title}</strong>
              </div>
              <div className="whitespace-pre-wrap font-sans leading-relaxed">
                {exportResult.markdown}
              </div>
            </div>
          )}
        </div>

        {/* Metrics Banner */}
        <div className="px-5 py-2.5 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-3 text-slate-600 font-mono">
            <span className="flex items-center gap-1">
              <span className="font-semibold text-slate-900">{exportResult.stats.wordCount.toLocaleString()}</span>
              <span>字/词</span>
            </span>
            <span className="text-slate-300">|</span>
            <span className="flex items-center gap-1">
              <Sigma className="w-3.5 h-3.5 text-indigo-600" />
              <span className="font-semibold text-slate-900">{exportResult.stats.equationCount}</span>
              <span>公式</span>
            </span>
            <span className="text-slate-300">|</span>
            <span className="flex items-center gap-1">
              <Table className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-semibold text-slate-900">{exportResult.stats.tableCount}</span>
              <span>表格</span>
            </span>
            <span className="text-slate-300">|</span>
            <span className="flex items-center gap-1">
              <Image className="w-3.5 h-3.5 text-blue-600" />
              <span className="font-semibold text-slate-900">{exportResult.stats.figureCount}</span>
              <span>插图</span>
            </span>
            <span className="text-slate-300">|</span>
            <span className="flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-amber-600" />
              <span className="font-semibold text-slate-900">{exportResult.stats.sectionCount}</span>
              <span>章节</span>
            </span>
          </div>

          <div className="text-[11px] text-slate-400 font-mono">
            文件名: <span className="text-slate-700 font-medium">{exportBaseName}.md</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            取消
          </button>

          <div className="flex items-center gap-2.5">
            {/* Copy button */}
            <button
              type="button"
              onClick={handleCopy}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-xs transition-all ${
                copied
                  ? 'bg-emerald-600 text-white ring-2 ring-emerald-400/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-white'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '已复制到剪贴板' : '复制 Markdown'}</span>
            </button>

            {/* ZIP with assets button */}
            <button
              type="button"
              onClick={handleExportZip}
              disabled={isZipping}
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
              title="打包导出 Markdown 文件以及工程引用的所有图片与资源"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>{isZipping ? '打包中...' : '导出 ZIP (含图表)'}</span>
            </button>

            {/* Download .md button */}
            <button
              type="button"
              onClick={handleDownload}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>下载 .md 文档</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
