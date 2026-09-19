import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  Replace,
  Undo2,
  Redo2,
  X,
  FileCode,
  Copy,
  Check,
  Navigation,
  Sparkles,
  BookOpen,
  Tag,
  Code2,
  ArrowRight,
  SendHorizontal
} from 'lucide-react';
import { highlightLatex } from '../utils/latexHighlighter';
import { MathToolbar } from './MathToolbar';
import { BibEntry, LabelEntry } from '../utils/bibParser';

interface CodeEditorProps {
  code: string;
  fileName: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  errorLines?: number[];
  onJumpToLineTarget?: number | null;
  bibEntries?: BibEntry[];
  labels?: LabelEntry[];
  onForwardSync?: (line: number) => void;
  onOpenTableWizard?: () => void;
  onOpenMathPalette?: () => void;
  onCursorInfoChange?: (info: { line: number; col: number; selection: string }) => void;
  insertSnippetRef?: React.MutableRefObject<((snippet: string, cursorOffset?: number) => void) | null>;
  onToggleLLM?: () => void;
}

interface CommandItem {
  prefix: string;
  label: string;
  snippet: string;
  desc: string;
  category: 'math' | 'structure' | 'format';
  offset?: number;
}

const LATEX_COMMANDS: CommandItem[] = [
  // Math commands
  { prefix: 'frac', label: '\\frac{a}{b}', snippet: '\\frac{a}{b}', desc: '分式 (Fraction)', category: 'math', offset: -4 },
  { prefix: 'sqrt', label: '\\sqrt{x}', snippet: '\\sqrt{x}', desc: '平方根 (Square Root)', category: 'math', offset: -1 },
  { prefix: 'sum', label: '\\sum_{i=1}^{n}', snippet: '\\sum_{i=1}^{n} ', desc: '求和符号 (Summation)', category: 'math', offset: 0 },
  { prefix: 'int', label: '\\int_{a}^{b}', snippet: '\\int_{a}^{b} f(x) \\, dx', desc: '定积分 (Definite Integral)', category: 'math', offset: 0 },
  { prefix: 'iint', label: '\\iint_{D}', snippet: '\\iint_{D} f(x,y) \\, dA', desc: '二重积分 (Double Integral)', category: 'math', offset: 0 },
  { prefix: 'lim', label: '\\lim_{x \\to 0}', snippet: '\\lim_{x \\to 0} ', desc: '极限 (Limit)', category: 'math', offset: 0 },
  { prefix: 'partial', label: '\\partial', snippet: '\\frac{\\partial f}{\\partial x}', desc: '偏导数 (Partial Derivative)', category: 'math', offset: 0 },
  { prefix: 'infty', label: '\\infty', snippet: '\\infty ', desc: '无穷大 (Infinity)', category: 'math', offset: 0 },
  { prefix: 'nabla', label: '\\nabla', snippet: '\\nabla ', desc: '梯度算子 (Nabla)', category: 'math', offset: 0 },
  { prefix: 'alpha', label: '\\alpha', snippet: '\\alpha ', desc: '希腊字母 alpha', category: 'math', offset: 0 },
  { prefix: 'beta', label: '\\beta', snippet: '\\beta ', desc: '希腊字母 beta', category: 'math', offset: 0 },
  { prefix: 'gamma', label: '\\gamma', snippet: '\\gamma ', desc: '希腊字母 gamma', category: 'math', offset: 0 },
  { prefix: 'lambda', label: '\\lambda', snippet: '\\lambda ', desc: '希腊字母 lambda', category: 'math', offset: 0 },
  { prefix: 'sigma', label: '\\sigma', snippet: '\\sigma ', desc: '希腊字母 sigma', category: 'math', offset: 0 },
  { prefix: 'omega', label: '\\omega', snippet: '\\omega ', desc: '希腊字母 omega', category: 'math', offset: 0 },
  { prefix: 'theta', label: '\\theta', snippet: '\\theta ', desc: '希腊字母 theta', category: 'math', offset: 0 },
  { prefix: 'le', label: '\\le', snippet: '\\le ', desc: '小于等于 ≤', category: 'math', offset: 0 },
  { prefix: 'ge', label: '\\ge', snippet: '\\ge ', desc: '大于等于 ≥', category: 'math', offset: 0 },
  { prefix: 'ne', label: '\\ne', snippet: '\\ne ', desc: '不等于 ≠', category: 'math', offset: 0 },
  { prefix: 'approx', label: '\\approx', snippet: '\\approx ', desc: '约等于 ≈', category: 'math', offset: 0 },
  { prefix: 'times', label: '\\times', snippet: '\\times ', desc: '乘号 ×', category: 'math', offset: 0 },
  { prefix: 'cdot', label: '\\cdot', snippet: '\\cdot ', desc: '点乘 ·', category: 'math', offset: 0 },
  { prefix: 'in', label: '\\in', snippet: '\\in ', desc: '属于 ∈', category: 'math', offset: 0 },
  { prefix: 'subset', label: '\\subset', snippet: '\\subset ', desc: '子集 ⊂', category: 'math', offset: 0 },
  { prefix: 'to', label: '\\to', snippet: '\\to ', desc: '右箭头 →', category: 'math', offset: 0 },
  { prefix: 'iff', label: '\\iff', snippet: '\\iff ', desc: '当且仅当 ⇔', category: 'math', offset: 0 },

  // Environments & Structure
  {
    prefix: 'begin',
    label: '\\begin{env}...\\end{env}',
    snippet: '\\begin{equation}\n  E = mc^2\n  \\label{eq:}\n\\end{equation}',
    desc: '独立编号公式环境',
    category: 'structure',
    offset: -17,
  },
  {
    prefix: 'align',
    label: '\\begin{align*}',
    snippet: '\\begin{align*}\n  f(x) &= a x + b \\\\\n       &= c\n\\end{align*}',
    desc: '多行对齐公式环境',
    category: 'structure',
    offset: 0,
  },
  {
    prefix: 'bmatrix',
    label: '\\begin{bmatrix}',
    snippet: '\\begin{bmatrix}\n  a & b \\\\\n  c & d\n\\end{bmatrix}',
    desc: '方括号矩阵',
    category: 'structure',
    offset: 0,
  },
  {
    prefix: 'pmatrix',
    label: '\\begin{pmatrix}',
    snippet: '\\begin{pmatrix}\n  1 & 0 \\\\\n  0 & 1\n\\end{pmatrix}',
    desc: '圆括号矩阵',
    category: 'structure',
    offset: 0,
  },
  {
    prefix: 'cases',
    label: '\\begin{cases}',
    snippet: '\\begin{cases}\n  x, & \\text{if } x > 0 \\\\\n  0, & \\text{otherwise}\n\\end{cases}',
    desc: '分段函数环境',
    category: 'structure',
    offset: 0,
  },
  {
    prefix: 'itemize',
    label: '\\begin{itemize}',
    snippet: '\\begin{itemize}\n  \\item 第一项\n  \\item 第二项\n\\end{itemize}',
    desc: '无序列表环境',
    category: 'structure',
    offset: 0,
  },
  {
    prefix: 'enumerate',
    label: '\\begin{enumerate}',
    snippet: '\\begin{enumerate}\n  \\item 步骤一\n  \\item 步骤二\n\\end{enumerate}',
    desc: '编号有序列表',
    category: 'structure',
    offset: 0,
  },
  {
    prefix: 'theorem',
    label: '\\begin{theorem}',
    snippet: '\\begin{theorem}[定理名称]\n\\label{thm:}\n核心论断叙述。\n\\end{theorem}',
    desc: '数学定理证明块',
    category: 'structure',
    offset: 0,
  },
  {
    prefix: 'proof',
    label: '\\begin{proof}',
    snippet: '\\begin{proof}\n根据定义推导直接得证。\n\\end{proof}',
    desc: '证明环境 (Q.E.D.)',
    category: 'structure',
    offset: 0,
  },

  // Document formatting & references
  { prefix: 'section', label: '\\section{title}', snippet: '\\section{章节名称}\n\\label{sec:}\n', desc: '一级章节标题', category: 'format', offset: -18 },
  { prefix: 'subsection', label: '\\subsection{title}', snippet: '\\subsection{子章节名称}\n', desc: '二级子章节', category: 'format', offset: -2 },
  { prefix: 'textbf', label: '\\textbf{加粗}', snippet: '\\textbf{文本}', desc: '加粗字体 (Bold)', category: 'format', offset: -1 },
  { prefix: 'textit', label: '\\textit{斜体}', snippet: '\\textit{文本}', desc: '斜体字体 (Italic)', category: 'format', offset: -1 },
  { prefix: 'texttt', label: '\\texttt{代码}', snippet: '\\texttt{code}', desc: '等宽字体 (Monospace)', category: 'format', offset: -1 },
  { prefix: 'underline', label: '\\underline{文本}', snippet: '\\underline{文本}', desc: '下划线', category: 'format', offset: -1 },
  { prefix: 'cite', label: '\\cite{key}', snippet: '\\cite{key}', desc: '参考文献引用', category: 'format', offset: -1 },
  { prefix: 'ref', label: '\\ref{key}', snippet: '\\ref{sec:intro}', desc: '交叉引用 (Reference)', category: 'format', offset: -1 },
  { prefix: 'eqref', label: '\\eqref{eq:key}', snippet: '\\eqref{eq:}', desc: '公式引用 (带圆括号)', category: 'format', offset: -1 },
  { prefix: 'label', label: '\\label{key}', snippet: '\\label{sec:}', desc: '锚点标签定义', category: 'format', offset: -1 },
  { prefix: 'footnote', label: '\\footnote{text}', snippet: '\\footnote{在此输入注释说明}', desc: '页面脚注', category: 'format', offset: -1 },
  { prefix: 'includegraphics', label: '\\includegraphics', snippet: '\\includegraphics[width=0.8\\linewidth]{figure.png}', desc: '插入插图文件', category: 'format', offset: -1 },
];

