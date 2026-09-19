export interface WordCountStats {
  totalWords: number;
  chineseChars: number;
  englishWords: number;
  totalCharsWithSpaces: number;
  totalCharsNoSpaces: number;
  paragraphs: number;
  lines: number;
  inlineMathCount: number;
  displayMathCount: number;
  figuresCount: number;
  tablesCount: number;
  citationsCount: number;
  estimatedReadingMinutes: number;
}

export function computeLatexWordCount(rawTex: string): WordCountStats {
  if (!rawTex || !rawTex.trim()) {
    return {
      totalWords: 0,
      chineseChars: 0,
      englishWords: 0,
      totalCharsWithSpaces: 0,
      totalCharsNoSpaces: 0,
      paragraphs: 0,
      lines: 0,
      inlineMathCount: 0,
      displayMathCount: 0,
      figuresCount: 0,
      tablesCount: 0,
      citationsCount: 0,
      estimatedReadingMinutes: 0,
    };
  }

  const lines = rawTex.split('\n');
  const lineCount = lines.length;

  // 1. Count math equations before stripping
  const displayMathMatches = rawTex.match(/\\begin\{(?:equation|align|gather|multline|bmatrix|pmatrix)\*?\}[\s\S]*?\\end\{(?:equation|align|gather|multline|bmatrix|pmatrix)\*?\}|\$\$[\s\S]*?\$\$/g) || [];
  const displayMathCount = displayMathMatches.length;

  const inlineMathMatches = rawTex.match(/(?<!\$)\$(?!\$)[\s\S]+?(?<!\$)\$(?!\$)/g) || [];
  const inlineMathCount = inlineMathMatches.length;

  // 2. Count figures, tables, citations
  const figureMatches = rawTex.match(/\\begin\{figure\}|\\includegraphics/g) || [];
  const figuresCount = figureMatches.length;

  const tableMatches = rawTex.match(/\\begin\{tabular\}|\\begin\{table\}/g) || [];
  const tablesCount = tableMatches.length;

  const citationMatches = rawTex.match(/\\cite\{[^}]+\}/g) || [];
  let citationsCount = 0;
  citationMatches.forEach(c => {
    const keys = c.replace(/\\cite\{|\}/g, '').split(',');
    citationsCount += keys.length;
  });

  // 3. Clean LaTeX source to extract pure prose
  let text = rawTex;

  // Remove preamble if \begin{document} exists
  const docStart = text.indexOf('\\begin{document}');
  if (docStart !== -1) {
    text = text.substring(docStart + '\\begin{document}'.length);
  }
  const docEnd = text.indexOf('\\end{document}');
  if (docEnd !== -1) {
    text = text.substring(0, docEnd);
  }

  // Remove comments (% ...)
  text = text.replace(/%.*$/gm, '');

  // Remove bibliography block
  text = text.replace(/\\begin\{thebibliography\}[\s\S]*?\\end\{thebibliography\}/g, '');

  // Remove display math environments
  text = text.replace(/\\begin\{(?:equation|align|gather|multline|bmatrix|pmatrix)\*?\}[\s\S]*?\\end\{(?:equation|align|gather|multline|bmatrix|pmatrix)\*?\}/g, ' ');
  text = text.replace(/\$\$[\s\S]*?\$\$/g, ' ');

  // Remove inline math
  text = text.replace(/(?<!\$)\$(?!\$)[\s\S]+?(?<!\$)\$(?!\$)/g, ' ');

  // Remove common commands with braces: \command{...} -> extract content for text formatting, drop for labels/cites
  text = text.replace(/\\(?:label|cite|ref|eqref|pageref|input|include|bibliography|bibliographystyle)\{[^}]*\}/g, ' ');
  text = text.replace(/\\(?:textbf|textit|text|emph|underline|texttt)\{([^}]*)\}/g, '$1');
  text = text.replace(/\\(?:section|subsection|subsubsection|caption|paragraph)\*?\{([^}]*)\}/g, '$1\n');

  // Strip remaining commands like \item, \centering, \hline, \\
  text = text.replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?/g, ' ');
  text = text.replace(/[{}]/g, ' ');
  text = text.replace(/\\\\/g, '\n');

  // 4. Count Chinese characters
  const chineseMatch = text.match(/[\u4e00-\u9fa5]/g) || [];
  const chineseChars = chineseMatch.length;

  // 5. Count English words
  const cleanEnglish = text.replace(/[\u4e00-\u9fa5]/g, ' ');
  const englishWordsMatch = cleanEnglish.match(/[a-zA-Z0-9]+(?:'[a-zA-Z0-9]+)?/g) || [];
  const englishWords = englishWordsMatch.length;

  const totalWords = chineseChars + englishWords;
  const totalCharsWithSpaces = text.length;
  const totalCharsNoSpaces = text.replace(/\s+/g, '').length;

  // Paragraphs count
  const paragraphs = text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0).length;

  // Estimated reading speed: 200 words per minute
  const estimatedReadingMinutes = Math.max(1, Math.round(totalWords / 200));

  return {
    totalWords,
    chineseChars,
    englishWords,
    totalCharsWithSpaces,
    totalCharsNoSpaces,
    paragraphs: Math.max(1, paragraphs),
    lines: lineCount,
    inlineMathCount,
    displayMathCount,
    figuresCount,
    tablesCount,
    citationsCount,
    estimatedReadingMinutes,
  };
}
