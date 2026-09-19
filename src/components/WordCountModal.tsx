import React, { useState, useMemo } from 'react';
import { BarChart3, X, FileText, Clock, Hash, Image, Table, Quote, Sigma } from 'lucide-react';
import { WorkspaceState } from '../types/latex';
import { computeLatexWordCount, WordCountStats } from '../utils/wordCounter';

interface WordCountModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: WorkspaceState;
}

export const WordCountModal: React.FC<WordCountModalProps> = ({
  isOpen,
  onClose,
  workspace,
}) => {
  const [scope, setScope] = useState<'active' | 'project'>('active');

  const activeFile = workspace.files[workspace.activeFileId];

  // Calculate stats based on scope
  const stats: WordCountStats = useMemo(() => {
    if (scope === 'active') {
      return computeLatexWordCount(activeFile?.content || '');
    }

    // Merge all .tex files
    const allTex = Object.values(workspace.files)
      .filter(f => f.name.endsWith('.tex') && f.content)
      .map(f => f.content)
      .join('\n\n');

    return computeLatexWordCount(allTex);
  }, [scope, activeFile, workspace.files]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 text-slate-800">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-xl w-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-600 rounded-md">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">学术论文正文字数与排版统计 (Word Counter)</h3>
              <p className="text-[11px] text-slate-400">已智能剔除导言区、LaTeX 宏命令及公式符号，真实反映论文规模</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scope Selector */}
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-600 font-medium">统计范围：</span>
          <div className="flex items-center bg-slate-200 p-0.5 rounded-md">
            <button
              type="button"
              onClick={() => setScope('active')}
              className={`px-3 py-1 rounded text-xs transition-all ${
                scope === 'active'
                  ? 'bg-white font-semibold text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              当前文件 ({activeFile?.name || '无'})
            </button>
            <button
              type="button"
              onClick={() => setScope('project')}
              className={`px-3 py-1 rounded text-xs transition-all ${
                scope === 'project'
                  ? 'bg-white font-semibold text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              全工程所有 .tex 文件
            </button>
          </div>
        </div>

        {/* Primary Metrics Grid */}
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* Total Words Card */}
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/60 border border-indigo-200 p-3.5 rounded-xl">
              <span className="text-[11px] font-medium text-indigo-700 block mb-1">正文总词/字数</span>
              <div className="text-2xl font-bold font-mono text-indigo-900">
                {stats.totalWords.toLocaleString()}
              </div>
              <span className="text-[10px] text-indigo-600/80">中文字数 + 英文单词</span>
            </div>

            {/* Reading Time Card */}
            <div className="bg-gradient-to-br from-amber-50 to-amber-100/60 border border-amber-200 p-3.5 rounded-xl">
              <span className="text-[11px] font-medium text-amber-700 block mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3" /> 预计阅读耗时
              </span>
              <div className="text-2xl font-bold font-mono text-amber-900">
                ~{stats.estimatedReadingMinutes} <span className="text-xs font-normal">分钟</span>
              </div>
              <span className="text-[10px] text-amber-600/80">基于 ~200 字/分标准速</span>
            </div>

            {/* Total Chars Card */}
            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
              <span className="text-[11px] font-medium text-slate-600 block mb-1">字符数 (不计空格)</span>
              <div className="text-2xl font-bold font-mono text-slate-800">
                {stats.totalCharsNoSpaces.toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-400">计空格 {stats.totalCharsWithSpaces.toLocaleString()}</span>
            </div>
          </div>

          {/* Detailed Counts Breakdown */}
          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <div className="px-3.5 py-2 bg-slate-50 font-semibold text-slate-700 border-b border-slate-200">
              学术结构细分明细
            </div>
            <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 bg-white">
              <div className="p-3 flex items-center justify-between">
                <span className="text-slate-600 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-500" /> 中文字数 (Chinese)
                </span>
                <span className="font-mono font-bold text-slate-800">{stats.chineseChars}</span>
              </div>
              <div className="p-3 flex items-center justify-between">
                <span className="text-slate-600 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-purple-500" /> 英文单词数 (Words)
                </span>
                <span className="font-mono font-bold text-slate-800">{stats.englishWords}</span>
              </div>
              <div className="p-3 flex items-center justify-between">
                <span className="text-slate-600 flex items-center gap-1.5">
                  <Sigma className="w-3.5 h-3.5 text-indigo-500" /> 行内数学公式 ($...$)
                </span>
                <span className="font-mono font-bold text-slate-800">{stats.inlineMathCount} 个</span>
              </div>
              <div className="p-3 flex items-center justify-between">
                <span className="text-slate-600 flex items-center gap-1.5">
                  <Sigma className="w-3.5 h-3.5 text-indigo-600" /> 独立公式/对齐环境
                </span>
                <span className="font-mono font-bold text-slate-800">{stats.displayMathCount} 个</span>
              </div>
              <div className="p-3 flex items-center justify-between">
                <span className="text-slate-600 flex items-center gap-1.5">
                  <Table className="w-3.5 h-3.5 text-emerald-500" /> 实验表格 (Tables)
                </span>
                <span className="font-mono font-bold text-slate-800">{stats.tablesCount} 个</span>
              </div>
              <div className="p-3 flex items-center justify-between">
                <span className="text-slate-600 flex items-center gap-1.5">
                  <Image className="w-3.5 h-3.5 text-amber-500" /> 插图图像 (Figures)
                </span>
                <span className="font-mono font-bold text-slate-800">{stats.figuresCount} 个</span>
              </div>
              <div className="p-3 flex items-center justify-between">
                <span className="text-slate-600 flex items-center gap-1.5">
                  <Quote className="w-3.5 h-3.5 text-rose-500" /> 文献引用频次 (\cite)
                </span>
                <span className="font-mono font-bold text-slate-800">{stats.citationsCount} 次</span>
              </div>
              <div className="p-3 flex items-center justify-between">
                <span className="text-slate-600 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-slate-400" /> 段落数 / 源码行数
                </span>
                <span className="font-mono font-bold text-slate-800">{stats.paragraphs} 段 / {stats.lines} 行</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-400">
            满足各类学术期刊（IEEE, ACM, Elsevier, Springer）及学位论文的字数核验规范
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-semibold text-xs transition-colors"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
