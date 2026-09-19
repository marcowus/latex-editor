/**
 * Fast, robust syntax highlighting for LaTeX code.
 * Transforms LaTeX string into styled HTML spans.
 */

export function highlightLatex(code: string): string {
  // Process line by line so comments and line numbers are cleanly isolated
  const lines = code.split('\n');

  return lines
    .map(line => {
      if (!line) return '&nbsp;';

      // 1. Separate code from comment
      // LaTeX comment begins at unescaped '%'
      let commentPart = '';
      let codePart = line;

      // Find unescaped %
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '%' && (i === 0 || line[i - 1] !== '\\')) {
          codePart = line.substring(0, i);
          commentPart = line.substring(i);
          break;
        }
      }

      // Escape code part for safety
      let highlighted = escapeHtml(codePart);

      // Math tokens: $$...$$ and $...$
      highlighted = highlighted.replace(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g, '<span class="text-amber-600 dark:text-amber-400 font-mono font-medium">$1</span>');

      // LaTeX commands: \command or \command*
      highlighted = highlighted.replace(/(\\([a-zA-Z*]+))/g, (match, fullCmd, cmdName) => {
        // Categorize command
        if (['begin', 'end'].includes(cmdName)) {
          return `<span class="text-indigo-600 dark:text-indigo-400 font-bold">${fullCmd}</span>`;
        }
        if (['section', 'subsection', 'subsubsection', 'chapter', 'paragraph'].includes(cmdName)) {
          return `<span class="text-blue-600 dark:text-blue-400 font-bold">${fullCmd}</span>`;
        }
        if (['documentclass', 'usepackage', 'input', 'include', 'bibliography', 'bibliographystyle'].includes(cmdName)) {
          return `<span class="text-purple-600 dark:text-purple-400 font-bold">${fullCmd}</span>`;
        }
        if (['title', 'author', 'date', 'maketitle', 'thanks'].includes(cmdName)) {
          return `<span class="text-emerald-600 dark:text-emerald-400 font-semibold">${fullCmd}</span>`;
        }
        if (['label', 'ref', 'cite', 'eqref', 'pageref'].includes(cmdName)) {
          return `<span class="text-cyan-600 dark:text-cyan-400 font-semibold">${fullCmd}</span>`;
        }
        if (['textbf', 'textit', 'underline', 'emph', 'texttt', 'textsc'].includes(cmdName)) {
          return `<span class="text-teal-600 dark:text-teal-400 font-medium">${fullCmd}</span>`;
        }
        return `<span class="text-indigo-500 dark:text-indigo-300 font-medium">${fullCmd}</span>`;
      });

      // Special symbols: \\, &, \[, \]
      highlighted = highlighted.replace(/(\\\\\*?|&amp;)/g, '<span class="text-rose-500 font-bold">$1</span>');

      // Environment names inside {}: \begin{equation} -> equation
      highlighted = highlighted.replace(/(\{)([a-zA-Z0-9*_\-.:]+)(\})/g, (match, open, inner, close) => {
        return `<span class="text-slate-400">${open}</span><span class="text-emerald-700 dark:text-emerald-300">${inner}</span><span class="text-slate-400">${close}</span>`;
      });

      // Optional arguments inside []: [12pt, a4paper]
      highlighted = highlighted.replace(/(\[)([^\]]+)(\])/g, (match, open, inner, close) => {
        return `<span class="text-slate-400">${open}</span><span class="text-amber-700 dark:text-amber-300 text-xs">${inner}</span><span class="text-slate-400">${close}</span>`;
      });

      // Add comment part
      if (commentPart) {
        highlighted += `<span class="text-slate-400 dark:text-slate-500 italic font-mono">${escapeHtml(commentPart)}</span>`;
      }

      return highlighted;
    })
    .join('\n');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
