import React, { useState } from 'react';
import {
  FileText,
  SidebarClose,
  SidebarOpen,
  HelpCircle,
  Download,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Layout,
  Maximize2,
  BarChart3,
  History,
  Archive,
  Table,
  Sparkles,
  BookOpen,
  HardDrive,
  FolderArchive,
  FileDown,
} from 'lucide-react';

interface HeaderProps {
  projectName: string;
  activeFileName: string;
  diskPath?: string;
  isCompiling: boolean;
  hasErrors: boolean;
  leftOpen: boolean;
  rightOpen: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  onDownloadCurrentTex: () => void;
  onOpenWordCount?: () => void;
  onOpenSnapshots?: () => void;
  onExportZip?: () => void;
  onOpenExportMd?: () => void;
  onOpenImportZip?: () => void;
  onOpenTableWizard?: () => void;
  onOpenMathPalette?: () => void;
  llmOpen?: boolean;
  onToggleLLM?: () => void;
  onOpenLLMDoc?: () => void;
  onOpenZotero?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  projectName,
  activeFileName,
  diskPath,
  isCompiling,
  hasErrors,
  leftOpen,
  rightOpen,
  onToggleLeft,
  onToggleRight,
  onDownloadCurrentTex,
  onOpenWordCount,
  onOpenSnapshots,
  onExportZip,
  onOpenExportMd,
  onOpenImportZip,
  onOpenTableWizard,
  onOpenMathPalette,
  llmOpen,
  onToggleLLM,
  onOpenLLMDoc,
  onOpenZotero,
}) => {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <header className="h-12 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between px-3 md:px-4 select-none shrink-0 z-20">
      {/* Left branding & layout controls */}
      <div className="flex items-center gap-2.5">
        {/* Toggle Left Sidebar */}
        <button
          type="button"
          onClick={onToggleLeft}
          title={leftOpen ? '折叠工作区文件树' : '展开工作区文件树'}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
        >
          {leftOpen ? <SidebarClose className="w-4 h-4" /> : <SidebarOpen className="w-4 h-4" />}
        </button>

        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center text-xs font-serif font-bold text-white shadow-xs">
            T<span className="text-[10px] -ml-0.5">e</span>X
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-bold text-sm tracking-tight text-white font-sans">LaTeX Editor</span>
            <span className="text-[11px] text-slate-400 hidden xl:inline">本地实时预览</span>
          </div>
        </div>

        <div className="h-4 w-px bg-slate-700 hidden lg:block" />

        {/* Current File indicator */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800/80 px-2 py-1 rounded max-w-[140px] truncate">
          <FileCode className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span className="font-mono truncate">{activeFileName}</span>
        </div>

        {/* E: Drive Physical Workspace indicator */}
        {diskPath && (
          <button
            type="button"
            onClick={onOpenImportZip}
            title={`物理工作区: ${diskPath}\n点击切换或导入新工程`}
            className="hidden xl:flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-950/80 border border-emerald-700/60 px-2 py-1 rounded max-w-[210px] hover:bg-emerald-900/90 transition-colors"
          >
            <HardDrive className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="font-mono text-[11px] truncate">{diskPath}</span>
          </button>
        )}
      </div>

      {/* Center status badge & fast tools */}
      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs">
          <span
            className={`w-2 h-2 rounded-full ${
              isCompiling
                ? 'bg-amber-400 animate-ping'
                : hasErrors
                ? 'bg-red-500'
                : 'bg-emerald-400'
            }`}
          />
          <span className="text-slate-300 text-[11px]">
            {isCompiling ? '编译中...' : hasErrors ? '语法待修正' : '实时预览就绪'}
          </span>
        </div>

        {/* Fast Action Tools in center/right */}
        {onOpenWordCount && (
          <button
            type="button"
            onClick={onOpenWordCount}
            title="查看论文正文字数与排版指标统计"
            className="px-2 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded flex items-center gap-1 transition-colors"
          >
            <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden md:inline">字数统计</span>
          </button>
        )}

        {onOpenTableWizard && (
          <button
            type="button"
            onClick={onOpenTableWizard}
            title="打开可视化表格生成向导"
            className="px-2 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded flex items-center gap-1 transition-colors"
          >
            <Table className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden md:inline">表格向导</span>
          </button>
        )}

        {onOpenMathPalette && (
          <button
            type="button"
            onClick={onOpenMathPalette}
            title="打开完整数学符号与公式快捷盘"
            className="px-2 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded flex items-center gap-1 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden md:inline">符号大盘</span>
          </button>
        )}

        {onOpenSnapshots && (
          <button
            type="button"
            onClick={onOpenSnapshots}
            title="版本快照与历史还原"
            className="px-2 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded flex items-center gap-1 transition-colors"
          >
            <History className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">版本快照</span>
          </button>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1.5">
        {onToggleLLM && (
          <button
            type="button"
            onClick={onToggleLLM}
            title={llmOpen ? '折叠 AI 智能助手面板' : '展开 AI 智能助手面板 (支持代码直写与文件操作)'}
            className={`px-2.5 py-1 text-xs rounded flex items-center gap-1.5 font-medium shadow-xs transition-all ${
              llmOpen
                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white ring-2 ring-indigo-400/50'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">AI 助手</span>
          </button>
        )}

        {onOpenLLMDoc && (
          <button
            type="button"
            onClick={onOpenLLMDoc}
            title="查看大语言模型 (LLM) 交互接口与说明文档"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors hidden md:block"
          >
            <BookOpen className="w-4 h-4 text-indigo-400" />
          </button>
        )}

        {onOpenImportZip && (
          <button
            type="button"
            onClick={onOpenImportZip}
            title="导入 ZIP 压缩包并在 E 盘工作区解压运行"
            className="px-2.5 py-1 text-xs bg-emerald-700 hover:bg-emerald-600 text-white rounded flex items-center gap-1 font-medium shadow-2xs transition-colors"
          >
            <FolderArchive className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">导入 ZIP (E盘)</span>
          </button>
        )}

        {onOpenZotero && (
          <button
            type="button"
            onClick={onOpenZotero}
            title="连接本地 Zotero MCP 文献库，检索条目并一键插入引用"
            className="px-2.5 py-1 text-xs bg-rose-700 hover:bg-rose-600 text-white rounded flex items-center gap-1.5 font-medium shadow-2xs transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <BookOpen className="w-3.5 h-3.5 text-rose-200" />
            <span className="hidden sm:inline">Zotero 文献</span>
          </button>
        )}

        {onOpenExportMd && (
          <button
            type="button"
            onClick={onOpenExportMd}
            title="导出为 Markdown (.md) 文档 (支持数学公式、数据图表、三线表与参考文献)"
            className="px-2.5 py-1 text-xs bg-indigo-700/90 hover:bg-indigo-700 text-white rounded flex items-center gap-1 font-medium shadow-2xs transition-colors"
          >
            <FileDown className="w-3.5 h-3.5 text-indigo-200" />
            <span className="hidden sm:inline">导出 Markdown</span>
          </button>
        )}

        {onExportZip && (
          <button
            type="button"
            onClick={onExportZip}
            title="打包导出整个工程为 ZIP 压缩包 (含所有 .tex, .bib, 图片文件)"
            className="px-2.5 py-1 text-xs bg-indigo-600/90 hover:bg-indigo-600 text-white rounded flex items-center gap-1 font-medium shadow-2xs transition-colors"
          >
            <Archive className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">导出工程 ZIP</span>
          </button>
        )}

        <button
          type="button"
          onClick={onDownloadCurrentTex}
          title="下载当前单个 .tex 源代码"
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors hidden sm:block"
        >
          <Download className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => setShowHelp(true)}
          title="快捷键与使用帮助"
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Toggle Right Preview */}
        <button
          type="button"
          onClick={onToggleRight}
          title={rightOpen ? '折叠实时编译窗口' : '展开实时编译窗口'}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
        >
          <Layout className={`w-4 h-4 ${rightOpen ? 'text-indigo-400' : ''}`} />
        </button>
      </div>

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 text-slate-800">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-indigo-600" />
                LaTeX 编辑器快捷键与使用指南
              </h3>
              <button
                onClick={() => setShowHelp(false)}
                className="text-slate-400 hover:text-slate-600 text-sm p-1 rounded"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-slate-600">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono text-[11px]">
                <div><span className="font-bold text-slate-800">Ctrl/Cmd + S</span>: 强制保存并编译</div>
                <div><span className="font-bold text-slate-800">Ctrl/Cmd + F</span>: 查找与替换</div>
                <div><span className="font-bold text-slate-800">Ctrl/Cmd + Z</span>: 撤销操作</div>
                <div><span className="font-bold text-slate-800">Ctrl/Cmd + Y</span>: 重做操作</div>
                <div><span className="font-bold text-slate-800">Ctrl/Cmd + B</span>: 粗体 \\textbf&#123;&#125;</div>
                <div><span className="font-bold text-slate-800">Ctrl/Cmd + I</span>: 斜体 \\textit&#123;&#125;</div>
                <div><span className="font-bold text-slate-800">Tab</span>: 缩进 2 个空格</div>
                <div><span className="font-bold text-slate-800">Shift + Tab</span>: 减少缩进</div>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 mb-1">功能特色：</h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>左侧工作文件夹</strong>：支持新建、重命名、删除、文件夹分层，导入外部文件或一键导出为工程 ZIP 压缩包。</li>
                  <li><strong>中间 LaTeX 代码编辑</strong>：内置完整语法高亮、行号、括号自动闭合、光标追踪与数学公式速查工具栏。</li>
                  <li><strong>右侧实时编译窗口</strong>：毫秒级 KaTeX 数学排版，支持 A4 纸张模拟排版、缩放查看、目录大纲跳转与语法诊断定位。</li>
                  <li><strong>PDF 导出</strong>：点击右上角「导出 PDF」或浏览器打印，原生生成高精度排版纸张。</li>
                </ul>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowHelp(false)}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-md shadow-xs transition-colors"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