export const CodeEditor: React.FC<CodeEditorProps> = ({
  code,
  fileName,
  onChange,
  onSave,
  errorLines = [],
  onJumpToLineTarget = null,
  bibEntries = [],
  labels = [],
  onForwardSync,
  onOpenTableWizard,
  onOpenMathPalette,
  onCursorInfoChange,
  insertSnippetRef,
  onToggleLLM,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // Expose insert snippet function via ref
  useEffect(() => {
    if (insertSnippetRef) {
      insertSnippetRef.current = (snippet: string, cursorOffset = 0) => {
        handleInsertSnippet(snippet, cursorOffset);
      };
    }
  });

  // History state for undo/redo
  const [history, setHistory] = useState<string[]>([code]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Cursor & selection info
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [selectionLength, setSelectionLength] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  // Search & Replace
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [matchCount, setMatchCount] = useState(0);
  const [copied, setCopied] = useState(false);

  // Reverse / Forward SyncTeX animation states
  const [flashLine, setFlashLine] = useState<number | null>(null);
  const [flashBadge, setFlashBadge] = useState<string | null>(null);

  // Autocomplete state
  const [acType, setAcType] = useState<'command' | 'cite' | 'ref' | null>(null);
  const [acQuery, setAcQuery] = useState('');
  const [acIndex, setAcIndex] = useState(0);
  const [acRange, setAcRange] = useState<{ start: number; end: number }>({ start: 0, end: 0 });

  // Handle jump to line (Reverse SyncTeX from PreviewPane)
  useEffect(() => {
    if (onJumpToLineTarget && textareaRef.current) {
      const lines = code.split('\n');
      let charIndex = 0;
      for (let i = 0; i < Math.min(onJumpToLineTarget - 1, lines.length); i++) {
        charIndex += lines[i].length + 1;
      }
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(charIndex, charIndex + (lines[onJumpToLineTarget - 1]?.length || 0));

      const lineHeight = 21;
      const targetScroll = Math.max(0, (onJumpToLineTarget - 6) * lineHeight);
      textareaRef.current.scrollTop = targetScroll;
      if (lineNumbersRef.current) {
        lineNumbersRef.current.scrollTop = targetScroll;
      }
      if (highlightRef.current) {
        highlightRef.current.scrollTop = targetScroll;
      }
      setScrollTop(targetScroll);
      updateCursorInfo();

      setFlashLine(onJumpToLineTarget);
      setFlashBadge(`反向定位：第 ${onJumpToLineTarget} 行`);
      const timer = setTimeout(() => {
        setFlashLine(null);
        setFlashBadge(null);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [onJumpToLineTarget, code]);

  // Scroll sync
  const handleScroll = () => {
    if (!textareaRef.current) return;
    const top = textareaRef.current.scrollTop;
    const left = textareaRef.current.scrollLeft;
    setScrollTop(top);

    if (highlightRef.current) {
      highlightRef.current.scrollTop = top;
      highlightRef.current.scrollLeft = left;
    }
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = top;
    }
  };

  // Check cursor position and detect autocomplete triggers
  const updateCursorInfo = useCallback(() => {
    if (!textareaRef.current) return;
    const selStart = textareaRef.current.selectionStart;
    const selEnd = textareaRef.current.selectionEnd;
    setSelectionLength(selEnd - selStart);

    const textBefore = code.substring(0, selStart);
    const lines = textBefore.split('\n');
    const currentLine = lines.length;
    const currentCol = lines[lines.length - 1].length + 1;
    setCursorPos({ line: currentLine, col: currentCol });

    if (onCursorInfoChange) {
      const selected = code.substring(selStart, selEnd);
      onCursorInfoChange({ line: currentLine, col: currentCol, selection: selected });
    }

    // Only inspect for autocomplete when cursor is a single point
    if (selStart !== selEnd) {
      setAcType(null);
      return;
    }

    const currentLineText = lines[lines.length - 1];

    // 1. Detect \cite{...
    const citeMatch = currentLineText.match(/\\cite(?:\[[^\]]*\])?\{([^}]*)$/);
    if (citeMatch) {
      const query = citeMatch[1];
      const matchStart = selStart - query.length;
      setAcType('cite');
      setAcQuery(query);
      setAcRange({ start: matchStart, end: selStart });
      setAcIndex(0);
      return;
    }

    // 2. Detect \ref{... or \eqref{...
    const refMatch = currentLineText.match(/\\(?:ref|eqref|pageref)\{([^}]*)$/);
    if (refMatch) {
      const query = refMatch[1];
      const matchStart = selStart - query.length;
      setAcType('ref');
      setAcQuery(query);
      setAcRange({ start: matchStart, end: selStart });
      setAcIndex(0);
      return;
    }

    // 3. Detect \command (backslash + letters)
    const cmdMatch = currentLineText.match(/\\([a-zA-Z*]{1,15})$/);
    if (cmdMatch) {
      const query = cmdMatch[1];
      const matchStart = selStart - query.length - 1; // include backslash
      setAcType('command');
      setAcQuery(query.toLowerCase());
      setAcRange({ start: matchStart, end: selStart });
      setAcIndex(0);
      return;
    }

    // Otherwise close autocomplete
    setAcType(null);
  }, [code]);

  // Push new code to history
  const pushHistory = (newCode: string) => {
    onChange(newCode);
    const updated = history.slice(0, historyIndex + 1);
    updated.push(newCode);
    if (updated.length > 50) updated.shift();
    setHistory(updated);
    setHistoryIndex(updated.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      onChange(prev);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      onChange(next);
    }
  };

  // Insert snippet from toolbar or palette
  const handleInsertSnippet = (snippet: string, cursorOffset = 0) => {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;

    const newCode = code.substring(0, start) + snippet + code.substring(end);
    pushHistory(newCode);

    setTimeout(() => {
      el.focus();
      const newPos = start + snippet.length + cursorOffset;
      el.setSelectionRange(newPos, newPos);
      updateCursorInfo();
    }, 10);
  };

  // Autocomplete Candidates List
  const acCandidates = useMemo(() => {
    if (!acType) return [];

    if (acType === 'command') {
      return LATEX_COMMANDS.filter(cmd =>
        cmd.prefix.toLowerCase().startsWith(acQuery) ||
        cmd.label.toLowerCase().includes(acQuery) ||
        cmd.desc.toLowerCase().includes(acQuery)
      ).slice(0, 8);
    }

    if (acType === 'cite') {
      const q = acQuery.toLowerCase();
      return bibEntries
        .filter(b =>
          !q ||
          b.key.toLowerCase().includes(q) ||
          (b.title && b.title.toLowerCase().includes(q)) ||
          (b.author && b.author.toLowerCase().includes(q))
        )
        .slice(0, 8);
    }

    if (acType === 'ref') {
      const q = acQuery.toLowerCase();
      return labels
        .filter(l => !q || l.key.toLowerCase().includes(q) || (l.description && l.description.toLowerCase().includes(q)))
        .slice(0, 8);
    }

    return [];
  }, [acType, acQuery, bibEntries, labels]);

  // Insert selected autocomplete candidate
  const applyAutocomplete = (item: any) => {
    if (!textareaRef.current || !acType) return;
    const el = textareaRef.current;

    let insertion = '';
    let offset = 0;

    if (acType === 'command') {
      const cmd = item as CommandItem;
      insertion = cmd.snippet;
      offset = cmd.offset || 0;
    } else if (acType === 'cite') {
      const bib = item as BibEntry;
      insertion = `${bib.key}}`;
      offset = 0;
    } else if (acType === 'ref') {
      const lbl = item as LabelEntry;
      insertion = `${lbl.key}}`;
      offset = 0;
    }

    const newCode = code.substring(0, acRange.start) + insertion + code.substring(acRange.end);
    pushHistory(newCode);
    setAcType(null);

    setTimeout(() => {
      el.focus();
      const targetPos = acRange.start + insertion.length + offset;
      el.setSelectionRange(targetPos, targetPos);
      updateCursorInfo();
    }, 10);
  };

  // Forward SyncTeX trigger
  const handleTriggerForwardSync = (targetLine?: number) => {
    const line = targetLine || cursorPos.line;
    setFlashBadge(`正向定位至预览：第 ${line} 行`);
    onForwardSync?.(line);
    setTimeout(() => setFlashBadge(null), 2200);
  };

  // Keyboard shortcut & auto-closing logic
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const mod = isMac ? e.metaKey : e.ctrlKey;
    const el = textareaRef.current;
    if (!el) return;

    // 1. Handle autocomplete navigation when active
    if (acType && acCandidates.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAcIndex((acIndex + 1) % acCandidates.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAcIndex((acIndex - 1 + acCandidates.length) % acCandidates.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        applyAutocomplete(acCandidates[acIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setAcType(null);
        return;
      }
    }

    // Ctrl + S -> Save & Compile
    if (mod && e.key === 's') {
      e.preventDefault();
      onSave?.();
      return;
    }

    // Ctrl + F -> Search
    if (mod && e.key === 'f') {
      e.preventDefault();
      setShowSearch(true);
      return;
    }

    // Ctrl + Z -> Undo
    if (mod && !e.shiftKey && e.key === 'z') {
      e.preventDefault();
      handleUndo();
      return;
    }

    // Ctrl + Y / Ctrl+Shift+Z -> Redo
    if ((mod && e.key === 'y') || (mod && e.shiftKey && e.key === 'z')) {
      e.preventDefault();
      handleRedo();
      return;
    }

    // Ctrl + B -> Bold
    if (mod && e.key === 'b') {
      e.preventDefault();
      wrapSelection('\\textbf{', '}');
      return;
    }

    // Ctrl + I -> Italic
    if (mod && e.key === 'i') {
      e.preventDefault();
      wrapSelection('\\textit{', '}');
      return;
    }

    // Tab -> 2 spaces indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = el.selectionStart;
      const end = el.selectionEnd;

      if (e.shiftKey) {
        // Outdent
        const before = code.substring(0, start);
        const lineStart = before.lastIndexOf('\n') + 1;
        if (code.startsWith('  ', lineStart)) {
          const newCode = code.substring(0, lineStart) + code.substring(lineStart + 2);
          pushHistory(newCode);
          setTimeout(() => el.setSelectionRange(Math.max(lineStart, start - 2), Math.max(lineStart, end - 2)), 0);
        }
      } else {
        // Indent
        const newCode = code.substring(0, start) + '  ' + code.substring(end);
        pushHistory(newCode);
        setTimeout(() => {
          el.setSelectionRange(start + 2, start + 2);
          updateCursorInfo();
        }, 0);
      }
      return;
    }

    // Enter key: Check environment auto-closing
    if (e.key === 'Enter') {
      const start = el.selectionStart;
      const lineBefore = code.substring(0, start);
      const curLine = lineBefore.split('\n').pop() || '';

      // If line ends with \begin{env} without \end{env}
      const beginMatch = curLine.match(/\\begin\{([a-zA-Z*]+)\}\s*$/);
      if (beginMatch) {
        const envName = beginMatch[1];
        // Check indentation of current line
        const indentMatch = curLine.match(/^(\s*)/);
        const currentIndent = indentMatch ? indentMatch[1] : '';
        const innerIndent = currentIndent + '  ';

        e.preventDefault();
        const insertion = `\n${innerIndent}\n${currentIndent}\\end{${envName}}`;
        const newCode = code.substring(0, start) + insertion + code.substring(start);
        pushHistory(newCode);
        setTimeout(() => {
          const newPos = start + innerIndent.length + 1;
          el.setSelectionRange(newPos, newPos);
          updateCursorInfo();
        }, 0);
        return;
      }
    }

    // Backspace: Delete matching empty pair if cursor is right between them
    if (e.key === 'Backspace' && el.selectionStart === el.selectionEnd) {
      const start = el.selectionStart;
      if (start > 0 && start < code.length) {
        const charBefore = code[start - 1];
        const charAfter = code[start];
        if (
          (charBefore === '{' && charAfter === '}') ||
          (charBefore === '[' && charAfter === ']') ||
          (charBefore === '(' && charAfter === ')') ||
          (charBefore === '$' && charAfter === '$')
        ) {
          e.preventDefault();
          const newCode = code.substring(0, start - 1) + code.substring(start + 1);
          pushHistory(newCode);
          setTimeout(() => {
            el.setSelectionRange(start - 1, start - 1);
            updateCursorInfo();
          }, 0);
          return;
        }
      }
    }

    // Overtyping closing brackets
    const closingChars = ['}', ']', ')', '$'];
    if (closingChars.includes(e.key) && el.selectionStart === el.selectionEnd) {
      const start = el.selectionStart;
      if (code[start] === e.key) {
        e.preventDefault();
        el.setSelectionRange(start + 1, start + 1);
        updateCursorInfo();
        return;
      }
    }

    // Auto-closing brackets & selection wrapping
    const pairs: Record<string, string> = {
      '{': '}',
      '[': ']',
      '(': ')',
      '$': '$',
    };

    if (pairs[e.key]) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const closeChar = pairs[e.key];

      // If text is selected, wrap text
      if (start !== end) {
        e.preventDefault();
        const selected = code.substring(start, end);
        const newCode = code.substring(0, start) + e.key + selected + closeChar + code.substring(end);
        pushHistory(newCode);
        setTimeout(() => {
          el.setSelectionRange(start + 1, end + 1);
          updateCursorInfo();
        }, 0);
        return;
      }

      // If no selection, insert pair and place cursor between
      e.preventDefault();
      const newCode = code.substring(0, start) + e.key + closeChar + code.substring(start);
      pushHistory(newCode);
      setTimeout(() => {
        el.setSelectionRange(start + 1, start + 1);
        updateCursorInfo();
      }, 0);
      return;
    }
  };

  // Wrap selected text helper
  const wrapSelection = (before: string, after: string) => {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = code.substring(start, end);
    const newCode = code.substring(0, start) + before + selected + after + code.substring(end);
    pushHistory(newCode);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, end + before.length);
      updateCursorInfo();
    }, 10);
  };

  // Search matches
  useEffect(() => {
    if (!searchText) {
      setMatchCount(0);
      return;
    }
    const escaped = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = code.match(new RegExp(escaped, 'g'));
    setMatchCount(matches ? matches.length : 0);
  }, [searchText, code]);

  const handleReplaceAll = () => {
    if (!searchText) return;
    const newCode = code.replaceAll(searchText, replaceText);
    pushHistory(newCode);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = code.split('\n');
  const totalLines = lines.length;

  return (
    <div className="flex-1 flex flex-col h-full bg-white relative overflow-hidden">
      {/* Top File Tab & Controls */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs select-none">
        <div className="flex items-center gap-2 font-mono text-slate-700">
          <FileCode className="w-4 h-4 text-blue-600" />
          <span className="font-semibold">{fileName}</span>
          <span className="text-[11px] text-slate-400 font-sans">• {totalLines} 行</span>
        </div>

        <div className="flex items-center gap-1.5">
          {onToggleLLM && (
            <button
              type="button"
              onClick={onToggleLLM}
              title="唤出大语言模型 LaTeX 助手 (直接写代码 / 操作文件)"
              className="px-2 py-1 bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 text-indigo-700 border border-indigo-200/80 rounded text-xs font-medium flex items-center gap-1 transition-colors shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">AI 助手</span>
            </button>
          )}

          {/* Forward Sync Button */}
          <button
            type="button"
            onClick={() => handleTriggerForwardSync()}
            title="正向定位：将当前代码行平滑滚动并高亮至右侧预览窗口 (Forward SyncTeX)"
            className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-xs font-medium flex items-center gap-1 transition-colors"
          >
            <SendHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">正向定位预览</span>
          </button>

          <div className="h-3 w-px bg-slate-300 mx-0.5" />

          <button
            title="撤销 (Ctrl+Z)"
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-40 rounded hover:bg-slate-200/60"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            title="重做 (Ctrl+Y)"
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-40 rounded hover:bg-slate-200/60"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
          <div className="h-3 w-px bg-slate-300 mx-0.5" />
          <button
            title="查找与替换 (Ctrl+F)"
            onClick={() => setShowSearch(!showSearch)}
            className={`p-1 rounded transition-colors ${
              showSearch ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
          </button>
          <button
            title="复制代码"
            onClick={handleCopyCode}
            className="p-1 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-200/60"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Quick Math Symbols Toolbar */}
      <MathToolbar
        onInsertSnippet={handleInsertSnippet}
        onOpenTableWizard={onOpenTableWizard}
        onOpenMathPalette={onOpenMathPalette}
      />

      {/* Search & Replace Floating Bar */}
      {showSearch && (
        <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center gap-2 text-xs select-none">
          <div className="flex items-center gap-1.5 bg-white px-2 py-1 border border-slate-300 rounded">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="查找内容..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              className="outline-hidden text-xs w-36 text-slate-800"
              autoFocus
            />
            {matchCount > 0 && <span className="text-[10px] text-slate-500">{matchCount} 处匹配</span>}
          </div>

          <div className="flex items-center gap-1.5 bg-white px-2 py-1 border border-slate-300 rounded">
            <Replace className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="替换为..."
              value={replaceText}
              onChange={e => setReplaceText(e.target.value)}
              className="outline-hidden text-xs w-36 text-slate-800"
            />
          </div>

          <button
            type="button"
            onClick={handleReplaceAll}
            disabled={!searchText || matchCount === 0}
            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded font-medium text-xs transition-colors"
          >
            全部替换
          </button>

          <button
            type="button"
            onClick={() => setShowSearch(false)}
            className="p-1 text-slate-400 hover:text-slate-600 rounded ml-auto"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Dual Layer Editor */}
      <div className="relative flex-1 flex overflow-hidden font-mono text-[13px] leading-[21px]">
        {/* Floating SyncTeX navigation toast badge */}
        {flashBadge && (
          <div className="absolute top-2 right-4 z-30 bg-slate-900/90 text-white text-xs px-3 py-1.5 rounded shadow-lg flex items-center gap-1.5 border border-slate-700 animate-bounce pointer-events-none">
            <Navigation className="w-3.5 h-3.5 text-amber-300" />
            <span className="font-sans font-medium">{flashBadge}</span>
          </div>
        )}

        {/* Autocomplete Popup Menu */}
        {acType && acCandidates.length > 0 && (
          <div
            style={{
              top: `${Math.min(Math.max(28, (cursorPos.line - 1) * 21 + 28 - scrollTop), 380)}px`,
              left: `${Math.min(Math.max(64, (cursorPos.col - 1) * 7.8 + 30), 400)}px`,
            }}
            className="absolute z-40 bg-white rounded-lg shadow-xl border border-slate-300 w-72 max-h-60 overflow-y-auto flex flex-col divide-y divide-slate-100 text-xs animate-in fade-in zoom-in-95 duration-100"
          >
            <div className="px-2.5 py-1 bg-slate-50 text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between select-none">
              <span>
                {acType === 'command' ? 'LaTeX 宏命令联想' : acType === 'cite' ? '参考文献 BibTeX 联想' : '交叉引用标签联想'}
              </span>
              <span className="font-normal font-sans text-slate-400">↑↓ 选择, ↵/Tab 补全</span>
            </div>

            <div className="divide-y divide-slate-50">
              {acCandidates.map((item, idx) => {
                const isSelected = idx === acIndex;
                if (acType === 'command') {
                  const cmd = item as CommandItem;
                  return (
                    <div
                      key={idx}
                      onClick={() => applyAutocomplete(cmd)}
                      className={`px-2.5 py-1.5 flex items-center justify-between cursor-pointer transition-colors ${
                        isSelected ? 'bg-indigo-50 text-indigo-900 font-semibold' : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Code2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span className="font-mono text-xs">{cmd.label}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-sans truncate max-w-[100px]">{cmd.desc}</span>
                    </div>
                  );
                }

                if (acType === 'cite') {
                  const bib = item as BibEntry;
                  return (
                    <div
                      key={idx}
                      onClick={() => applyAutocomplete(bib)}
                      className={`px-2.5 py-1.5 cursor-pointer transition-colors ${
                        isSelected ? 'bg-indigo-50 text-indigo-900' : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-indigo-600 flex items-center gap-1">
                          <BookOpen className="w-3 h-3 text-indigo-500" />
                          {bib.key}
                        </span>
                        {bib.year && <span className="text-[10px] text-slate-400 font-mono">{bib.year}</span>}
                      </div>
                      {bib.title && (
                        <div className="text-[11px] text-slate-600 truncate mt-0.5">{bib.title}</div>
                      )}
                      {bib.author && (
                        <div className="text-[10px] text-slate-400 truncate">{bib.author}</div>
                      )}
                    </div>
                  );
                }

                if (acType === 'ref') {
                  const lbl = item as LabelEntry;
                  return (
                    <div
                      key={idx}
                      onClick={() => applyAutocomplete(lbl)}
                      className={`px-2.5 py-1.5 flex items-center justify-between cursor-pointer transition-colors ${
                        isSelected ? 'bg-indigo-50 text-indigo-900' : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Tag className="w-3 h-3 text-purple-500 shrink-0" />
                        <span className="font-mono font-bold text-xs text-purple-700">{lbl.key}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-sans truncate max-w-[120px]">
                        {lbl.description || lbl.fileName || lbl.type}
                      </span>
                    </div>
                  );
                }

                return null;
              })}
            </div>
          </div>
        )}

        {/* Line Numbers Bar */}
        <div
          ref={lineNumbersRef}
          className="w-12 shrink-0 bg-slate-50 border-r border-slate-200 text-slate-400 text-right pr-2 py-3 select-none overflow-hidden"
        >
          {Array.from({ length: totalLines }).map((_, idx) => {
            const lineNum = idx + 1;
            const isCurrentLine = cursorPos.line === lineNum;
            const isErrorLine = errorLines.includes(lineNum);
            const isFlashLine = flashLine === lineNum;
            return (
              <div
                key={idx}
                onClick={() => handleTriggerForwardSync(lineNum)}
                title="双击或点击此行号正向同步定位至预览"
                className={`h-[21px] flex items-center justify-end cursor-pointer transition-colors ${
                  isFlashLine
                    ? 'text-amber-950 font-bold bg-amber-300 shadow-xs'
                    : isErrorLine
                    ? 'text-red-600 font-bold bg-red-100/60'
                    : isCurrentLine
                    ? 'text-indigo-600 font-semibold bg-indigo-50/50'
                    : 'hover:text-indigo-600'
                }`}
              >
                {lineNum}
              </div>
            );
          })}
        </div>

        {/* Editor Main Canvas */}
        <div className="relative flex-1 h-full overflow-hidden">
          {/* Active Flash Line Highlight Band */}
          {flashLine && (
            <div
              style={{
                top: `${(flashLine - 1) * 21 + 12 - scrollTop}px`,
                height: '21px',
              }}
              className="absolute left-0 right-0 line-flash-highlight pointer-events-none z-5"
            />
          )}

          {/* Syntax Highlighted Mirror Layer (behind) */}
          <pre
            ref={highlightRef}
            aria-hidden="true"
            className="absolute inset-0 p-3 pointer-events-none overflow-hidden whitespace-pre font-mono text-[13px] leading-[21px] text-slate-800 m-0 z-0 select-none"
            dangerouslySetInnerHTML={{ __html: highlightLatex(code) }}
          />

          {/* Transparent Input Textarea (in front) */}
          <textarea
            ref={textareaRef}
            value={code}
            onChange={e => pushHistory(e.target.value)}
            onScroll={handleScroll}
            onClick={updateCursorInfo}
            onKeyUp={updateCursorInfo}
            onKeyDown={handleKeyDown}
            onDoubleClick={() => handleTriggerForwardSync()}
            spellCheck="false"
            autoCapitalize="off"
            autoComplete="off"
            className="absolute inset-0 p-3 w-full h-full resize-none outline-hidden bg-transparent text-transparent caret-indigo-600 font-mono text-[13px] leading-[21px] whitespace-pre overflow-auto z-10 selection:bg-indigo-200 selection:text-transparent"
          />
        </div>
      </div>

      {/* Status Bar */}
      <div className="px-3 py-1 bg-slate-100 border-t border-slate-200 text-[11px] text-slate-600 flex items-center justify-between select-none">
        <div className="flex items-center gap-3">
          <span>
            第 {cursorPos.line} 行, 第 {cursorPos.col} 列
          </span>
          {selectionLength > 0 && <span className="text-indigo-600 font-medium">已选择 {selectionLength} 字符</span>}
          <span className="text-slate-400 hidden sm:inline">
            (双击代码行或点击「正向定位」同步至右侧预览)
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span>{code.length} 字符</span>
          <span>UTF-8</span>
          <span className="text-indigo-600 font-medium">LaTeX / KaTeX</span>
        </div>
      </div>
    </div>
  );
};
