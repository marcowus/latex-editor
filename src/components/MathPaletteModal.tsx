import React, { useState, useMemo } from 'react';
import { Sigma, Search, X, Check, Copy, Sparkles, BookOpen, Layers } from 'lucide-react';

interface MathPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertSnippet: (snippet: string, cursorOffset?: number) => void;
}

interface SymbolItem {
  label: string;
  code: string;
  name: string;
  category: string;
  offset?: number;
}

export const MathPaletteModal: React.FC<MathPaletteModalProps> = ({
  isOpen,
  onClose,
  onInsertSnippet,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('all');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const categories = [
    { id: 'all', label: '全部符号' },
    { id: 'calculus', label: '微积分与求和' },
    { id: 'greek', label: '希腊字母' },
    { id: 'relation', label: '关系与逻辑符' },
    { id: 'arrows', label: '箭头与集合' },
    { id: 'matrices', label: '矩阵与定界符' },
    { id: 'accents', label: '重音与上标' },
  ];

  const symbols: SymbolItem[] = [
    // Calculus & Sums
    { label: '∫', code: '\\int_{a}^{b} f(x) \\, dx', name: '定积分 integral', category: 'calculus' },
    { label: '∬', code: '\\iint_{D} f(x, y) \\, dA', name: '二重积分 double integral', category: 'calculus' },
    { label: '∮', code: '\\oint_{C} \\mathbf{F} \\cdot d\\mathbf{r}', name: '闭路环路积分 contour integral', category: 'calculus' },
    { label: '∑', code: '\\sum_{i=1}^{n} a_i', name: '求和 sum', category: 'calculus' },
    { label: '∏', code: '\\prod_{i=1}^{n} x_i', name: '累乘 product', category: 'calculus' },
    { label: 'lim', code: '\\lim_{x \\to \\infty} f(x)', name: '极限 limit', category: 'calculus' },
    { label: '∂f/∂x', code: '\\frac{\\partial f}{\\partial x}', name: '偏导数 partial derivative', category: 'calculus' },
    { label: 'd/dx', code: '\\frac{d}{dx}', name: '导数 derivative', category: 'calculus' },
    { label: '∇', code: '\\nabla', name: '梯度算子 nabla gradient', category: 'calculus' },
    { label: 'Δ', code: '\\Delta', name: '拉普拉斯/增量 laplacian delta', category: 'calculus' },
    { label: '∞', code: '\\infty', name: '无穷大 infinity', category: 'calculus' },

    // Greek
    { label: 'α', code: '\\alpha', name: 'alpha 阿尔法', category: 'greek' },
    { label: 'β', code: '\\beta', name: 'beta 贝塔', category: 'greek' },
    { label: 'γ', code: '\\gamma', name: 'gamma 伽马', category: 'greek' },
    { label: 'δ', code: '\\delta', name: 'delta 德尔塔', category: 'greek' },
    { label: 'ε', code: '\\epsilon', name: 'epsilon 艾普西隆', category: 'greek' },
    { label: 'θ', code: '\\theta', name: 'theta 西塔', category: 'greek' },
    { label: 'λ', code: '\\lambda', name: 'lambda 兰姆达', category: 'greek' },
    { label: 'μ', code: '\\mu', name: 'mu 缪', category: 'greek' },
    { label: 'π', code: '\\pi', name: 'pi 圆周率 派', category: 'greek' },
    { label: 'ρ', code: '\\rho', name: 'rho 肉', category: 'greek' },
    { label: 'σ', code: '\\sigma', name: 'sigma 西格玛', category: 'greek' },
    { label: 'τ', code: '\\tau', name: 'tau 套', category: 'greek' },
    { label: 'φ', code: '\\phi', name: 'phi 斐', category: 'greek' },
    { label: 'ψ', code: '\\psi', name: 'psi 普西', category: 'greek' },
    { label: 'ω', code: '\\omega', name: 'omega 欧米伽', category: 'greek' },
    { label: 'Γ', code: '\\Gamma', name: 'Gamma 大写伽马', category: 'greek' },
    { label: 'Θ', code: '\\Theta', name: 'Theta 大写西塔', category: 'greek' },
    { label: 'Λ', code: '\\Lambda', name: 'Lambda 大写兰姆达', category: 'greek' },
    { label: 'Σ', code: '\\Sigma', name: 'Sigma 大写西格玛', category: 'greek' },
    { label: 'Φ', code: '\\Phi', name: 'Phi 大写斐', category: 'greek' },
    { label: 'Ψ', code: '\\Psi', name: 'Psi 大写普西', category: 'greek' },
    { label: 'Ω', code: '\\Omega', name: 'Omega 大写欧米伽', category: 'greek' },

    // Relations & Logic
    { label: '≤', code: '\\le', name: '小于等于 leq', category: 'relation' },
    { label: '≥', code: '\\ge', name: '大于等于 geq', category: 'relation' },
    { label: '≠', code: '\\ne', name: '不等于 neq', category: 'relation' },
    { label: '≈', code: '\\approx', name: '约等于 approx', category: 'relation' },
    { label: '≡', code: '\\equiv', name: '恒等于 equiv', category: 'relation' },
    { label: '∝', code: '\\propto', name: '正比于 propto', category: 'relation' },
    { label: '±', code: '\\pm', name: '正负号 pm plus-minus', category: 'relation' },
    { label: '×', code: '\\times', name: '乘号 times', category: 'relation' },
    { label: '÷', code: '\\div', name: '除号 div', category: 'relation' },
    { label: '·', code: '\\cdot', name: '点乘 cdot', category: 'relation' },
    { label: '∀', code: '\\forall', name: '任意 forall', category: 'relation' },
    { label: '∃', code: '\\exists', name: '存在 exists', category: 'relation' },
    { label: '∴', code: '\\therefore', name: '所以 therefore', category: 'relation' },
    { label: '∵', code: '\\because', name: '因为 because', category: 'relation' },

    // Arrows & Sets
    { label: '→', code: '\\to', name: '右箭头 to rightarrow', category: 'arrows' },
    { label: '←', code: '\\leftarrow', name: '左箭头 leftarrow', category: 'arrows' },
    { label: '⇒', code: '\\Rightarrow', name: '蕴含 推出 implies', category: 'arrows' },
    { label: '⇔', code: '\\iff', name: '当且仅当 等价 iff', category: 'arrows' },
    { label: '↦', code: '\\mapsto', name: '映射 mapsto', category: 'arrows' },
    { label: '∈', code: '\\in', name: '属于 in', category: 'arrows' },
    { label: '∉', code: '\\notin', name: '不属于 notin', category: 'arrows' },
    { label: '⊂', code: '\\subset', name: '真子集 subset', category: 'arrows' },
    { label: '⊆', code: '\\subseteq', name: '子集 subseteq', category: 'arrows' },
    { label: '∪', code: '\\cup', name: '并集 cup union', category: 'arrows' },
    { label: '∩', code: '\\cap', name: '交集 cap intersection', category: 'arrows' },
    { label: '∅', code: '\\emptyset', name: '空集 empty set', category: 'arrows' },
    { label: 'ℝ', code: '\\mathbb{R}', name: '实数集 real numbers', category: 'arrows' },
    { label: 'ℂ', code: '\\mathbb{C}', name: '复数集 complex numbers', category: 'arrows' },
    { label: 'ℕ', code: '\\mathbb{N}', name: '自然数集 natural numbers', category: 'arrows' },

    // Matrices & Delimiters
    {
      label: '[M 2x2]',
      code: `\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}`,
      name: '2x2 方括号矩阵 bmatrix',
      category: 'matrices',
    },
    {
      label: '(M 2x2)',
      code: `\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}`,
      name: '2x2 圆括号矩阵 pmatrix',
      category: 'matrices',
    },
    {
      label: '|det|',
      code: `\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}`,
      name: '行列式 vmatrix determinant',
      category: 'matrices',
    },
    {
      label: '{cases}',
      code: `\\begin{cases} x, & \\text{if } x \\ge 0 \\\\ -x, & \\text{if } x < 0 \\end{cases}`,
      name: '分段函数 cases',
      category: 'matrices',
    },
    { label: '() 自适应', code: '\\left( x \\right)', name: '自适应圆括号 left right', category: 'matrices' },
    { label: '[] 自适应', code: '\\left[ x \\right]', name: '自适应方括号 left right', category: 'matrices' },
    { label: '{} 自适应', code: '\\left\\{ x \\right\\}', name: '自适应花括号 left right', category: 'matrices' },
    { label: '⟨⟩ 内积', code: '\\langle x, y \\rangle', name: '狄拉克内积 angle bracket', category: 'matrices' },
    { label: '‖·‖ 范数', code: '\\| x \\|', name: '范数 norm', category: 'matrices' },

    // Accents & Tops
    { label: 'x̂', code: '\\hat{x}', name: '尖顶 hat', category: 'accents' },
    { label: 'x̄', code: '\\bar{x}', name: '横杠 bar 平均值', category: 'accents' },
    { label: 'x̃', code: '\\tilde{x}', name: '波浪号 tilde', category: 'accents' },
    { label: 'x⃗', code: '\\vec{v}', name: '向量 vector', category: 'accents' },
    { label: 'ẋ', code: '\\dot{x}', name: '一阶导数 dot', category: 'accents' },
    { label: 'ẍ', code: '\\ddot{x}', name: '二阶导数 ddot', category: 'accents' },
    { label: 'x*', code: 'x^{*Ref}', name: '星号共轭 conjugate', category: 'accents' },
  ];

  const filteredSymbols = useMemo(() => {
    return symbols.filter(s => {
      const matchCat = selectedCat === 'all' || s.category === selectedCat;
      const matchSearch =
        !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.code.toLowerCase().includes(search.toLowerCase()) ||
        s.label.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [symbols, selectedCat, search]);

  const handleInsert = (s: SymbolItem) => {
    onInsertSnippet(s.code, s.offset);
    setCopiedCode(s.code);
    setTimeout(() => setCopiedCode(null), 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 text-slate-800">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[88vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-purple-600 rounded-md">
              <Sigma className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">数学符号与公式快捷盘 (Math Palette)</h3>
              <p className="text-[11px] text-slate-400">分类收录学术微积分、希腊字母、矩阵与逻辑算子，点击即插即用</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center gap-2 shrink-0">
          {/* Search box */}
          <div className="relative flex-1 w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="搜索符号名称、拼音或 LaTeX 宏（如 alpha, 积分, 矩阵, subset...）"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:ring-1 focus:ring-purple-500 outline-hidden"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto shrink-0 pb-1 sm:pb-0">
            {categories.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCat(cat.id)}
                className={`px-2 py-1 rounded text-xs whitespace-nowrap transition-colors ${
                  selectedCat === cat.id
                    ? 'bg-purple-600 text-white font-medium shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Symbol Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {copiedCode && (
            <div className="mb-3 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-800 text-xs flex items-center justify-between animate-fade-in">
              <span>已插入到编辑器光标处：<code className="font-mono font-bold text-emerald-900">{copiedCode}</code></span>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {filteredSymbols.map((item, idx) => (
              <div
                key={idx}
                onClick={() => handleInsert(item)}
                className="group p-2.5 bg-white border border-slate-200 hover:border-purple-400 hover:shadow-md rounded-lg cursor-pointer transition-all flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-base font-serif font-bold text-slate-900 group-hover:text-purple-700">
                    {item.label}
                  </span>
                  <span className="text-[10px] text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                    点击插入 ↵
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 font-sans truncate mb-1" title={item.name}>
                  {item.name}
                </div>
                <code className="text-[10px] font-mono text-slate-400 group-hover:text-slate-700 bg-slate-50 px-1 py-0.5 rounded truncate">
                  {item.code}
                </code>
              </div>
            ))}
          </div>

          {filteredSymbols.length === 0 && (
            <div className="py-12 text-center text-slate-400 text-xs">
              未找到匹配 “{search}” 的数学符号，请尝试搜索英文名或拼音
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>共收录 {symbols.length} 个学术高频数学符号与环境模板</span>
          <button
            onClick={onClose}
            className="px-3.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded font-medium transition-colors"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
