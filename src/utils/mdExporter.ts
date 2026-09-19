import { WorkspaceState, FileItem } from '../types/latex';
import JSZip from 'jszip';

export interface MdExportOptions {
  scope?: 'project' | 'active'; // 'project' merges \input, 'active' exports active file
  mathFlavor?: 'standard' | 'numbered'; // standard MathJax ($$...$$) or numbered (\begin{equation})
  frontmatter?: 'title' | 'yaml' | 'none'; // 'title' (H1 + authors), 'yaml' (YAML front matter), 'none'
  embedImages?: boolean; // embed svg / data uri if available
  includeBib?: boolean; // include bibliography at end
  files?: Record<string, FileItem>;
  activeFileId?: string;
}

export interface MdExportResult {
  markdown: string;
  title: string;
  stats: {
    wordCount: number;
    equationCount: number;
    tableCount: number;
    figureCount: number;
    sectionCount: number;
  };
}

/**
 * Strips LaTeX comments safely without removing escaped \%
 */
function stripLatexComments(str: string): string {
  const lines = str.split('\n');
  const result: string[] = [];
  for (const line of lines) {
    let commentIdx = -1;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '%') {
        let bsCount = 0;
        let j = i - 1;
        while (j >= 0 && line[j] === '\\') {
          bsCount++;
          j--;
        }
        if (bsCount % 2 === 0) {
          commentIdx = i;
          break;
        }
      }
    }
    if (commentIdx !== -1) {
      result.push(line.substring(0, commentIdx));
    } else {
      result.push(line);
    }
  }
  return result.join('\n');
}

/**
 * Recursively resolves \input{...} and \include{...} statements from workspace files
 */
