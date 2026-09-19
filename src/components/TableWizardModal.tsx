import React, { useState, useMemo } from 'react';
import { Table, X, Check, Copy, Sparkles, Sliders, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';

interface TableWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (code: string) => void;
}

export const TableWizardModal: React.FC<TableWizardModalProps> = ({ isOpen, onClose, onInsert }) => {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [style, setStyle] = useState<'booktabs' | 'grid' | 'simple'>('booktabs');
  const [caption, setCaption] = useState('实验评测对比数据表');
  const [label, setLabel] = useState('tab:benchmark');
  const [alignments, setAlignments] = useState<('l' | 'c' | 'r')[]>(['l', 'c', 'c']);
  const [data, setData] = useState<string[][]>([
    ['模型架构', '准确率 (%)', '推理耗时 (ms)'],
    ['ResNet-50', '76.8', '14.2'],
    ['Vision-Transformer', '81.4', '22.5'],
  ]);
  const [copied, setCopied] = useState(false);

  // Update matrix dimension when rows/cols change
  const handleRowsChange = (newRows: number) => {
    const r = Math.max(1, Math.min(newRows, 12));
    setRows(r);
    setData(prev => {
      const next = [...prev];
      while (next.length < r) {
        next.push(Array(cols).fill(''));
      }
      return next.slice(0, r);
    });
  };

  const handleColsChange = (newCols: number) => {
    const c = Math.max(1, Math.min(newCols, 8));
    setCols(c);
    setAlignments(prev => {
      const next = [...prev];
      while (next.length < c) next.push('c');
      return next.slice(0, c);
    });
    setData(prev => {
      return prev.map(row => {
        const nextRow = [...row];
        while (nextRow.length < c) nextRow.push('');
        return nextRow.slice(0, c);
      });
    });
  };

  const handleCellChange = (r: number, c: number, value: string) => {
    setData(prev => {
      const next = prev.map(row => [...row]);
      if (!next[r]) next[r] = [];
      next[r][c] = value;
      return next;
    });
  };

  const setColumnAlign = (c: number, align: 'l' | 'c' | 'r') => {
    setAlignments(prev => {
      const next = [...prev];
      next[c] = align;
      return next;
    });
  };

  // Generate LaTeX Code
  const generatedLatex = useMemo(() => {
    const colSpec = style === 'grid'
      ? `|${alignments.slice(0, cols).join('|')}|`
      : alignments.slice(0, cols).join('');

    let body = '';

    if (style === 'booktabs') {
      body += '  \\toprule\n';
      // Header row
      const headerCells = (data[0] || []).slice(0, cols).map(cell => cell.trim() || 'Header');
      body += `  ${headerCells.join(' & ')} \\\\\n`;
      body += '  \\midrule\n';
      // Body rows
      for (let r = 1; r < rows; r++) {
        const rowCells = (data[r] || []).slice(0, cols).map(cell => cell.trim() || '-');
        body += `  ${rowCells.join(' & ')} \\\\\n`;
      }
      body += '  \\bottomrule\n';
    } else if (style === 'grid') {
      body += '  \\hline\n';
      for (let r = 0; r < rows; r++) {
        const rowCells = (data[r] || []).slice(0, cols).map(cell => cell.trim() || '-');
        body += `  ${rowCells.join(' & ')} \\\\\n`;
        body += '  \\hline\n';
      }
    } else {
      body += '  \\hline\n';
      const headerCells = (data[0] || []).slice(0, cols).map(cell => cell.trim() || 'Header');
      body += `  ${headerCells.join(' & ')} \\\\\n`;
      body += '  \\hline\n';
      for (let r = 1; r < rows; r++) {
        const rowCells = (data[r] || []).slice(0, cols).map(cell => cell.trim() || '-');
        body += `  ${rowCells.join(' & ')} \\\\\n`;
      }
      body += '  \\hline\n';
    }

    return `\\begin{table}[htbp]
\\centering
\\caption{${caption}}
\\label{${label}}
\\begin{tabular}{${colSpec}}
${body}\\end{tabular}
\\end{table}`;
  }, [rows, cols, style, caption, label, alignments, data]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 text-slate-800">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-600 rounded-md">
              <Table className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">可视化表格生成向导 (Table Wizard)</h3>
              <p className="text-[11px] text-slate-400">交互式配置行列与样式，一键插入标准学术表格代码</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Controls Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">行数 (Rows)</label>
              <input
                type="number"
                min={1}
                max={12}
                value={rows}
                onChange={e => handleRowsChange(parseInt(e.target.value) || 1)}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">列数 (Columns)</label>
              <input
                type="number"
                min={1}
                max={8}
                value={cols}
                onChange={e => handleColsChange(parseInt(e.target.value) || 1)}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">表格风格 (Style)</label>
              <select
                value={style}
                onChange={e => setStyle(e.target.value as any)}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 focus:ring-1 focus:ring-indigo-500 text-xs"
              >
                <option value="booktabs">经典三线表 (Booktabs)</option>
                <option value="grid">全网格边框 (Grid)</option>
                <option value="simple">简约横线 (Simple)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">交叉标签 (Label)</label>
              <input
                type="text"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="tab:name"
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 focus:ring-1 focus:ring-indigo-500 font-mono text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">表格标题 (Caption)</label>
            <input
              type="text"
              value={caption}
              onChange={e => setCaption(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-slate-800 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Table Cell Editor Grid */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-slate-700">表格单元格数据编辑：</span>
              <span className="text-[11px] text-slate-400">第一行为表头，支持直接输入文字或 LaTeX 符号</span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg p-2 bg-slate-50/60 max-h-56">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="w-8 p-1 text-[10px] text-slate-400"></th>
                    {Array.from({ length: cols }).map((_, c) => (
                      <th key={c} className="p-1">
                        <div className="flex items-center justify-center gap-1 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[10px]">
                          <span>列 {c + 1}</span>
                          <div className="flex items-center ml-1 gap-0.5 text-slate-400">
                            <button
                              type="button"
                              onClick={() => setColumnAlign(c, 'l')}
                              className={`p-0.5 rounded ${alignments[c] === 'l' ? 'text-indigo-600 font-bold bg-indigo-50' : 'hover:text-slate-700'}`}
                              title="居左对齐"
                            >
                              <AlignLeft className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setColumnAlign(c, 'c')}
                              className={`p-0.5 rounded ${alignments[c] === 'c' ? 'text-indigo-600 font-bold bg-indigo-50' : 'hover:text-slate-700'}`}
                              title="居中对齐"
                            >
                              <AlignCenter className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setColumnAlign(c, 'r')}
                              className={`p-0.5 rounded ${alignments[c] === 'r' ? 'text-indigo-600 font-bold bg-indigo-50' : 'hover:text-slate-700'}`}
                              title="居右对齐"
                            >
                              <AlignRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: rows }).map((_, r) => (
                    <tr key={r}>
                      <td className="p-1 text-center font-mono text-[10px] text-slate-400 select-none">
                        {r === 0 ? '表头' : r}
                      </td>
                      {Array.from({ length: cols }).map((_, c) => (
                        <td key={c} className="p-1">
                          <input
                            type="text"
                            value={data[r]?.[c] || ''}
                            onChange={e => handleCellChange(r, c, e.target.value)}
                            placeholder={r === 0 ? `列标题 ${c + 1}` : '-'}
                            className={`w-full px-2 py-1 bg-white border rounded text-xs focus:ring-1 focus:ring-indigo-500 font-sans ${
                              r === 0 ? 'font-bold border-indigo-200 bg-indigo-50/20' : 'border-slate-300'
                            }`}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Generated Code Preview */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-slate-700">实时生成的 LaTeX 代码预览：</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(generatedLatex);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? '已复制' : '复制代码'}</span>
              </button>
            </div>
            <pre className="p-3 bg-slate-900 text-emerald-300 rounded-lg font-mono text-[11px] leading-relaxed overflow-x-auto max-h-36">
              {generatedLatex}
            </pre>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            将插入标准 LaTeX 环境，支持通过 \ref&#123;{label}&#125; 进行引用
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-slate-300 hover:bg-slate-100 rounded-md text-slate-700 font-medium text-xs transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => {
                onInsert(generatedLatex);
                onClose();
              }}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-semibold text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>插入到代码光标处</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
