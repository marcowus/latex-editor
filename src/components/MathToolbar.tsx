import React, { useState } from 'react';
import {
  Sigma,
  Pi,
  Binary,
  ListOrdered,
  Table as TableIcon,
  Quote,
  Type,
  Maximize2,
  ChevronDown,
  Sparkles,
  LayoutGrid
} from 'lucide-react';

interface MathToolbarProps {
  onInsertSnippet: (snippet: string, cursorOffset?: number) => void;
  onOpenTableWizard?: () => void;
  onOpenMathPalette?: () => void;
}

export const MathToolbar: React.FC<MathToolbarProps> = ({
  onInsertSnippet,
  onOpenTableWizard,
  onOpenMathPalette,
}) => {
  const [activeTab, setActiveTab] = useState<'greek' | 'math' | 'structure' | 'format'>('math');
  const [isExpanded, setIsExpanded] = useState(false);

  // Greek symbols
  const greekLetters = [
    { label: 'α', code: '\\alpha ' },
    { label: 'β', code: '\\beta ' },
    { label: 'γ', code: '\\gamma ' },
    { label: 'δ', code: '\\delta ' },
    { label: 'ε', code: '\\epsilon ' },
    { label: 'θ', code: '\\theta ' },
    { label: 'λ', code: '\\lambda ' },
    { label: 'μ', code: '\\mu ' },
    { label: 'π', code: '\\pi ' },
    { label: 'ρ', code: '\\rho ' },
    { label: 'σ', code: '\\sigma ' },
    { label: 'τ', code: '\\tau ' },
    { label: 'φ', code: '\\phi ' },
    { label: 'ψ', code: '\\psi ' },
    { label: 'ω', code: '\\omega ' },
    { label: 'Δ', code: '\\Delta ' },
    { label: 'Γ', code: '\\Gamma ' },
    { label: 'Θ', code: '\\Theta ' },
    { label: 'Λ', code: '\\Lambda ' },
    { label: 'Σ', code: '\\Sigma ' },
    { label: 'Φ', code: '\\Phi ' },
    { label: 'Ω', code: '\\Omega ' },
  ];

  // Common math formulas
  const mathSymbols = [
    { label: 'a/b', tip: '分数', code: '\\frac{a}{b}', offset: -4 },
    { label: '√x', tip: '平方根', code: '\\sqrt{x}', offset: -1 },
    { label: 'xⁿ', tip: '上标/幂', code: '^{2}', offset: -1 },
    { label: 'xᵢ', tip: '下标', code: '_{i}', offset: -1 },
    { label: '∫', tip: '积分', code: '\\int_{a}^{b} f(x) \\, dx' },
    { label: '∑', tip: '求和', code: '\\sum_{i=1}^{n} ' },
    { label: '∏', tip: '累乘', code: '\\prod_{i=1}^{n} ' },
    { label: 'lim', tip: '极限', code: '\\lim_{x \\to 0} ' },
    { label: '∂', tip: '偏导', code: '\\frac{\\partial f}{\\partial x}' },
    { label: '∇', tip: '梯度算子', code: '\\nabla ' },
    { label: '∞', tip: '无穷大', code: '\\infty ' },
    { label: '≤', tip: '小于等于', code: '\\le ' },
    { label: '≥', tip: '大于等于', code: '\\ge ' },
    { label: '≠', tip: '不等于', code: '\\ne ' },
    { label: '≈', tip: '约等于', code: '\\approx ' },
    { label: '∈', tip: '属于', code: '\\in ' },
    { label: '∉', tip: '不属于', code: '\\notin ' },
    { label: '⊂', tip: '子集', code: '\\subset ' },
    { label: '±', tip: '正负号', code: '\\pm ' },
    { label: '×', tip: '乘号', code: '\\times ' },
    { label: '·', tip: '点乘', code: '\\cdot ' },
    { label: '→', tip: '右箭头', code: '\\to ' },
    { label: '⇒', tip: '推出', code: '\\Rightarrow ' },
    { label: '⇔', tip: '等价', code: '\\iff ' },
  ];

  // Structures & Environments
  const structures = [
    {
      label: '独立方程',
      tip: 'Numbered Equation',
      code: `\\begin{equation}
  E = mc^2
  \\label{eq:energy}
\\end{equation}`,
    },
    {
      label: '多行对齐',
      tip: 'Align Environment',
      code: `\\begin{align*}
  f(x) &= (x + 1)^2 \\\\
       &= x^2 + 2x + 1
\\end{align*}`,
    },
    {
      label: '圆括号矩阵',
      tip: 'pmatrix',
      code: `\\begin{pmatrix}
  a & b \\\\
  c & d
\\end{pmatrix}`,
    },
    {
      label: '方括号矩阵',
      tip: 'bmatrix',
      code: `\\begin{bmatrix}
  1 & 0 \\\\
  0 & 1
\\end{bmatrix}`,
    },
    {
      label: '分段函数',
      tip: 'cases',
      code: `\\begin{cases}
  x, & \\text{if } x > 0 \\\\
  0, & \\text{otherwise}
\\end{cases}`,
    },
    {
      label: '无序列表',
      tip: 'itemize',
      code: `\\begin{itemize}
  \\item 第一项
  \\item 第二项
\\end{itemize}`,
    },
    {
      label: '有序编号',
      tip: 'enumerate',
      code: `\\begin{enumerate}
  \\item 步骤一
  \\item 步骤二
\\end{enumerate}`,
    },
    {
      label: '三线表',
      tip: 'table',
      code: `\\begin{table}[htbp]
\\centering
\\caption{实验数据记录表}
\\label{tbl:sample}
\\begin{tabular}{ccc}
\\hline
指标 A & 指标 B & 结果 \\\\
\\hline
10.5 & 2.4 & 95.2 \\\\
12.0 & 3.1 & 98.6 \\\\
\\hline
\\end{tabular}
\\end{table}`,
    },
    {
      label: '定理块',
      tip: 'theorem',
      code: `\\begin{theorem}[核心定理]
设任意实数空间 $V$，则满足线性叠加原理。
\\end{theorem}`,
    },
    {
      label: '证明过程',
      tip: 'proof',
      code: `\\begin{proof}
根据定义推导，直接计算得证。
\\end{proof}`,
    },
  ];

  // Text formatting
  const formatting = [
    { label: '粗体', tip: 'Bold', code: '\\textbf{文本}', offset: -1 },
    { label: '斜体', tip: 'Italic', code: '\\textit{文本}', offset: -1 },
    { label: '下划线', tip: 'Underline', code: '\\underline{文本}', offset: -1 },
    { label: '等宽代码', tip: 'Monospace', code: '\\texttt{code}', offset: -1 },
    { label: '一级章节', tip: 'Section', code: '\\section{章节名称}\n\\label{sec:}\n' },
    { label: '二级子节', tip: 'Subsection', code: '\\subsection{子章节名称}\n' },
    { label: '引用文献', tip: 'Cite', code: '\\cite{key}', offset: -1 },
    { label: '交叉引用', tip: 'Ref', code: '\\ref{sec:intro}', offset: -1 },
    { label: '标签定义', tip: 'Label', code: '\\label{key}', offset: -1 },
    { label: '脚注', tip: 'Footnote', code: '\\footnote{在此输入注释说明}', offset: -1 },
  ];

  return (
    <div className="border-b border-slate-200 bg-white/95 backdrop-blur-xs select-none">
      {/* Quick Access Bar */}
      <div className="px-3 py-1.5 flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('math')}
            className={`px-2 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1 ${
              activeTab === 'math' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Sigma className="w-3.5 h-3.5 text-indigo-600" />
            <span>数学符号</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('greek')}
            className={`px-2 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1 ${
              activeTab === 'greek' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Pi className="w-3.5 h-3.5 text-purple-600" />
            <span>希腊字母</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('structure')}
            className={`px-2 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1 ${
              activeTab === 'structure' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Binary className="w-3.5 h-3.5 text-emerald-600" />
            <span>环境与结构</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('format')}
            className={`px-2 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1 ${
              activeTab === 'format' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Type className="w-3.5 h-3.5 text-blue-600" />
            <span>格式与章节</span>
          </button>

          <div className="h-3.5 w-px bg-slate-200 mx-0.5 hidden sm:block" />

          {onOpenTableWizard && (
            <button
              type="button"
              onClick={onOpenTableWizard}
              className="px-2 py-1 text-xs font-medium rounded text-indigo-700 hover:bg-indigo-50 transition-colors flex items-center gap-1"
              title="可视化表格生成向导"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden md:inline">表格向导</span>
            </button>
          )}

          {onOpenMathPalette && (
            <button
              type="button"
              onClick={onOpenMathPalette}
              className="px-2 py-1 text-xs font-medium rounded text-purple-700 hover:bg-purple-50 transition-colors flex items-center gap-1"
              title="打开完整数学符号盘"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span className="hidden md:inline">符号大盘</span>
            </button>
          )}
        </div>

        {/* Quick inline math wrap buttons */}
        <div className="flex items-center gap-1 shrink-0 text-xs">
          <button
            type="button"
            title="插入行内公式 $...$"
            onClick={() => onInsertSnippet('$x$', -1)}
            className="px-2 py-1 bg-slate-100 hover:bg-indigo-100 text-slate-700 font-mono rounded hover:text-indigo-700 transition-colors"
          >
            $ x $
          </button>
          <button
            type="button"
            title="插入独立公式 $$...$$"
            onClick={() => onInsertSnippet('$$\n  \\int_{a}^{b} f(x) dx\n$$\n', -4)}
            className="px-2 py-1 bg-slate-100 hover:bg-indigo-100 text-slate-700 font-mono rounded hover:text-indigo-700 transition-colors"
          >
            $$
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-slate-400 hover:text-slate-700 rounded"
            title={isExpanded ? '收起工具栏' : '展开更多符号'}
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Symbol Pill List */}
      <div className={`px-3 py-1.5 bg-slate-50/70 border-t border-slate-100 overflow-x-auto ${isExpanded ? 'max-h-36 overflow-y-auto' : ''}`}>
        {activeTab === 'math' && (
          <div className="flex flex-wrap gap-1 items-center">
            {mathSymbols.map((item, idx) => (
              <button
                key={idx}
                type="button"
                title={item.tip}
                onClick={() => onInsertSnippet(item.code, item.offset)}
                className="px-2 py-0.5 min-w-[26px] text-center text-xs font-mono bg-white hover:bg-indigo-600 hover:text-white text-slate-700 border border-slate-200 rounded shadow-2xs transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'greek' && (
          <div className="flex flex-wrap gap-1 items-center">
            {greekLetters.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onInsertSnippet(`$${item.code}$ `)}
                title={item.code}
                className="px-2 py-0.5 min-w-[26px] text-center text-xs font-serif bg-white hover:bg-indigo-600 hover:text-white text-slate-700 border border-slate-200 rounded shadow-2xs transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'structure' && (
          <div className="flex flex-wrap gap-1.5 items-center">
            {structures.map((item, idx) => (
              <button
                key={idx}
                type="button"
                title={item.tip}
                onClick={() => onInsertSnippet(`\n${item.code}\n`)}
                className="px-2 py-0.5 text-xs bg-white hover:bg-indigo-600 hover:text-white text-slate-700 border border-slate-200 rounded shadow-2xs transition-colors flex items-center gap-1"
              >
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        )}

        {activeTab === 'format' && (
          <div className="flex flex-wrap gap-1.5 items-center">
            {formatting.map((item, idx) => (
              <button
                key={idx}
                type="button"
                title={item.tip}
                onClick={() => onInsertSnippet(item.code, item.offset)}
                className="px-2 py-0.5 text-xs bg-white hover:bg-indigo-600 hover:text-white text-slate-700 border border-slate-200 rounded shadow-2xs transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