function resolveWorkspaceInputs(
  source: string,
  files?: Record<string, FileItem>,
  visited = new Set<string>()
): string {
  if (!files) return source;

  return source.replace(/\\(?:input|include)\{([^}]+)\}/g, (match, rawPath) => {
    let target = rawPath.trim();
    if (!target.endsWith('.tex')) target += '.tex';

    // Normalize path variations
    const cleanTarget = target.replace(/^\//, '');
    const filenameOnly = cleanTarget.split('/').pop() || cleanTarget;

    // Prevent circular imports
    if (visited.has(cleanTarget)) {
      return `\n<!-- Circular input omitted: ${cleanTarget} -->\n`;
    }

    let foundFile: FileItem | undefined;
    for (const [key, file] of Object.entries(files)) {
      const filePath = file.path ? file.path.replace(/^\//, '') : key.replace(/^\//, '');
      const fileName = file.name || key.split('/').pop() || key;
      if (
        filePath === cleanTarget ||
        fileName === filenameOnly ||
        filePath.endsWith(`/${cleanTarget}`) ||
        key === cleanTarget ||
        key === target
      ) {
        foundFile = file;
        break;
      }
    }

    if (foundFile && foundFile.content) {
      const nextVisited = new Set(visited);
      nextVisited.add(cleanTarget);
      const inner = resolveWorkspaceInputs(foundFile.content, files, nextVisited);
      return `\n\n<!-- Begin: ${target} -->\n${inner}\n<!-- End: ${target} -->\n\n`;
    }

    return match;
  });
}

/**
 * Clean inline LaTeX formatting into Markdown
 */
function cleanInlineLatex(text: string): string {
  let s = text;

  // Protect code blocks, math blocks, inline code, and markdown table lines
  const protectedPlaceholders: string[] = [];
  s = s.replace(/(```[\s\S]*?```|\$\$[\s\S]*?\$\$|\$[^$\n]+\$|`[^`\n]+`|^\|.*\|$)/gm, (m) => {
    protectedPlaceholders.push(m);
    return `@@PROTECTED_${protectedPlaceholders.length - 1}@@`;
  });

  // Basic styles
  s = s.replace(/\\textbf\{([^{}]+(?:\{[^{}]*\}[^{}]*)*)\}/g, '**$1**');
  s = s.replace(/\\textit\{([^{}]+(?:\{[^{}]*\}[^{}]*)*)\}/g, '*$1*');
  s = s.replace(/\\emph\{([^{}]+(?:\{[^{}]*\}[^{}]*)*)\}/g, '*$1*');
  s = s.replace(/\\underline\{([^{}]+(?:\{[^{}]*\}[^{}]*)*)\}/g, '<u>$1</u>');
  s = s.replace(/\\sout\{([^{}]+(?:\{[^{}]*\}[^{}]*)*)\}/g, '~~$1~~');
  s = s.replace(/\\texttt\{([^{}]+(?:\{[^{}]*\}[^{}]*)*)\}/g, '`$1`');
  s = s.replace(/\\verb([|/+])([^|/+]+)\1/g, '`$2`');

  // Links
  s = s.replace(/\\href\{([^}]+)\}\{([^}]+)\}/g, '[$2]($1)');
  s = s.replace(/\\url\{([^}]+)\}/g, '<$1>');

  // Common typography & escapes
  s = s.replace(/\\%/g, '%');
  s = s.replace(/\\&/g, '&');
  s = s.replace(/\\_/g, '_');
  s = s.replace(/\\#/g, '#');
  s = s.replace(/\\\$/g, '$');
  s = s.replace(/``|''/g, '"');
  s = s.replace(/~/g, ' ');

  // Smart em-dash and en-dash (only between words, never replacing table lines or YAML/HR)
  s = s.replace(/(?<=[a-zA-Z0-9\u4e00-\u9fa5])---(?=[a-zA-Z0-9\u4e00-\u9fa5])/g, '—');
  s = s.replace(/(?<=[a-zA-Z0-9\u4e00-\u9fa5])--(?=[a-zA-Z0-9\u4e00-\u9fa5])/g, '–');

  // Restore protected blocks
  s = s.replace(/@@PROTECTED_(\d+)@@/g, (_, idx) => protectedPlaceholders[parseInt(idx, 10)]);

  return s;
}

/**
 * Convert a LaTeX tabular environment into a GFM Markdown table
 */
function convertTabularToMarkdown(
  colSpec: string,
  tabularBody: string,
  captionText?: string,
  labelTag?: string
): string {
  // Parse column alignments (e.g. "l|c|r" or "p{3cm}cc")
  const cleanCols = colSpec.replace(/[^lcr|]/g, '');
  const alignments: string[] = [];
  for (const ch of cleanCols) {
    if (ch === 'l') alignments.push(':---');
    else if (ch === 'c') alignments.push(':---:');
    else if (ch === 'r') alignments.push('---:');
  }

  // Strip LaTeX row dividers & booktabs lines
  let body = tabularBody
    .replace(/\\(?:toprule|midrule|bottomrule|hline|cline\{[^}]*\})/g, '')
    .replace(/\\(?:centering|raggedright|raggedleft)/g, '')
    .trim();

  // Split rows by \\ (handling optional bracket spacing like \\[1ex])
  const rawRows = body.split(/\\\\(?:\s*\[[^\]]*\])?/);
  const tableRows: string[][] = [];

  for (const rawRow of rawRows) {
    const trimmed = rawRow.trim();
    if (!trimmed) continue;

    // Split cells by & (ignoring \&)
    const cells: string[] = [];
    let curCell = '';
    for (let i = 0; i < trimmed.length; i++) {
      if (trimmed[i] === '&' && (i === 0 || trimmed[i - 1] !== '\\')) {
        cells.push(curCell.trim());
        curCell = '';
      } else {
        curCell += trimmed[i];
      }
    }
    cells.push(curCell.trim());

    // Clean cell text
    const processedCells = cells.map(cell => {
      let c = cell;
      // Handle \multicolumn{n}{c}{text}
      c = c.replace(/\\multicolumn\{\d+\}\{[^}]*\}\{([^}]+)\}/g, '$1');
      c = cleanInlineLatex(c);
      c = c.replace(/\n+/g, ' ').replace(/\|/g, '\\|');
      return c.trim() || ' ';
    });

    if (processedCells.length > 0 && processedCells.some(c => c !== ' ')) {
      tableRows.push(processedCells);
    }
  }

  if (tableRows.length === 0) return '';

  const maxColCount = Math.max(
    alignments.length,
    ...tableRows.map(r => r.length)
  );

  // Fill in alignment delimiters if spec was smaller
  while (alignments.length < maxColCount) {
    alignments.push(':---');
  }

  // Normalize all rows to maxColCount
  const normalizedRows = tableRows.map(row => {
    const filled = [...row];
    while (filled.length < maxColCount) {
      filled.push(' ');
    }
    return filled;
  });

  const headerRow = normalizedRows[0];
  const bodyRows = normalizedRows.slice(1);

  const lines: string[] = [];

  // Table Caption before table
  if (captionText) {
    lines.push(`**${captionText.trim()}**\n`);
  }

  // Header row
  lines.push(`| ${headerRow.join(' | ')} |`);
  // Separator row
  lines.push(`| ${alignments.slice(0, maxColCount).join(' | ')} |`);
  // Data rows
  for (const row of bodyRows) {
    lines.push(`| ${row.join(' | ')} |`);
  }

  if (labelTag) {
    lines.push(`\n<a id="${labelTag}"></a>`);
  }

  return lines.join('\n');
}

/**
 * Main export function: transforms LaTeX document to clean Markdown
 */
export function exportLatexToMarkdown(
  source: string,
  options: MdExportOptions = {}
): MdExportResult {
  const scope = options.scope || 'project';
  const mathFlavor = options.mathFlavor || 'standard';
  const frontmatter = options.frontmatter || 'title';
  const embedImages = options.embedImages ?? false;
  const includeBib = options.includeBib ?? true;
  const files = options.files;

  // 1. Resolve inputs if project scope
  let resolvedSource = source;
  if (scope === 'project' && files) {
    resolvedSource = resolveWorkspaceInputs(source, files);
  }

  // 2. Safe comment stripping
  resolvedSource = stripLatexComments(resolvedSource);

  // 3. Extract Document Metadata
  const titleMatch = resolvedSource.match(/\\title(?:\[[^\]]*\])?\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/);
  const rawTitle = titleMatch ? titleMatch[1].trim() : '';
  const cleanTitle = cleanInlineLatex(rawTitle).replace(/\\\\/g, ' ').trim() || '学术研究文档';

  const authorMatch = resolvedSource.match(/\\author\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/);
  const rawAuthors = authorMatch ? authorMatch[1].trim() : '';
  const authorsList = rawAuthors
    ? rawAuthors
        .split(/\\and|\\\\|\band\b/)
        .map(a => cleanInlineLatex(a.replace(/\\thanks\{[^}]*\}/g, '').replace(/\\inst\{[^}]*\}/g, '').trim()))
        .filter(Boolean)
    : [];

  const dateMatch = resolvedSource.match(/\\date\{([^}]*)\}/);
  let docDate = dateMatch ? dateMatch[1].trim() : '';
  if (docDate.includes('\\today') || !docDate) {
    const d = new Date();
    docDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  } else {
    docDate = cleanInlineLatex(docDate);
  }

  // Abstract
  const abstractMatch = resolvedSource.match(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/);
  const rawAbstract = abstractMatch ? abstractMatch[1].trim() : '';
  const cleanAbstract = rawAbstract ? cleanInlineLatex(rawAbstract) : '';

  // Keywords
  const kwMatch = resolvedSource.match(/\\(?:keywords|IEEEkeywords)\{([^}]+)\}/);
  const cleanKeywords = kwMatch ? cleanInlineLatex(kwMatch[1].trim()) : '';

  // 4. Extract Document Body
  let body = resolvedSource;
  const docEnvMatch = resolvedSource.match(/\\begin\{document\}([\s\S]*?)(\\end\{document\}|$)/);
  if (docEnvMatch) {
    body = docEnvMatch[1];
  } else {
    body = resolvedSource
      .replace(/\\documentclass(\[[^\]]*\])?\{[^}]*\}/g, '')
      .replace(/\\usepackage(\[[^\]]*\])?\{[^}]*\}/g, '')
      .replace(/\\title\{[^}]*\}/g, '')
      .replace(/\\author\{[^}]*\}/g, '')
      .replace(/\\date\{[^}]*\}/g, '');
  }

  // Remove abstract from body if already extracted
  body = body.replace(/\\begin\{abstract\}[\s\S]*?\\end\{abstract\}/g, '');

  // Strip layout commands & preamble remnants
  body = body.replace(/\\maketitle/g, '');
  body = body.replace(/\\tableofcontents/g, '');
  body = body.replace(/\\bibliographystyle\{[^}]*\}/g, '');
  body = body.replace(/\\bibliography\{[^}]*\}/g, '');
  body = body.replace(/\\nocite\{[^}]*\}/g, '');
  body = body.replace(/\\pagestyle\{[^}]*\}/g, '');
  body = body.replace(/\\thispagestyle\{[^}]*\}/g, '');
  body = body.replace(/\\geometry\{[^}]*\}/g, '');
  body = body.replace(/\\hypersetup\{[^}]*\}/g, '');
  body = body.replace(/\\noindent\s*/g, '');
  body = body.replace(/\\indent\s*/g, '');
  body = body.replace(/\\centering/g, '');
  body = body.replace(/\\raggedright/g, '');
  body = body.replace(/\\raggedleft/g, '');
  body = body.replace(/\\clearpage|\\newpage|\\pagebreak/g, '\n\n---\n\n');

  // pdfLaTeX CTeX compatibility: unwrap \begin{CJK*}{UTF8}{gbsn} ... \end{CJK*}
  body = body.replace(/\\begin\{CJK\*?\}\{[^}]*\}\{[^}]*\}/g, '');
  body = body.replace(/\\end\{CJK\*?\}/g, '');

  // 5. Pre-scan Labels and Citations
  const labels: Record<string, { type: string; number: string; title?: string }> = {};
  const bibItems: Record<string, { number: number; text: string }> = {};

  // Equation counter & scanning
  let eqCount = 0;
  const eqRegex = /\\begin\{equation\*?\}([\s\S]*?)\\end\{equation\*?\}/g;
  let em: RegExpExecArray | null;
  while ((em = eqRegex.exec(body)) !== null) {
    eqCount++;
    const eqInner = em[1];
    const tagMatch = eqInner.match(/\\tag\{([^}]+)\}/);
    const eqNum = tagMatch ? tagMatch[1] : `${eqCount}`;
    const lblMatch = eqInner.match(/\\label\{([^}]+)\}/);
    if (lblMatch) {
      labels[lblMatch[1].trim()] = { type: 'equation', number: eqNum };
    }
  }

  // Section numbering & scanning
  let s1 = 0, s2 = 0, s3 = 0, chapCount = 0;
  const hRegex = /\\(chapter|section|subsection|subsubsection)(\*?)\{([^}]+)\}/g;
  let hm: RegExpExecArray | null;
  while ((hm = hRegex.exec(body)) !== null) {
    const type = hm[1];
    const isStarred = hm[2] === '*';
    const title = hm[3].trim();
    let num = '';

    if (!isStarred) {
      if (type === 'chapter') {
        chapCount++; s1 = 0; s2 = 0; s3 = 0;
        num = `第 ${chapCount} 章`;
      } else if (type === 'section') {
        s1++; s2 = 0; s3 = 0;
        num = `${s1}`;
      } else if (type === 'subsection') {
        s2++; s3 = 0;
        num = `${s1}.${s2}`;
      } else {
        s3++;
        num = `${s1}.${s2}.${s3}`;
      }
    }

    const following = body.substring(hm.index, hm.index + hm[0].length + 80);
    const lblMatch = following.match(/\\label\{([^}]+)\}/);
    if (lblMatch) {
      labels[lblMatch[1].trim()] = { type, number: num, title };
    }
  }

  // Table scanning
  let tableCount = 0;
  const tblRegex = /\\begin\{table\*?\}(?:\[[^\]]*\])?([\s\S]*?)\\end\{table\*?\}/g;
  let tm: RegExpExecArray | null;
  while ((tm = tblRegex.exec(body)) !== null) {
    tableCount++;
    const capMatch = tm[1].match(/\\caption\{([^}]+)\}/);
    const lblMatch = tm[1].match(/\\label\{([^}]+)\}/);
    if (lblMatch) {
      labels[lblMatch[1].trim()] = {
        type: 'table',
        number: `${tableCount}`,
        title: capMatch ? capMatch[1] : undefined,
      };
    }
  }

  // Figure scanning
  let figureCount = 0;
  const figRegex = /\\begin\{figure\*?\}(?:\[[^\]]*\])?([\s\S]*?)\\end\{figure\*?\}/g;
  let fm: RegExpExecArray | null;
  while ((fm = figRegex.exec(body)) !== null) {
    figureCount++;
    const capMatch = fm[1].match(/\\caption\{([^}]+)\}/);
    const lblMatch = fm[1].match(/\\label\{([^}]+)\}/);
    if (lblMatch) {
      labels[lblMatch[1].trim()] = {
        type: 'figure',
        number: `${figureCount}`,
        title: capMatch ? capMatch[1] : undefined,
      };
    }
  }

  // Scan bibliography from body
  let bCount = 0;
  const bibItemRegex = /\\bibitem(?:\[[^\]]*\])?\{([^}]+)\}([\s\S]*?)(?=(\\bibitem|\s*\\end\{thebibliography\}|$))/g;
  let bm: RegExpExecArray | null;
  while ((bm = bibItemRegex.exec(body)) !== null) {
    bCount++;
    bibItems[bm[1].trim()] = {
      number: bCount,
      text: cleanInlineLatex(bm[2].trim()),
    };
  }

  // Also scan workspace references.bib if bibItems is empty
  if (Object.keys(bibItems).length === 0 && files) {
    for (const [key, file] of Object.entries(files)) {
      const fileName = file.name || key;
      if (file.type === 'bib' || fileName.endsWith('.bib')) {
        const bibText = file.content || '';
        const entries = bibText.split(/@\w+\s*\{/);
        for (const entry of entries) {
          if (!entry.trim()) continue;
          const commaIdx = entry.indexOf(',');
          if (commaIdx !== -1) {
            const key = entry.substring(0, commaIdx).trim();
            const rest = entry.substring(commaIdx + 1);
            const titleM = rest.match(/title\s*=\s*[\{"]([^"\}]+)[\}"]/i);
            const authorM = rest.match(/author\s*=\s*[\{"]([^"\}]+)[\}"]/i);
            const yearM = rest.match(/year\s*=\s*[\{"]?([0-9]{4})[\}"]?/i);
            const journalM = rest.match(/(?:journal|booktitle)\s*=\s*[\{"]([^"\}]+)[\}"]/i);
            if (key) {
              bCount++;
              const desc = `${authorM ? authorM[1] + '. ' : ''}${titleM ? `"${titleM[1]}". ` : ''}${journalM ? `*${journalM[1]}*, ` : ''}${yearM ? yearM[1] : ''}`;
              bibItems[key] = {
                number: bCount,
                text: desc.trim() || key,
              };
            }
          }
        }
      }
    }
  }

  // 6. Transform Footnotes
  const footnotes: { id: number; text: string }[] = [];
  let fnCounter = 0;
  body = body.replace(/\\footnote\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/g, (_, note) => {
    fnCounter++;
    footnotes.push({ id: fnCounter, text: cleanInlineLatex(note) });
    return `[^${fnCounter}]`;
  });

  // 7. Transform Citations (\cite, \citep, \citet)
  body = body.replace(/\\(?:cite|citep|citet|citeauthor|citeyear)\{([^}]+)\}/g, (_, keysStr) => {
    const keys = keysStr.split(',').map((k: string) => k.trim());
    const rendered = keys.map((k: string) => {
      const bib = bibItems[k];
      return bib ? `[${bib.number}]` : `[?]`;
    });
    return rendered.join(', ');
  });

  // 8. Transform Cross-references (\ref, \eqref, \cref)
  body = body.replace(/\\eqref\{([^}]+)\}/g, (_, key) => {
    const t = labels[key.trim()];
    return t ? `(${t.number})` : `(?)`;
  });

  body = body.replace(/([^\s\\]*)\s*\\(?:ref|cref|Cref|autoref)\{([^}]+)\}/g, (match, prefix, key) => {
    const t = labels[key.trim()];
    if (!t) return `${prefix ? prefix + ' ' : ''}?`;

    const cleanPre = prefix.trim();
    if (t.type === 'table') {
      if (cleanPre.endsWith('表') || /table$/i.test(cleanPre)) return `${prefix} ${t.number}`;
      return `${prefix ? prefix + ' ' : ''}表 ${t.number}`;
    }
    if (t.type === 'figure') {
      if (cleanPre.endsWith('图') || /fig(\.|ure)?$/i.test(cleanPre)) return `${prefix} ${t.number}`;
      return `${prefix ? prefix + ' ' : ''}图 ${t.number}`;
    }
    if (t.type === 'equation') {
      if (cleanPre.endsWith('式') || cleanPre.endsWith('(') || /eq(\.|uation)?$/i.test(cleanPre)) {
        return cleanPre.endsWith('(') ? `${prefix}${t.number}` : `${prefix} (${t.number})`;
      }
      return `${prefix ? prefix + ' ' : ''}(${t.number})`;
    }
    if (t.type === 'chapter') return `${prefix ? prefix + ' ' : ''}${t.number}`;
    if (t.type === 'section' || t.type === 'subsection') {
      if (cleanPre.endsWith('节') || /section$/i.test(cleanPre)) return `${prefix} ${t.number}`;
      return `${prefix ? prefix + ' ' : ''}第 ${t.number} 节`;
    }
    return `${prefix ? prefix + ' ' : ''}${t.number}`;
  });

  // 9. Transform Display & Numbered Equations
  let eqIdx = 0;
  body = body.replace(/\\begin\{equation\*?\}([\s\S]*?)\\end\{equation\*?\}/g, (_, inner) => {
    eqIdx++;
    const tagMatch = inner.match(/\\tag\{([^}]+)\}/);
    const eqNum = tagMatch ? tagMatch[1] : `${eqIdx}`;
    const cleanMath = inner
      .replace(/\\label\{[^}]+\}/g, '')
      .replace(/\\tag\{[^}]+\}/g, '')
      .trim();

    if (mathFlavor === 'numbered') {
      return `\n\n$$\n\\begin{equation}\n${cleanMath}\n\\tag{${eqNum}}\n\\end{equation}\n$$\n\n`;
    }

    return `\n\n$$\n${cleanMath} \\tag{${eqNum}}\n$$\n\n`;
  });

  // Transform Align, Gather, Multline to $$ \begin{aligned} ... \end{aligned} $$
  body = body.replace(/\\begin\{align\*?\}([\s\S]*?)\\end\{align\*?\}/g, (_, inner) => {
    const cleanMath = inner.replace(/\\label\{[^}]+\}/g, '').trim();
    return `\n\n$$\n\\begin{aligned}\n${cleanMath}\n\\end{aligned}\n$$\n\n`;
  });

  body = body.replace(/\\begin\{gather\*?\}([\s\S]*?)\\end\{gather\*?\}/g, (_, inner) => {
    const cleanMath = inner.replace(/\\label\{[^}]+\}/g, '').trim();
    return `\n\n$$\n\\begin{gathered}\n${cleanMath}\n\\end{gathered}\n$$\n\n`;
  });

  body = body.replace(/\\begin\{(?:alignat\*?|multline\*?)\}(?:\{[^}]*\})?([\s\S]*?)\\end\{(?:alignat\*?|multline\*?)\}/g, (_, inner) => {
    const cleanMath = inner.replace(/\\label\{[^}]+\}/g, '').trim();
    return `\n\n$$\n\\begin{aligned}\n${cleanMath}\n\\end{aligned}\n$$\n\n`;
  });

  // Display math \[ ... \] and $$ ... $$
  body = body.replace(/\\\[([\s\S]*?)\\\]/g, (_, inner) => {
    return `\n\n$$\n${inner.trim()}\n$$\n\n`;
  });

  body = body.replace(/\$\$([\s\S]*?)\$\$/g, (_, inner) => {
    return `\n\n$$\n${inner.trim()}\n$$\n\n`;
  });

  // 10. Transform Tables (table + tabular)
  let tblIdx = 0;
  body = body.replace(/\\begin\{table\*?\}(?:\[[^\]]*\])?([\s\S]*?)\\end\{table\*?\}/g, (_, content) => {
    tblIdx++;
    const capMatch = content.match(/\\caption\{([^}]+)\}/);
    const lblMatch = content.match(/\\label\{([^}]+)\}/);
    const captionText = capMatch ? `表 ${tblIdx}: ${cleanInlineLatex(capMatch[1])}` : `表 ${tblIdx}`;

    const tabularMatch = content.match(/\\begin\{(?:tabular|tabular\*|tabularx)\}(?:\{[^}]*\})?\{([^}]+)\}([\s\S]*?)\\end\{(?:tabular|tabular\*|tabularx)\}/);
    if (tabularMatch) {
      const tableMd = convertTabularToMarkdown(
        tabularMatch[1],
        tabularMatch[2],
        captionText,
        lblMatch ? lblMatch[1].trim() : undefined
      );
      return `\n\n${tableMd}\n\n`;
    }

    return `\n\n> **${captionText}**\n\n`;
  });

  // Standalone tabular if outside table env
  body = body.replace(/\\begin\{(?:tabular|tabular\*|tabularx)\}(?:\{[^}]*\})?\{([^}]+)\}([\s\S]*?)\\end\{(?:tabular|tabular\*|tabularx)\}/g, (_, cols, inner) => {
    const tableMd = convertTabularToMarkdown(cols, inner);
    return `\n\n${tableMd}\n\n`;
  });

  // 11. Transform Figures (figure + includegraphics / tikzpicture)
  let figIdx = 0;
  body = body.replace(/\\begin\{figure\*?\}(?:\[[^\]]*\])?([\s\S]*?)\\end\{figure\*?\}/g, (_, content) => {
    figIdx++;
    const capMatch = content.match(/\\caption\{([^}]+)\}/);
    const captionText = capMatch ? `图 ${figIdx}: ${cleanInlineLatex(capMatch[1])}` : `图 ${figIdx}`;

    const graphicMatch = content.match(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/);
    if (graphicMatch) {
      const src = graphicMatch[1].trim();

      // Check for inline SVG if embedImages is requested
      let embedSrc = src;
      if (embedImages && files) {
        for (const [key, file] of Object.entries(files)) {
          const fileName = file.name || key.split('/').pop() || key;
          const filePath = file.path ? file.path.replace(/^\//, '') : key.replace(/^\//, '');
          if (
            (fileName === src || filePath.endsWith(`/${src}`) || filePath === src) &&
            file.type === 'svg' &&
            file.content
          ) {
            embedSrc = `data:image/svg+xml;utf8,${encodeURIComponent(file.content)}`;
            break;
          }
        }
      }

      return `\n\n![${captionText}](${embedSrc})\n\n*${captionText}*\n\n`;
    }

    const tikzMatch = content.match(/\\begin\{tikzpicture\}(?:\[[^\]]*\])?([\s\S]*?)\\end\{tikzpicture\}/);
    if (tikzMatch) {
      return `\n\n\`\`\`latex\n\\begin{tikzpicture}\n${tikzMatch[1].trim()}\n\\end{tikzpicture}\n\`\`\`\n\n*${captionText}*\n\n`;
    }

    return `\n\n> **${captionText}**\n\n`;
  });

  // Standalone includegraphics
  body = body.replace(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g, (_, src) => {
    return `\n\n![插图](${src.trim()})\n\n`;
  });

  // Standalone tikzpicture
  body = body.replace(/\\begin\{tikzpicture\}(?:\[[^\]]*\])?([\s\S]*?)\\end\{tikzpicture\}/g, (_, inner) => {
    return `\n\n\`\`\`latex\n\\begin{tikzpicture}\n${inner.trim()}\n\\end{tikzpicture}\n\`\`\`\n\n`;
  });

  // 12. Transform Theorems, Proofs, Definitions
  const theoremTypes = [
    { name: 'theorem', title: '定理' },
    { name: 'lemma', title: '引理' },
    { name: 'definition', title: '定义' },
    { name: 'proposition', title: '命题' },
    { name: 'corollary', title: '推论' },
    { name: 'example', title: '例' },
    { name: 'remark', title: '注' },
    { name: 'note', title: '说明' },
    { name: 'property', title: '性质' },
    { name: 'assumption', title: '假设' },
  ];

  let thmCount = 0;
  theoremTypes.forEach(({ name, title }) => {
    const reg = new RegExp(`\\\\begin\\{${name}\\}(?:\\[([^\\]]*)\\])?([\\s\\S]*?)\\\\end\\{${name}\\}`, 'g');
    body = body.replace(reg, (_, optTitle, content) => {
      thmCount++;
      const opt = optTitle ? ` (${cleanInlineLatex(optTitle)})` : '';
      const cleanInner = cleanInlineLatex(content.replace(/\\label\{[^}]+\}/g, '').trim());
      const quoted = cleanInner.split('\n').map(line => `> ${line}`).join('\n');
      return `\n\n> **${title} ${thmCount}${opt}**：\n>\n${quoted}\n\n`;
    });
  });

  // Proof environment
  body = body.replace(/\\begin\{proof\}(?:\[([^\]]*)\])?([\s\S]*?)\\end\{proof\}/g, (_, opt, content) => {
    const proofTitle = opt ? cleanInlineLatex(opt) : '证明';
    const cleanInner = cleanInlineLatex(content.trim());
    const quoted = cleanInner.split('\n').map(line => `> ${line}`).join('\n');
    return `\n\n> ***${proofTitle}***：\n>\n${quoted} ∎\n\n`;
  });

  // tcolorbox
  body = body.replace(/\\begin\{tcolorbox\}(?:\[([^\]]*)\])?([\s\S]*?)\\end\{tcolorbox\}/g, (_, opt, content) => {
    let boxTitle = '';
    if (opt) {
      const tm = opt.match(/title=\{?([^,\]\}]+)\}?/);
      if (tm) boxTitle = cleanInlineLatex(tm[1].trim());
    }
    const cleanInner = cleanInlineLatex(content.trim());
    const quoted = cleanInner.split('\n').map(line => `> ${line}`).join('\n');
    return `\n\n> ${boxTitle ? `**${boxTitle}**\n>\n` : ''}${quoted}\n\n`;
  });

  // Algorithms
  body = body.replace(/\\begin\{algorithm\*?\}(?:\[[^\]]*\])?([\s\S]*?)\\end\{algorithm\*?\}/g, (_, content) => {
    const capMatch = content.match(/\\caption\{([^}]+)\}/);
    const algTitle = capMatch ? cleanInlineLatex(capMatch[1].trim()) : '算法流程';

    let algText = content.replace(/\\caption\{[^}]+\}/g, '');
    algText = algText.replace(/\\begin\{(?:algorithmic|algorithmicx)\}(?:\[\d+\])?/g, '');
    algText = algText.replace(/\\end\{(?:algorithmic|algorithmicx)\}/g, '');
    algText = algText.replace(/\\STATE\s*/g, '  ');
    algText = algText.replace(/\\REQUIRE\s*/g, '输入: ');
    algText = algText.replace(/\\ENSURE\s*/g, '输出: ');
    algText = algText.replace(/\\FOR\{([^}]+)\}/g, 'for $1 do');
    algText = algText.replace(/\\ENDFOR/g, 'end for');
    algText = algText.replace(/\\WHILE\{([^}]+)\}/g, 'while $1 do');
    algText = algText.replace(/\\ENDWHILE/g, 'end while');
    algText = algText.replace(/\\IF\{([^}]+)\}/g, 'if $1 then');
    algText = algText.replace(/\\ELSE/g, 'else');
    algText = algText.replace(/\\ENDIF/g, 'end if');
    algText = algText.replace(/\\RETURN\s*/g, 'return ');

    const lines = algText
      .split('\n')
      .map((l: string) => cleanInlineLatex(l.trim()))
      .filter(Boolean);

    return `\n\n**算法: ${algTitle}**\n\n\`\`\`text\n${lines.join('\n')}\n\`\`\`\n\n`;
  });

  // 13. Lists (itemize, enumerate)
  // Simple recursive/nested list parser
  body = body.replace(/\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/g, (_, listContent) => {
    const items = listContent.split(/\\item\b/);
    const mdItems = items.slice(1).map((item: string) => {
      const cleanItem = cleanInlineLatex(item.trim()).replace(/\n+/g, ' ');
      return `- ${cleanItem}`;
    });
    return `\n\n${mdItems.join('\n')}\n\n`;
  });

  body = body.replace(/\\begin\{enumerate\}([\s\S]*?)\\end\{enumerate\}/g, (_, listContent) => {
    const items = listContent.split(/\\item\b/);
    const mdItems = items.slice(1).map((item: string, idx: number) => {
      const cleanItem = cleanInlineLatex(item.trim()).replace(/\n+/g, ' ');
      return `${idx + 1}. ${cleanItem}`;
    });
    return `\n\n${mdItems.join('\n')}\n\n`;
  });

  // 14. Code blocks (verbatim, lstlisting, minted)
  body = body.replace(/\\begin\{(?:verbatim|lstlisting|minted)\}(?:\{[^}]*\})?(?:\[([^\]]*)\])?([\s\S]*?)\\end\{(?:verbatim|lstlisting|minted)\}/g, (_, opts, code) => {
    let lang = '';
    if (opts) {
      const lm = opts.match(/language=([a-zA-Z0-9_-]+)/i);
      if (lm) lang = lm[1].toLowerCase();
    }
    return `\n\n\`\`\`${lang}\n${code.trim()}\n\`\`\`\n\n`;
  });

  // Quotes
  body = body.replace(/\\begin\{quote\}([\s\S]*?)\\end\{quote\}/g, (_, quoteContent) => {
    const quoted = cleanInlineLatex(quoteContent.trim()).split('\n').map(l => `> ${l}`).join('\n');
    return `\n\n${quoted}\n\n`;
  });

  // 15. Transform Headings
  let cCount = 0, sec1 = 0, sec2 = 0, sec3 = 0;
  body = body.replace(/\\(chapter|section|subsection|subsubsection)(\*?)\{([^}]+)\}/g, (_, type, isStarred, rawT) => {
    const headingText = cleanInlineLatex(rawT.trim());
    let prefix = '';

    if (!isStarred) {
      if (type === 'chapter') {
        cCount++; sec1 = 0; sec2 = 0; sec3 = 0;
        prefix = `第 ${cCount} 章 `;
      } else if (type === 'section') {
        sec1++; sec2 = 0; sec3 = 0;
        prefix = `${sec1}. `;
      } else if (type === 'subsection') {
        sec2++; sec3 = 0;
        prefix = `${sec1}.${sec2} `;
      } else {
        sec3++;
        prefix = `${sec1}.${sec2}.${sec3} `;
      }
    }

    if (type === 'chapter') {
      return `\n\n# ${prefix}${headingText}\n\n`;
    } else if (type === 'section') {
      return `\n\n## ${prefix}${headingText}\n\n`;
    } else if (type === 'subsection') {
      return `\n\n### ${prefix}${headingText}\n\n`;
    } else {
      return `\n\n#### ${prefix}${headingText}\n\n`;
    }
  });

  body = body.replace(/\\paragraph\*?\{([^}]+)\}/g, (_, rawP) => {
    return `\n\n##### ${cleanInlineLatex(rawP.trim())}\n\n`;
  });

  // Remove bibliography environment from body as we will append nicely
  body = body.replace(/\\begin\{thebibliography\}\{[^}]*\}[\s\S]*?\\end\{thebibliography\}/g, '');

  // Strip remaining labels
  body = body.replace(/\\label\{[^}]*\}/g, '');

  // Clean inline styles throughout the entire body
  body = cleanInlineLatex(body);

  // Normalize consecutive newlines
  body = body.replace(/\n{3,}/g, '\n\n').trim();

  // 16. Build Frontmatter & Header
  let headerContent = '';
  if (frontmatter === 'yaml') {
    const yamlLines = [
      '---',
      `title: "${cleanTitle.replace(/"/g, '\\"')}"`,
    ];
    if (authorsList.length > 0) {
      yamlLines.push('author:');
      for (const a of authorsList) {
        yamlLines.push(`  - "${a.replace(/"/g, '\\"')}"`);
      }
    }
    yamlLines.push(`date: "${docDate}"`);
    if (cleanKeywords) {
      yamlLines.push(`keywords: "${cleanKeywords.replace(/"/g, '\\"')}"`);
    }
    yamlLines.push('---\n');
    headerContent = yamlLines.join('\n');
  } else if (frontmatter === 'title') {
    const titleLines = [`# ${cleanTitle}\n`];
    if (authorsList.length > 0) {
      titleLines.push(`**作者**：${authorsList.join(', ')}`);
    }
    if (docDate) {
      titleLines.push(`**日期**：${docDate}`);
    }
    titleLines.push('');
    if (cleanAbstract) {
      titleLines.push(`> **摘要**：${cleanAbstract}\n>`);
      if (cleanKeywords) {
        titleLines.push(`> **关键词**：${cleanKeywords}`);
      }
      titleLines.push('');
    }
    headerContent = titleLines.join('\n');
  }

  // 17. Build Appendices (Footnotes & Bibliography)
  let appendixContent = '';

  // Footnotes
  if (footnotes.length > 0) {
    appendixContent += '\n\n---\n\n### 脚注\n\n';
    for (const fn of footnotes) {
      appendixContent += `[^${fn.id}]: ${fn.text}\n`;
    }
  }

  // Bibliography
  if (includeBib && Object.keys(bibItems).length > 0) {
    appendixContent += '\n\n## 参考文献\n\n';
    const sortedBib = Object.values(bibItems).sort((a, b) => a.number - b.number);
    for (const item of sortedBib) {
      appendixContent += `[${item.number}] ${item.text}\n\n`;
    }
  }

  // Combine full document
  const finalMarkdown = `${headerContent}\n${body}\n${appendixContent}`.trim();

  // Calculate stats
  const cnChars = (finalMarkdown.match(/[\u4e00-\u9fa5]/g) || []).length;
  const enWords = (finalMarkdown.replace(/[\u4e00-\u9fa5]/g, ' ').match(/\b[a-zA-Z0-9_-]+\b/g) || []).length;
  const wordCount = cnChars + enWords;

  return {
    markdown: finalMarkdown,
    title: cleanTitle,
    stats: {
      wordCount,
      equationCount: eqCount,
      tableCount,
      figureCount,
      sectionCount: sec1 + sec2 + sec3 + cCount,
    },
  };
}

/**
 * Trigger direct download of a .md file in the browser
 */
export function downloadMarkdownFile(content: string, filename: string): void {
  const safeName = filename.endsWith('.md') ? filename : `${filename}.md`;
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export a ZIP bundle containing the .md file and all image/figure files in the workspace
 */
export async function exportMarkdownBundleZip(
  markdown: string,
  mdFileName: string,
  workspace: WorkspaceState,
  zipProjectName = 'latex-markdown-export'
): Promise<void> {
  const zip = new JSZip();

  // Add the markdown file
  const safeMdName = mdFileName.endsWith('.md') ? mdFileName : `${mdFileName}.md`;
  zip.file(safeMdName, markdown);

  // Helper to get full path in workspace
  const getFullPath = (file: FileItem): string => {
    let current: FileItem | undefined = file;
    const parts: string[] = [file.name];
    while (current && current.parentId) {
      current = workspace.files[current.parentId];
      if (current) {
        parts.unshift(current.name);
      }
    }
    return parts.join('/');
  };

  // Add all image assets (svg, png, jpg, etc.) or bib files
  for (const file of Object.values(workspace.files)) {
    if (file.type === 'folder') continue;

    const ext = file.name.split('.').pop()?.toLowerCase();
    const isAsset = file.type === 'svg' || ['png', 'jpg', 'jpeg', 'pdf', 'eps', 'webp'].includes(ext || '');

    if (isAsset) {
      const fullPath = getFullPath(file);
      zip.file(fullPath, file.content || '');
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${zipProjectName.replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, '_')}_with_assets.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
