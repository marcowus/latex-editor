import katex from 'katex';
import { CompileResult, Diagnostic, FileItem, LatexEngine, SyncLocation } from '../types/latex';

interface ParserOptions {
  files?: Record<string, FileItem>;
  rootFile?: string;
  theme?: 'modern' | 'classic' | 'ieee';
  engine?: LatexEngine;
}

interface SourceLocation {
  fileId?: string;
  fileName: string;
  line: number;
}

// Built-in standard macros compatible with amsmath, amssymb, bm, physics, mathtools
const BUILTIN_KATEX_MACROS: Record<string, any> = {
  '\\bm': '\\boldsymbol{#1}',
  '\\R': '\\mathbb{R}',
  '\\N': '\\mathbb{N}',
  '\\Z': '\\mathbb{Z}',
  '\\C': '\\mathbb{C}',
  '\\Q': '\\mathbb{Q}',
  '\\E': '\\mathbb{E}',
  '\\P': '\\mathbb{P}',
  '\\argmax': '\\operatorname*{arg\\,max}',
  '\\argmin': '\\operatorname*{arg\\,min}',
  '\\diag': '\\operatorname{diag}',
  '\\tr': '\\operatorname{tr}',
  '\\trace': '\\operatorname{tr}',
  '\\rank': '\\operatorname{rank}',
  '\\norm': '\\left\\|#1\\right\\|',
  '\\abs': '\\left|#1\\right|',
  '\\ceil': '\\left\\lceil#1\\right\\rceil',
  '\\floor': '\\left\\lfloor#1\\right\\rfloor',
  '\\braket': '\\left\\langle#1\\middle|#2\\right\\rangle',
  '\\ket': '\\left|#1\\right\\rangle',
  '\\bra': '\\left\\langle#1\\right|',
  '\\dif': '\\mathrm{d}',
  '\\dd': '\\mathrm{d}',
  '\\eqref': '(#1)',
  '\\mathbbm': '\\mathbb{#1}',
  '\\mathds': '\\mathbb{#1}',
  '\\textsubscript': '\\raisebox{-0.5ex}{\\scriptsize #1}',
  '\\textsuperscript': '^{#1}',
  '\\coloneqq': ':=',
  '\\eqqcolon': '=:',
  '\\triangleq': '\\triangleq',
  '\\sgn': '\\operatorname{sgn}',
  '\\sign': '\\operatorname{sign}',
  '\\supp': '\\operatorname{supp}',
  '\\sinc': '\\operatorname{sinc}',
  '\\rect': '\\operatorname{rect}',
  '\\card': '\\operatorname{card}',
  '\\proj': '\\operatorname{proj}',
  '\\grad': '\\nabla',
  '\\div': '\\nabla\\cdot',
  '\\curl': '\\nabla\\times',
  '\\rot': '\\nabla\\times',
  '\\cross': '\\times',
  '\\dotprod': '\\cdot',
  '\\dv': '\\frac{\\mathrm{d}#1}{\\mathrm{d}#2}',
  '\\pdv': '\\frac{\\partial #1}{\\partial #2}',
  '\\eval': '\\left.#1\\right|',
  '\\llbracket': '[\\![',
  '\\rrbracket': ']\\!]',
  '\\indicator': '\\mathbb{I}',
  '\\one': '\\mathbf{1}',
  '\\zero': '\\mathbf{0}',
  '\\Re': '\\operatorname{Re}',
  '\\Im': '\\operatorname{Im}',
  '\\dist': '\\operatorname{dist}',
  '\\conv': '\\operatorname{conv}',
  '\\dom': '\\operatorname{dom}',
};

// Safe comment stripping: Only strip % that is not preceded by an odd number of backslashes
export function stripLatexComments(str: string): string {
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

// Extract user-defined macros (\newcommand, \renewcommand, \DeclareMathOperator, \def)
function extractUserMacros(source: string): { katexMacros: Record<string, any>; textMacros: Record<string, string> } {
  const katexMacros: Record<string, any> = { ...BUILTIN_KATEX_MACROS };
  const textMacros: Record<string, string> = {};

  // 1. \newcommand{\name}[args]{body} or \newcommand{\name}{body}
  // and \renewcommand
  const newcmdRegex = /\\(?:newcommand|renewcommand)\*?\{?\\([a-zA-Z]+)\}?(?:\[(\d+)\])?\{((?:[^{}]*|\{(?:[^{}]*|\{[^{}]*\})*\})*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = newcmdRegex.exec(source)) !== null) {
    const cmdName = `\\${match[1]}`;
    const argCount = match[2] ? parseInt(match[2], 10) : 0;
    const body = match[3];

    if (argCount > 0) {
      katexMacros[cmdName] = body;
    } else {
      katexMacros[cmdName] = body;
      textMacros[cmdName] = body;
    }
  }

  // 2. \DeclareMathOperator{\name}{text} or \DeclareMathOperator*{\name}{text}
  const opRegex = /\\DeclareMathOperator(\*)?\{?\\([a-zA-Z]+)\}?\{([^}]+)\}/g;
  while ((match = opRegex.exec(source)) !== null) {
    const isStar = !!match[1];
    const opName = `\\${match[2]}`;
    const opText = match[3];
    katexMacros[opName] = isStar ? `\\operatorname*{${opText}}` : `\\operatorname{${opText}}`;
  }

  // 3. \def\name{body} or \def\name#1{body}
  const defRegex = /\\def\\([a-zA-Z]+)(?:#1)?\{([^}]+)\}/g;
  while ((match = defRegex.exec(source)) !== null) {
    const defName = `\\${match[1]}`;
    const defBody = match[2];
    katexMacros[defName] = defBody;
  }

  return { katexMacros, textMacros };
}

// Main compilation function
export function compileLatex(source: string, options: ParserOptions = {}): CompileResult {
  const startTime = performance.now();
  const diagnostics: Diagnostic[] = [];
  const toc: { id: string; title: string; level: number }[] = [];

  // Determine root file info
  let rootFileId: string | undefined;
  let rootFileName = options.rootFile || 'main.tex';
  if (options.files) {
    const rf =
      Object.values(options.files).find((f) => f.name === rootFileName) ||
      Object.values(options.files).find((f) => f.content === source);
    if (rf) {
      rootFileId = rf.id;
      rootFileName = rf.name;
    }
  }

  // Detect Engine (XeLaTeX vs pdfLaTeX)
  let detectedEngine: 'xelatex' | 'pdflatex' = 'xelatex';
  const hasCtexOrXeCJK = /\\(?:usepackage|documentclass)(?:\[[^\]]*\])?\{(?:ctex|xeCJK|ctexart|ctexrep|ctexbook|fontspec)\}/i.test(source);
  const hasCJKutf8 = /\\(?:usepackage)(?:\[[^\]]*\])?\{CJKutf8\}/i.test(source);
  const hasPdfLatexSpecific = /\\(?:usepackage)(?:\[[^\]]*\])?\{(?:inputenc|fontenc|microtype)\}/i.test(source) || /\\pdfoutput/i.test(source);
  const hasChineseChars = /[\u4e00-\u9fa5]/.test(source);

  if (options.engine === 'xelatex') {
    detectedEngine = 'xelatex';
  } else if (options.engine === 'pdflatex') {
    detectedEngine = 'pdflatex';
  } else {
    // Auto detection
    if (hasCtexOrXeCJK) {
      detectedEngine = 'xelatex';
    } else if (hasCJKutf8 || hasPdfLatexSpecific) {
      detectedEngine = 'pdflatex';
    } else if (hasChineseChars) {
      detectedEngine = 'xelatex';
    } else {
      detectedEngine = 'pdflatex';
    }
  }

  const isChineseDoc = hasChineseChars || hasCtexOrXeCJK || hasCJKutf8 || detectedEngine === 'xelatex';

  // Extract macros from preamble
  const { katexMacros } = extractUserMacros(source);

  // 1. Build line-by-line source mapping, resolving \input and \include
  let mappedLines: { text: string; loc: SourceLocation }[] = source.split('\n').map((line, idx) => ({
    text: line,
    loc: {
      fileId: rootFileId,
      fileName: rootFileName,
      line: idx + 1,
    },
  }));

  const maxRecursion = 6;
  let recursionCount = 0;
  let hasIncludes = true;

  while (hasIncludes && recursionCount < maxRecursion) {
    hasIncludes = false;
    recursionCount++;
    const nextLines: { text: string; loc: SourceLocation }[] = [];

    for (const item of mappedLines) {
      const match = item.text.match(/\\(input|include)\{([^}]+)\}/);
      if (match) {
        const filename = match[2].trim();
        const cleanName = filename.replace(/\.tex$/, '');
        let targetFile: FileItem | undefined;
        if (options.files) {
          for (const file of Object.values(options.files)) {
            const fName = file.name.replace(/\.tex$/, '');
            const fPath = file.path.replace(/^\//, '').replace(/\.tex$/, '');
            if (fName === cleanName || fPath === cleanName || file.name === filename) {
              targetFile = file;
              break;
            }
          }
        }

        if (targetFile && targetFile.content !== undefined) {
          hasIncludes = true;
          const subLines = targetFile.content.split('\n');
          subLines.forEach((sLine, sIdx) => {
            nextLines.push({
              text: sLine,
              loc: {
                fileId: targetFile!.id,
                fileName: targetFile!.name,
                line: sIdx + 1,
              },
            });
          });
        } else {
          diagnostics.push({
            line: item.loc.line,
            message: `无法找到包含的文件: "${filename}"`,
            type: 'warning',
          });
          nextLines.push(item);
        }
      } else {
        nextLines.push(item);
      }
    }
    mappedLines = nextLines;
  }

  const resolvedSource = mappedLines.map((l) => l.text).join('\n');

  // Build character-offset index for resolvedSource
  const lineStartOffsets: number[] = [];
  let curOffset = 0;
  for (const item of mappedLines) {
    lineStartOffsets.push(curOffset);
    curOffset += item.text.length + 1;
  }

  const getLocAtOffset = (charOffset: number): SourceLocation => {
    if (charOffset <= 0) return mappedLines[0]?.loc || { fileName: rootFileName, line: 1 };
    let low = 0;
    let high = lineStartOffsets.length - 1;
    let best = 0;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (lineStartOffsets[mid] <= charOffset) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return mappedLines[best]?.loc || { fileName: rootFileName, line: 1 };
  };

  const findSourceLocation = (snippet: string, defaultLoc?: SourceLocation): SourceLocation => {
    if (!snippet || !snippet.trim()) return defaultLoc || mappedLines[0]?.loc || { fileName: rootFileName, line: 1 };
    const clean = snippet.replace(/\\label\{[^}]*\}/g, '').replace(/<[^>]*>/g, '').trim();
    if (!clean) return defaultLoc || mappedLines[0]?.loc || { fileName: rootFileName, line: 1 };

    const target = clean.slice(0, 35);
    for (let i = 0; i < mappedLines.length; i++) {
      if (mappedLines[i].text.includes(target)) {
        return mappedLines[i].loc;
      }
    }

    if (options.files) {
      for (const file of Object.values(options.files)) {
        if (file.content && file.type === 'tex') {
          const fileLines = file.content.split('\n');
          for (let i = 0; i < fileLines.length; i++) {
            if (fileLines[i].includes(target)) {
              return { fileId: file.id, fileName: file.name, line: i + 1 };
            }
          }
        }
      }
    }

    return defaultLoc || { fileName: rootFileName, line: 1 };
  };

  const syncAttrs = (loc: SourceLocation, desc?: string): string => {
    const fileIdAttr = loc.fileId ? ` data-source-file-id="${loc.fileId}"` : '';
    const fileNameAttr = loc.fileName ? ` data-source-file-name="${loc.fileName}"` : '';
    const label = desc ? `${desc} (第 ${loc.line} 行)` : `第 ${loc.line} 行`;
    return ` data-source-line="${loc.line}"${fileIdAttr}${fileNameAttr} data-latex-sync="true" title="点击定位到源码：${label}"`;
  };

  // 2. Syntax validation / Diagnostics check
  checkDiagnostics(resolvedSource, diagnostics);

  // 3. Extract Document Metadata
  let title = '';
  let titleLoc: SourceLocation | undefined;
  const titleMatch = resolvedSource.match(/\\title\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/);
  if (titleMatch && titleMatch.index !== undefined) {
    title = stripLatexCommands(titleMatch[1].trim());
    titleLoc = getLocAtOffset(titleMatch.index);
  }

  let authors: string[] = [];
  let authorsLoc: SourceLocation | undefined;
  const authorMatch = resolvedSource.match(/\\author(?:\[[^\]]*\])?\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/);
  if (authorMatch && authorMatch.index !== undefined) {
    const rawAuthors = authorMatch[1]
      .replace(/\\thanks\{[^}]*\}/g, '')
      .replace(/\\orcid\{[^}]*\}/g, '')
      .replace(/\\email\{[^}]*\}/g, '');
    authors = rawAuthors
      .split(/\\and|\s*,\s*|\\\\/)
      .map((a) => stripLatexCommands(a.trim()))
      .filter((a) => a && !a.startsWith('http') && !a.includes('@'));
    authorsLoc = getLocAtOffset(authorMatch.index);
  }

  let date = '';
  const dateMatch = resolvedSource.match(/\\date\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/);
  if (dateMatch) {
    date = stripLatexCommands(dateMatch[1].trim());
  } else {
    date = new Date().toLocaleDateString(isChineseDoc ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  let abstract = '';
  let abstractLoc: SourceLocation | undefined;
  const abstractMatch = resolvedSource.match(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/);
  if (abstractMatch && abstractMatch.index !== undefined) {
    abstract = abstractMatch[1].trim();
    abstractLoc = getLocAtOffset(abstractMatch.index);
  }

  // Keywords extraction (\keywords{...}, \begin{keywords}...\end{keywords}, \begin{IEEEkeywords}...\end{IEEEkeywords})
  let keywords = '';
  const kwMatch1 = resolvedSource.match(/\\keywords\{([^}]+)\}/);
  const kwMatch2 = resolvedSource.match(/\\begin\{(?:keywords|IEEEkeywords)\}([\s\S]*?)\\end\{\1\}/);
  if (kwMatch1) {
    keywords = kwMatch1[1].trim();
  } else if (kwMatch2) {
    keywords = kwMatch2[1].trim();
  }

  // 4. Pre-scan structural entities and all labels in resolvedSource
  const labels: Record<string, { type: string; number: number | string; id: string; loc: SourceLocation; title?: string }> = {};
  const bibItems: Record<string, { number: number; text: string; loc?: SourceLocation }> = {};

  // Tables pre-scan (supports table, table*)
  const tableDataList: {
    id: string;
    number: number;
    loc: SourceLocation;
    caption: string;
    content: string;
  }[] = [];

  const tableRegex = /\\begin\{table\*?\}(\[[^\]]*\])?([\s\S]*?)\\end\{table\*?\}/g;
  let tMatch: RegExpExecArray | null;
  let tCounter = 0;
  while ((tMatch = tableRegex.exec(resolvedSource)) !== null) {
    tCounter++;
    const tStartOffset = tMatch.index;
    const tLoc = getLocAtOffset(tStartOffset);
    const tContent = tMatch[2];
    const capMatch = tContent.match(/\\caption\{([^}]+)\}/);
    const capText = capMatch ? capMatch[1] : '';
    const tblId = `tbl-${tCounter}`;

    tableDataList.push({
      id: tblId,
      number: tCounter,
      loc: tLoc,
      caption: capText,
      content: tContent,
    });

    const lblMatch = tContent.match(/\\label\{([^}]+)\}/);
    if (lblMatch) {
      labels[lblMatch[1].trim()] = {
        type: 'table',
        number: `${tCounter}`,
        id: tblId,
        loc: tLoc,
        title: capText,
      };
    }
  }

  // Figures pre-scan (supports figure, figure*)
  const figureDataList: {
    id: string;
    number: number;
    loc: SourceLocation;
    caption: string;
    content: string;
  }[] = [];

  const figureRegex = /\\begin\{figure\*?\}(\[[^\]]*\])?([\s\S]*?)\\end\{figure\*?\}/g;
  let fMatch: RegExpExecArray | null;
  let fCounter = 0;
  while ((fMatch = figureRegex.exec(resolvedSource)) !== null) {
    fCounter++;
    const fLoc = getLocAtOffset(fMatch.index);
    const fContent = fMatch[2];
    const capMatch = fContent.match(/\\caption\{([^}]+)\}/);
    const figId = `fig-${fCounter}`;
    const capText = capMatch ? capMatch[1] : '';
    figureDataList.push({
      id: figId,
      number: fCounter,
      loc: fLoc,
      caption: capText,
      content: fContent,
    });
    const lblMatch = fContent.match(/\\label\{([^}]+)\}/);
    if (lblMatch) {
      labels[lblMatch[1].trim()] = {
        type: 'figure',
        number: `${fCounter}`,
        id: figId,
        loc: fLoc,
        title: capText,
      };
    }
  }

  // Algorithms pre-scan (supports algorithm, algorithm*)
  const algDataList: {
    id: string;
    number: number;
    loc: SourceLocation;
    caption: string;
    content: string;
  }[] = [];

  const algRegex = /\\begin\{algorithm\*?\}(\[[^\]]*\])?([\s\S]*?)\\end\{algorithm\*?\}/g;
  let algMatch: RegExpExecArray | null;
  let algCounter = 0;
  while ((algMatch = algRegex.exec(resolvedSource)) !== null) {
    algCounter++;
    const aStartOffset = algMatch.index;
    const aLoc = getLocAtOffset(aStartOffset);
    const aContent = algMatch[2];
    const capMatch = aContent.match(/\\caption\{([^}]+)\}/);
    const capText = capMatch ? capMatch[1] : '';
    const algId = `alg-${algCounter}`;

    algDataList.push({
      id: algId,
      number: algCounter,
      loc: aLoc,
      caption: capText,
      content: aContent,
    });

    const lblMatch = aContent.match(/\\label\{([^}]+)\}/);
    if (lblMatch) {
      labels[lblMatch[1].trim()] = {
        type: 'algorithm',
        number: `${algCounter}`,
        id: algId,
        loc: aLoc,
        title: capText,
      };
    }
  }

  // Equations pre-scan (equation, align, gather, subequations)
  const eqDataList: {
    id: string;
    number: string;
    loc: SourceLocation;
    content: string;
  }[] = [];

  const eqRegex = /\\begin\{equation\}([\s\S]*?)\\end\{equation\}/g;
  let eqMatch: RegExpExecArray | null;
  let eqCounter = 0;
  while ((eqMatch = eqRegex.exec(resolvedSource)) !== null) {
    eqCounter++;
    const eqLoc = getLocAtOffset(eqMatch.index);
    const eqContent = eqMatch[1];
    const tagMatch = eqContent.match(/\\tag\{([^}]+)\}/);
    const eqNumber = tagMatch ? tagMatch[1] : `${eqCounter}`;
    const eqId = `eq-${eqCounter}`;

    eqDataList.push({
      id: eqId,
      number: eqNumber,
      loc: eqLoc,
      content: eqContent,
    });
    const lblMatch = eqContent.match(/\\label\{([^}]+)\}/);
    if (lblMatch) {
      labels[lblMatch[1].trim()] = {
        type: 'equation',
        number: eqNumber,
        id: eqId,
        loc: eqLoc,
      };
    }
  }

  // Chapter & Sections pre-scan (handles chapters, sections, starred sections)
  let isAppendix = false;
  let appendixLetter = 'A';
  let chapCount = 0;
  let s1 = 0, s2 = 0, s3 = 0;

  const headingRegex = /\\(chapter|section|subsection|subsubsection)(\*?)\{([^}]+)\}/g;
  let hMatch: RegExpExecArray | null;
  const secDataList: {
    id: string;
    type: 'chapter' | 'section' | 'subsection' | 'subsubsection';
    title: string;
    number: string;
    isStarred: boolean;
    loc: SourceLocation;
  }[] = [];

  while ((hMatch = headingRegex.exec(resolvedSource)) !== null) {
    const hType = hMatch[1] as 'chapter' | 'section' | 'subsection' | 'subsubsection';
    const isStarred = hMatch[2] === '*';
    const hTitle = hMatch[3].trim();
    const hLoc = getLocAtOffset(hMatch.index);

    let hNum = '';
    let hId = `heading-${secDataList.length + 1}`;

    if (!isStarred) {
      if (hType === 'chapter') {
        chapCount++;
        s1 = 0; s2 = 0; s3 = 0;
        hNum = isAppendix ? `附录 ${appendixLetter}` : `第 ${chapCount} 章`;
        if (isAppendix) appendixLetter = String.fromCharCode(appendixLetter.charCodeAt(0) + 1);
        hId = `chap-${chapCount}`;
      } else if (hType === 'section') {
        s1++;
        s2 = 0; s3 = 0;
        hNum = isAppendix ? `${appendixLetter}.${s1}` : `${s1}`;
        hId = `sec-${s1}`;
      } else if (hType === 'subsection') {
        s2++;
        s3 = 0;
        hNum = `${s1}.${s2}`;
        hId = `subsec-${s1}-${s2}`;
      } else {
        s3++;
        hNum = `${s1}.${s2}.${s3}`;
        hId = `subsubsec-${s1}-${s2}-${s3}`;
      }
    }

    secDataList.push({
      id: hId,
      type: hType,
      title: hTitle,
      number: hNum,
      isStarred,
      loc: hLoc,
    });

    const following = resolvedSource.substring(hMatch.index, hMatch.index + hMatch[0].length + 100);
    const lblMatch = following.match(/\\label\{([^}]+)\}/);
    if (lblMatch) {
      labels[lblMatch[1].trim()] = {
        type: hType,
        number: hNum || hTitle,
        id: hId,
        loc: hLoc,
        title: hTitle,
      };
    }
  }

  // Theorems pre-scan
  const thmDataList: {
    id: string;
    name: string;
    number: number;
    loc: SourceLocation;
    optTitle?: string;
    content: string;
  }[] = [];

  const thmRegex = /\\begin\{(theorem|lemma|definition|proposition|corollary|example|remark|note|property|assumption)\}(?:\[([^\]]*)\])?([\s\S]*?)\\end\{\1\}/g;
  let thmMatch: RegExpExecArray | null;
  let thmCount = 0;
  while ((thmMatch = thmRegex.exec(resolvedSource)) !== null) {
    thmCount++;
    const thmLoc = getLocAtOffset(thmMatch.index);
    const thmContent = thmMatch[3];
    const thmId = `thm-${thmCount}`;
    thmDataList.push({
      id: thmId,
      name: thmMatch[1],
      number: thmCount,
      loc: thmLoc,
      optTitle: thmMatch[2],
      content: thmContent,
    });
    const lblMatch = thmContent.match(/\\label\{([^}]+)\}/);
    if (lblMatch) {
      labels[lblMatch[1].trim()] = {
        type: thmMatch[1],
        number: `${thmCount}`,
        id: thmId,
        loc: thmLoc,
      };
    }
  }

  // Remaining labels
  const remainingLabelRegex = /\\label\{([^}]+)\}/g;
  let rMatch: RegExpExecArray | null;
  while ((rMatch = remainingLabelRegex.exec(resolvedSource)) !== null) {
    const key = rMatch[1].trim();
    if (!labels[key]) {
      labels[key] = {
        type: 'label',
        number: '•',
        id: `lbl-${key.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
        loc: getLocAtOffset(rMatch.index),
      };
    }
  }

  // Bibitems pre-scan
  const bibRegex = /\\bibitem(?:\[[^\]]*\])?\{([^}]+)\}([\s\S]*?)(?=(\\bibitem|\s*\\end\{thebibliography\}|$))/g;
  let bMatch: RegExpExecArray | null;
  let bCount = 0;
  while ((bMatch = bibRegex.exec(resolvedSource)) !== null) {
    bCount++;
    const key = bMatch[1].trim();
    bibItems[key] = {
      number: bCount,
      text: bMatch[2].trim(),
      loc: getLocAtOffset(bMatch.index),
    };
  }

  // Also scan workspace references.bib if bibitems are empty
  if (Object.keys(bibItems).length === 0 && options.files) {
    for (const file of Object.values(options.files)) {
      if (file.type === 'bib' || file.name.endsWith('.bib')) {
        const bibText = file.content || '';
        const entries = bibText.split(/@\w+\s*\{/);
        for (const entry of entries) {
          if (!entry.trim()) continue;
          const commaIdx = entry.indexOf(',');
          if (commaIdx !== -1) {
            const key = entry.substring(0, commaIdx).trim();
            const rest = entry.substring(commaIdx + 1);
            const titleMatch = rest.match(/title\s*=\s*[\{"]([^"\}]+)[\}"]/i);
            const authorMatch = rest.match(/author\s*=\s*[\{"]([^"\}]+)[\}"]/i);
            const yearMatch = rest.match(/year\s*=\s*[\{"]?([0-9]{4})[\}"]?/i);
            if (key) {
              bCount++;
              const desc = `${authorMatch ? authorMatch[1] + '. ' : ''}${titleMatch ? `"${titleMatch[1]}". ` : ''}${yearMatch ? yearMatch[1] : ''}`;
              bibItems[key] = {
                number: bCount,
                text: desc || key,
                loc: { fileId: file.id, fileName: file.name, line: 1 },
              };
            }
          }
        }
      }
    }
  }

  // 5. Extract body between \begin{document} and \end{document}
  let bodyContent = resolvedSource;
  const docMatch = resolvedSource.match(/\\begin\{document\}([\s\S]*?)(\\end\{document\}|$)/);
  if (docMatch) {
    bodyContent = docMatch[1];
  } else {
    bodyContent = resolvedSource
      .replace(/\\documentclass(\[[^\]]*\])?\{[^}]*\}/g, '')
      .replace(/\\usepackage(\[[^\]]*\])?\{[^}]*\}/g, '')
      .replace(/\\title\{[^}]*\}/g, '')
      .replace(/\\author\{[^}]*\}/g, '')
      .replace(/\\date\{[^}]*\}/g, '');
  }

  // Remove abstract from bodyContent if already extracted
  bodyContent = bodyContent.replace(/\\begin\{abstract\}[\s\S]*?\\end\{abstract\}/g, '');

  // pdfLaTeX CTeX compatibility: unwrap \begin{CJK*}{UTF8}{gbsn} ... \end{CJK*}
  bodyContent = bodyContent.replace(/\\begin\{CJK\*?\}\{[^}]*\}\{[^}]*\}/g, '');
  bodyContent = bodyContent.replace(/\\end\{CJK\*?\}/g, '');

  let html = bodyContent;

  // Safe comment stripping for body
  html = stripLatexComments(html);

  // Clean preamble leftovers and layout commands
  html = html.replace(/\\maketitle/g, '');
  html = html.replace(/\\tableofcontents/g, '');
  html = html.replace(/\\bibliographystyle\{[^}]*\}/g, '');
  html = html.replace(/\\bibliography\{[^}]*\}/g, '');
  html = html.replace(/\\nocite\{[^}]*\}/g, '');
  html = html.replace(/\\pagestyle\{[^}]*\}/g, '');
  html = html.replace(/\\thispagestyle\{[^}]*\}/g, '');
  html = html.replace(/\\geometry\{[^}]*\}/g, '');
  html = html.replace(/\\hypersetup\{[^}]*\}/g, '');
  html = html.replace(/\\pagenumbering\{[^}]*\}/g, '');
  html = html.replace(/\\noindent\s*/g, '');
  html = html.replace(/\\indent\s*/g, '');
  html = html.replace(/\\clearpage|\\newpage|\\pagebreak/g, '<div class="my-6 border-b border-dashed border-slate-200 print:break-after-page"></div>');
  html = html.replace(/\\centering/g, '');
  html = html.replace(/\\raggedright/g, '');
  html = html.replace(/\\raggedleft/g, '');
  html = html.replace(/\\label\{[^}]*\}/g, '');
  html = html.replace(/\\index\{[^}]*\}/g, '');
  html = html.replace(/\\appendix/g, () => {
    isAppendix = true;
    return '';
  });

  // Handle \footnote{...}
  const footnotes: { id: number; text: string }[] = [];
  let footnoteCounter = 0;
  html = html.replace(/\\footnote\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/g, (_, note) => {
    footnoteCounter++;
    footnotes.push({ id: footnoteCounter, text: renderInlineLatex(note, katexMacros) });
    return `<sup class="cursor-pointer text-indigo-600 font-semibold hover:underline" title="${escapeHtml(note)}">[${footnoteCounter}]</sup>`;
  });

  // Handle \cite, \citep, \citet
  html = html.replace(/\\(?:cite|citep|citet|citeauthor|citeyear)\{([^}]+)\}/g, (_, key) => {
    const keys = key.split(',').map((k: string) => k.trim());
    const rendered = keys.map((k: string) => {
      const bib = bibItems[k];
      if (bib) {
        const fIdAttr = bib.loc?.fileId ? ` data-source-file-id="${bib.loc.fileId}"` : '';
        const fNameAttr = bib.loc?.fileName ? ` data-source-file-name="${bib.loc.fileName}"` : '';
        const lineAttr = bib.loc?.line ? ` data-source-line="${bib.loc.line}"` : '';
        return `<a href="#bib-${k}"${lineAttr}${fIdAttr}${fNameAttr} data-latex-sync="true" class="latex-sync-node text-indigo-600 hover:text-indigo-800 font-medium hover:underline cursor-pointer" title="参考文献引用 [${bib.number}]：点击定位到引用条目">[${bib.number}]</a>`;
      }
      return `<span class="text-amber-600 font-medium" title="未找到参考文献条目 [${k}]">[?]</span>`;
    });
    return rendered.join(', ');
  });

  // Smart cross-references (\ref, \eqref, \cref, \Cref, \autoref)
  const formatSmartRef = (refKey: string, isCapital = false, customPrefix = '') => {
    const target = labels[refKey.trim()];
    if (target) {
      const fIdAttr = target.loc.fileId ? ` data-source-file-id="${target.loc.fileId}"` : '';
      const fNameAttr = target.loc.fileName ? ` data-source-file-name="${target.loc.fileName}"` : '';

      let prefix = customPrefix;
      if (!prefix) {
        if (target.type === 'table') prefix = isChineseDoc ? '表 ' : isCapital ? 'Table ' : 'table ';
        else if (target.type === 'figure') prefix = isChineseDoc ? '图 ' : isCapital ? 'Fig. ' : 'fig. ';
        else if (target.type === 'algorithm') prefix = isChineseDoc ? '算法 ' : isCapital ? 'Algorithm ' : 'algorithm ';
        else if (target.type === 'equation') prefix = isChineseDoc ? '式 ' : isCapital ? 'Eq. ' : 'eq. ';
        else if (target.type === 'chapter') prefix = isChineseDoc ? '' : isCapital ? 'Chapter ' : 'chapter ';
        else prefix = isChineseDoc ? '第 ' : isCapital ? 'Section ' : 'section ';
      }

      const displayVal = target.type === 'equation' && !customPrefix ? `(${target.number})` : target.number;
      return `<a href="#${target.id}" data-source-line="${target.loc.line}"${fIdAttr}${fNameAttr} data-latex-sync="true" class="latex-sync-node text-indigo-600 font-medium hover:underline cursor-pointer px-0.5 rounded hover:bg-indigo-50" title="点击跳转至 ${prefix}${displayVal} 源码 (第 ${target.loc.line} 行)">${prefix}${displayVal}</a>`;
    }
    return `<span class="text-amber-600 font-medium underline decoration-wavy" title="未解析的交叉引用 \\ref{${refKey}}">?</span>`;
  };

  html = html.replace(/\\ref\{([^}]+)\}/g, (_, key) => formatSmartRef(key, false, ''));
  html = html.replace(/\\eqref\{([^}]+)\}/g, (_, key) => formatSmartRef(key, false, ''));
  html = html.replace(/\\cref\{([^}]+)\}/g, (_, key) => formatSmartRef(key, false, ''));
  html = html.replace(/\\Cref\{([^}]+)\}/g, (_, key) => formatSmartRef(key, true, ''));
  html = html.replace(/\\autoref\{([^}]+)\}/g, (_, key) => formatSmartRef(key, true, ''));

  // Hyperlinks: \href{url}{text} and \url{url}
  html = html.replace(/\\href\{([^}]+)\}\{([^}]+)\}/g, (_, url, text) => {
    return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="text-indigo-600 hover:text-indigo-800 hover:underline font-medium">${renderInlineLatex(text, katexMacros)}</a>`;
  });
  html = html.replace(/\\url\{([^}]+)\}/g, (_, url) => {
    return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="text-indigo-600 hover:text-indigo-800 hover:underline font-mono text-xs break-all">${escapeHtml(url)}</a>`;
  });

  // Render Numbered Equations
  let renderEqIdx = 0;
  html = html.replace(/\\begin\{equation\}([\s\S]*?)\\end\{equation\}/g, (_, mathInner) => {
    const eqData = eqDataList[renderEqIdx++] || {
      id: `eq-${renderEqIdx}`,
      number: `${renderEqIdx}`,
      loc: findSourceLocation('\\begin{equation}'),
    };
    const cleanMath = mathInner.replace(/\\label\{[^}]+\}/g, '').replace(/\\tag\{[^}]+\}/g, '').trim();
    const attrs = syncAttrs(eqData.loc, `公式 (${eqData.number})`);

    let renderedMath = '';
    try {
      renderedMath = katex.renderToString(cleanMath, {
        displayMode: true,
        throwOnError: false,
        strict: false,
        trust: true,
        macros: katexMacros,
      });
    } catch {
      renderedMath = `<div class="text-red-500 font-mono">${escapeHtml(cleanMath)}</div>`;
    }

    return `
      <div id="${eqData.id}" ${attrs} class="latex-sync-node my-4 flex items-center justify-between group px-2 py-1 hover:bg-indigo-50/20 rounded transition-colors cursor-pointer border border-transparent hover:border-indigo-200">
        <div class="overflow-x-auto w-full text-center">${renderedMath}</div>
        <span class="text-slate-500 font-serif text-sm select-none pl-4 shrink-0 font-medium">(${eqData.number})</span>
      </div>
    `;
  });

  // Unnumbered and Complex Math Environments (align, gather, alignat, multline, flalign)
  const mathEnvs = 'equation\\*|align\\*?|gather\\*?|alignat\\*?|multline\\*?|flalign\\*?';
  const complexMathRegex = new RegExp(`\\\\begin\\{(${mathEnvs})\\}([\\s\\S]*?)\\\\end\\{\\1\\}`, 'g');

  html = html.replace(complexMathRegex, (_, env, mathInner) => {
    const cleanMath = `\\begin{${env}}${mathInner}\\end{${env}}`;
    const loc = findSourceLocation(`\\begin{${env}}`);
    const attrs = syncAttrs(loc, `数学环境 \\begin{${env}}`);
    return `<div ${attrs} class="latex-sync-node cursor-pointer hover:bg-slate-50/60 rounded p-1 transition-colors">${renderDisplayMath(cleanMath, katexMacros)}</div>`;
  });

  // Display math: \[...\] and $$...$$
  html = html.replace(/\\\[([\s\S]*?)\\\]/g, (_, mathInner) => {
    const loc = findSourceLocation(mathInner.slice(0, 30));
    const attrs = syncAttrs(loc, '独立公式');
    return `<div ${attrs} class="latex-sync-node cursor-pointer hover:bg-slate-50/60 rounded p-1 transition-colors">${renderDisplayMath(mathInner.trim(), katexMacros)}</div>`;
  });

  html = html.replace(/\$\$([\s\S]*?)\$\$/g, (_, mathInner) => {
    const loc = findSourceLocation(mathInner.slice(0, 30));
    const attrs = syncAttrs(loc, '独立公式');
    return `<div ${attrs} class="latex-sync-node cursor-pointer hover:bg-slate-50/60 rounded p-1 transition-colors">${renderDisplayMath(mathInner.trim(), katexMacros)}</div>`;
  });

  // Render Theorems, Proofs, Definitions
  const theoremEnvs = [
    { name: 'theorem', title: 'Theorem', cn: '定理', border: 'border-l-4 border-indigo-600 bg-indigo-50/40' },
    { name: 'lemma', title: 'Lemma', cn: '引理', border: 'border-l-4 border-blue-500 bg-blue-50/40' },
    { name: 'definition', title: 'Definition', cn: '定义', border: 'border-l-4 border-emerald-600 bg-emerald-50/40' },
    { name: 'proposition', title: 'Proposition', cn: '命题', border: 'border-l-4 border-cyan-600 bg-cyan-50/40' },
    { name: 'corollary', title: 'Corollary', cn: '推论', border: 'border-l-4 border-teal-600 bg-teal-50/40' },
    { name: 'example', title: 'Example', cn: '例', border: 'border-l-4 border-amber-500 bg-amber-50/40' },
    { name: 'remark', title: 'Remark', cn: '注', border: 'border-l-4 border-slate-400 bg-slate-50/50' },
    { name: 'note', title: 'Note', cn: '说明', border: 'border-l-4 border-purple-500 bg-purple-50/40' },
    { name: 'property', title: 'Property', cn: '性质', border: 'border-l-4 border-sky-600 bg-sky-50/40' },
    { name: 'assumption', title: 'Assumption', cn: '假设', border: 'border-l-4 border-rose-600 bg-rose-50/40' },
  ];

  let renderThmIdx = 0;
  theoremEnvs.forEach((env) => {
    const regex = new RegExp(`\\\\begin\\{${env.name}\\}(?:\\[([^\\]]*)\\])?([\\s\\S]*?)\\\\end\\{${env.name}\\}`, 'g');
    html = html.replace(regex, (_, optTitle, content) => {
      const thmData = thmDataList[renderThmIdx++] || {
        id: `thm-${renderThmIdx}`,
        number: renderThmIdx,
        loc: findSourceLocation(`\\begin{${env.name}}`),
      };
      const titleLabel = isChineseDoc ? env.cn : env.title;
      const titleText = optTitle ? ` (${optTitle})` : '';
      const attrs = syncAttrs(thmData.loc, `${titleLabel} ${thmData.number}`);
      return `
        <div id="${thmData.id}" ${attrs} class="latex-sync-node my-4 p-3.5 rounded-r-md ${env.border} cursor-pointer hover:shadow-xs transition-shadow">
          <div class="font-serif font-bold text-slate-800 mb-1 text-sm tracking-wide">
            ${titleLabel} ${thmData.number}${titleText}.
          </div>
          <div class="font-serif text-slate-700 leading-relaxed italic">
            ${parseBodyBlocks(content, katexMacros)}
          </div>
        </div>
      `;
    });
  });

  // Proof environment
  html = html.replace(/\\begin\{proof\}(?:\[([^\]]*)\])?([\s\S]*?)\\end\{proof\}/g, (_, optTitle, content) => {
    const loc = findSourceLocation('\\begin{proof}');
    const attrs = syncAttrs(loc, '证明 (Proof)');
    const proofLabel = optTitle || (isChineseDoc ? '证明' : 'Proof');
    return `
      <div ${attrs} class="latex-sync-node my-3 font-serif text-slate-700 leading-relaxed cursor-pointer hover:bg-slate-50/60 rounded p-1 transition-colors">
        <span class="font-serif italic font-semibold text-slate-900">${proofLabel}. </span>
        <span>${parseBodyBlocks(content, katexMacros)}</span>
        <span class="float-right text-slate-700 text-sm select-none">∎</span>
        <div class="clear-both"></div>
      </div>
    `;
  });

  // Render Tables: handles tabular, tabular*, tabularx, and booktabs
  let renderTableIdx = 0;
  const tableContainerRegex = /\\begin\{table\*?\}(\[[^\]]*\])?([\s\S]*?)\\end\{table\*?\}/g;
  html = html.replace(tableContainerRegex, (_, opt, content) => {
    const tData = tableDataList[renderTableIdx++] || {
      id: `tbl-${renderTableIdx}`,
      number: renderTableIdx,
      loc: findSourceLocation('\\begin{table}'),
      caption: '',
      content,
    };

    const captionMatch = content.match(/\\caption\{([^}]+)\}/);
    const captionText = captionMatch ? captionMatch[1] : tData.caption;
    const caption = captionText ? renderInlineLatex(captionText, katexMacros) : '';
    const tblId = tData.id;
    const loc = tData.loc;
    const tableAttrs = syncAttrs(loc, `表 ${tData.number}`);

    const tabularMatch = content.match(/\\begin\{(?:tabular|tabular\*|tabularx)\}(?:\{[^}]*\})?\{([^}]+)\}([\s\S]*?)\\end\{(?:tabular|tabular\*|tabularx)\}/);
    let tableHtml = '';
    if (tabularMatch) {
      tableHtml = renderTabular(tabularMatch[1], tabularMatch[2], katexMacros, (rowSnippet) => {
        const rowLoc = findSourceLocation(rowSnippet, loc);
        return syncAttrs(rowLoc, '表格行');
      });
    } else {
      tableHtml = parseBodyBlocks(content.replace(/\\caption\{[^}]+\}/g, ''), katexMacros);
    }

    const tableLabel = isChineseDoc ? '表' : 'Table';

    return `
      <div id="${tblId}" ${tableAttrs} class="latex-sync-node my-6 flex flex-col items-center cursor-pointer p-2 rounded-lg border border-transparent hover:border-indigo-300 hover:bg-indigo-50/20 transition-all group">
        ${caption ? `
          <div ${tableAttrs} class="text-sm font-serif font-medium text-slate-800 mb-2 group-hover:text-indigo-600 transition-colors">
            <strong class="font-semibold">${tableLabel} ${tData.number}</strong>: ${caption}
          </div>` : ''}
        <div class="overflow-x-auto max-w-full my-1 shadow-xs border border-slate-200 rounded bg-white">
          ${tableHtml}
        </div>
      </div>
    `;
  });

  // Standalone tabular if not wrapped in table environment
  html = html.replace(/\\begin\{(?:tabular|tabular\*|tabularx)\}(?:\{[^}]*\})?\{([^}]+)\}([\s\S]*?)\\end\{(?:tabular|tabular\*|tabularx)\}/g, (_, cols, content) => {
    const loc = findSourceLocation('\\begin{tabular');
    const attrs = syncAttrs(loc, '表格');
    return `<div ${attrs} class="latex-sync-node overflow-x-auto max-w-full my-4 shadow-xs border border-slate-200 rounded cursor-pointer">${renderTabular(cols, content, katexMacros)}</div>`;
  });

  // Render Figures (figure, figure*) and Subfigures
  let renderFigIdx = 0;
  const figContainerRegex = /\\begin\{figure\*?\}(\[[^\]]*\])?([\s\S]*?)\\end\{figure\*?\}/g;
  html = html.replace(figContainerRegex, (_, opt, content) => {
    const fData = figureDataList[renderFigIdx++] || {
      id: `fig-${renderFigIdx}`,
      number: renderFigIdx,
      loc: findSourceLocation('\\begin{figure}'),
      caption: '',
      content,
    };
    const figId = fData.id;
    const captionMatch = content.match(/\\caption\{([^}]+)\}/);
    const captionText = captionMatch ? captionMatch[1] : fData.caption;
    const caption = captionText ? renderInlineLatex(captionText, katexMacros) : '';
    const attrs = syncAttrs(fData.loc, `图 ${fData.number}`);

    // Check for \includegraphics
    const graphicMatch = content.match(/\\includegraphics(\[[^\]]*\])?\{([^}]+)\}/);
    let figureContent = '';

    if (graphicMatch) {
      const src = graphicMatch[2].trim();
      let matchingFile: FileItem | undefined;
      if (options.files) {
        for (const file of Object.values(options.files)) {
          if (file.name === src || file.path.endsWith(`/${src}`)) {
            matchingFile = file;
            break;
          }
        }
      }

      if (matchingFile && matchingFile.type === 'svg' && matchingFile.content) {
        figureContent = `
          <div class="w-full max-w-md p-2 bg-white rounded flex justify-center items-center shadow-xs">
            ${matchingFile.content}
          </div>
        `;
      } else {
        figureContent = `
          <div class="w-full max-w-md p-5 bg-slate-50 border border-dashed border-slate-300 rounded flex flex-col items-center justify-center text-slate-500">
            <svg class="w-12 h-12 text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span class="text-xs font-mono text-slate-700 font-semibold">${src}</span>
            <span class="text-[11px] text-slate-400 mt-1">[LaTeX 矢量插图 / 图像图元]</span>
          </div>
        `;
      }
    } else {
      figureContent = `<div class="p-6 bg-slate-50 border border-slate-200 rounded text-center text-slate-600 font-serif">${parseBodyBlocks(content.replace(/\\caption\{[^}]+\}/g, ''), katexMacros)}</div>`;
    }

    const figLabel = isChineseDoc ? '图' : 'Figure';

    return `
      <div id="${figId}" ${attrs} class="latex-sync-node my-6 flex flex-col items-center cursor-pointer p-2 rounded hover:bg-slate-50/50 transition-colors">
        ${figureContent}
        ${caption ? `<div ${attrs} class="text-sm font-serif font-medium text-slate-700 mt-2"><strong>${figLabel} ${fData.number}</strong>: ${caption}</div>` : ''}
      </div>
    `;
  });

  // Render Algorithms (algorithm, algorithm*)
  let renderAlgIdx = 0;
  const algContainerRegex = /\\begin\{algorithm\*?\}(\[[^\]]*\])?([\s\S]*?)\\end\{algorithm\*?\}/g;
  html = html.replace(algContainerRegex, (_, opt, content) => {
    const aData = algDataList[renderAlgIdx++] || {
      id: `alg-${renderAlgIdx}`,
      number: renderAlgIdx,
      loc: findSourceLocation('\\begin{algorithm}'),
      caption: '',
      content,
    };
    const capMatch = content.match(/\\caption\{([^}]+)\}/);
    const captionText = capMatch ? capMatch[1] : aData.caption;
    const caption = captionText ? renderInlineLatex(captionText, katexMacros) : '';
    const algAttrs = syncAttrs(aData.loc, `算法 ${aData.number}`);

    return renderAlgorithmBox(
      aData.id,
      aData.number,
      caption,
      content,
      isChineseDoc,
      katexMacros,
      algAttrs,
      (snippet) => syncAttrs(findSourceLocation(snippet, aData.loc), '算法步骤')
    );
  });

  // Standalone algorithmic if not wrapped in algorithm environment
  html = html.replace(/\\begin\{(?:algorithmic|algorithmicx)\}(?:\[\d+\])?([\s\S]*?)\\end\{(?:algorithmic|algorithmicx)\}/g, (_, content) => {
    const loc = findSourceLocation('\\begin{algorithmic}');
    const attrs = syncAttrs(loc, '算法伪代码');
    return renderAlgorithmicLines(content, isChineseDoc, katexMacros, (s) => syncAttrs(findSourceLocation(s, loc), '算法步骤'), attrs);
  });

  // Render TikZ vector diagrams
  let tikzIdx = 0;
  const tikzRegex = /\\begin\{tikzpicture\}(\[[^\]]*\])?([\s\S]*?)\\end\{tikzpicture\}/g;
  html = html.replace(tikzRegex, (_, opts, content) => {
    tikzIdx++;
    const loc = findSourceLocation('\\begin{tikzpicture}');
    const attrs = syncAttrs(loc, `TikZ 绘图 #${tikzIdx}`);
    return renderTikzPicture(tikzIdx, opts || '', content, katexMacros, attrs);
  });

  // Render tcolorbox
  let boxIdx = 0;
  html = html.replace(/\\begin\{tcolorbox\}(?:\[([^\]]*)\])?([\s\S]*?)\\end\{tcolorbox\}/g, (_, opts, content) => {
    boxIdx++;
    const loc = findSourceLocation('\\begin{tcolorbox}');
    const attrs = syncAttrs(loc, `文本框 ${boxIdx}`);
    let title = '';
    if (opts) {
      const tMatch = opts.match(/title=\{?([^,\]\}]+)\}?/);
      if (tMatch) title = tMatch[1].trim();
    }
    return `
      <div ${attrs} class="latex-sync-node my-4 rounded-md border border-slate-300 bg-slate-50/60 overflow-hidden shadow-2xs">
        ${title ? `<div class="bg-slate-200/80 px-3.5 py-1.5 font-serif font-bold text-xs text-slate-800 border-b border-slate-300">${renderInlineLatex(title, katexMacros)}</div>` : ''}
        <div class="p-3.5 font-serif text-slate-700 text-sm leading-relaxed">${parseBodyBlocks(content, katexMacros)}</div>
      </div>
    `;
  });

  // Lists: itemize and enumerate
  html = renderLists(html, katexMacros, (snippet) => {
    const loc = findSourceLocation(snippet);
    return syncAttrs(loc, '列表项');
  });

  // Code blocks: verbatim, lstlisting, minted
  html = html.replace(/\\begin\{(verbatim|lstlisting|minted)\}(?:\{[^}]*\})?(?:\[[^\]]*\])?([\s\S]*?)\\end\{\1\}/g, (_, tag, code) => {
    const loc = findSourceLocation(`\\begin{${tag}}`);
    const attrs = syncAttrs(loc, `代码块 \\begin{${tag}}`);
    return `
      <pre ${attrs} class="latex-sync-node my-4 p-4 rounded-md bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800 shadow-inner cursor-pointer"><code>${escapeHtml(code.trim())}</code></pre>
    `;
  });

  // Quotes
  html = html.replace(/\\begin\{quote\}([\s\S]*?)\\end\{quote\}/g, (_, quoteContent) => {
    const loc = findSourceLocation('\\begin{quote}');
    const attrs = syncAttrs(loc, '引用段落');
    return `
      <blockquote ${attrs} class="latex-sync-node my-4 pl-4 border-l-4 border-slate-300 italic font-serif text-slate-700 text-sm leading-relaxed cursor-pointer hover:border-indigo-400 transition-colors">
        ${parseBodyBlocks(quoteContent, katexMacros)}
      </blockquote>
    `;
  });

  // Headings: chapter, section, subsection, subsubsection
  secDataList.forEach((sData) => {
    const escapedTitle = sData.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const starPart = sData.isStarred ? '\\*' : '';
    const hRegex = new RegExp(`\\\\${sData.type}${starPart}\\{${escapedTitle}\\}`, 'g');

    html = html.replace(hRegex, () => {
      const cleanT = renderInlineLatex(sData.title, katexMacros);
      const level = sData.type === 'chapter' ? 0 : sData.type === 'section' ? 1 : sData.type === 'subsection' ? 2 : 3;

      if (!sData.isStarred) {
        toc.push({ id: sData.id, title: `${sData.number} ${stripHtml(cleanT)}`, level: Math.max(1, level) });
      }

      const attrs = syncAttrs(sData.loc, `${sData.type} ${sData.number}`);

      if (sData.type === 'chapter') {
        return `
          <h1 id="${sData.id}" ${attrs} class="latex-sync-node text-2xl sm:text-3xl font-serif font-bold text-slate-900 mt-10 mb-4 pb-2 border-b-2 border-slate-800 flex items-baseline gap-2 cursor-pointer hover:text-indigo-700 transition-colors">
            ${sData.number ? `<span class="text-slate-600 font-semibold">${sData.number}</span>` : ''}
            <span>${cleanT}</span>
          </h1>
        `;
      }

      if (sData.type === 'section') {
        return `
          <h2 id="${sData.id}" ${attrs} class="latex-sync-node text-xl font-serif font-bold text-slate-900 mt-8 mb-3 pb-1 border-b border-slate-200 flex items-baseline gap-2 group cursor-pointer hover:text-indigo-700 transition-colors">
            ${sData.number ? `<span class="text-slate-500 font-semibold">${sData.number}.</span>` : ''}
            <span>${cleanT}</span>
          </h2>
        `;
      }

      if (sData.type === 'subsection') {
        return `
          <h3 id="${sData.id}" ${attrs} class="latex-sync-node text-lg font-serif font-bold text-slate-800 mt-6 mb-2 flex items-baseline gap-2 cursor-pointer hover:text-indigo-700 transition-colors">
            ${sData.number ? `<span class="text-slate-500 font-medium">${sData.number}</span>` : ''}
            <span>${cleanT}</span>
          </h3>
        `;
      }

      return `
        <h4 id="${sData.id}" ${attrs} class="latex-sync-node text-base font-serif font-semibold text-slate-800 mt-4 mb-2 flex items-baseline gap-2 cursor-pointer hover:text-indigo-700 transition-colors">
          ${sData.number ? `<span class="text-slate-400 font-normal">${sData.number}</span>` : ''}
          <span>${cleanT}</span>
        </h4>
      `;
    });
  });

  html = html.replace(/\\paragraph\{([^}]+)\}/g, (_, pTitle) => {
    const loc = findSourceLocation(`\\paragraph{${pTitle}`);
    const attrs = syncAttrs(loc, `段落标题 \\paragraph{${pTitle}}`);
    return `<h5 ${attrs} class="latex-sync-node font-serif font-bold text-slate-800 mt-3 mb-1 text-sm cursor-pointer hover:text-indigo-700 transition-colors">${renderInlineLatex(pTitle, katexMacros)}</h5>`;
  });

  // Bibliography Environment
  const refTitle = isChineseDoc ? '参考文献' : 'References';
  html = html.replace(/\\begin\{thebibliography\}\{[^}]*\}([\s\S]*?)\\end\{thebibliography\}/g, () => {
    if (Object.keys(bibItems).length === 0) return '';
    let bibList = '';
    for (const [key, item] of Object.entries(bibItems)) {
      const loc = item.loc || findSourceLocation(key);
      const attrs = syncAttrs(loc, `参考文献 [${item.number}] ${key}`);
      bibList += `
        <li id="bib-${key}" ${attrs} class="latex-sync-node mb-2 pl-1 leading-relaxed text-xs font-serif text-slate-700 cursor-pointer hover:bg-slate-50 rounded p-1 transition-colors">
          <span class="font-bold text-slate-900 mr-1">[${item.number}]</span>
          <span>${renderInlineLatex(item.text, katexMacros)}</span>
        </li>
      `;
    }
    return `
      <div class="mt-12 pt-6 border-t border-slate-300">
        <h3 class="text-lg font-serif font-bold text-slate-900 mb-4">${refTitle}</h3>
        <ol class="list-none space-y-1">
          ${bibList}
        </ol>
      </div>
    `;
  });

  if (!html.includes(refTitle) && Object.keys(bibItems).length > 0 && bodyContent.includes('\\cite')) {
    let bibList = '';
    for (const [key, item] of Object.entries(bibItems)) {
      const loc = item.loc || findSourceLocation(key);
      const attrs = syncAttrs(loc, `参考文献 [${item.number}] ${key}`);
      bibList += `
        <li id="bib-${key}" ${attrs} class="latex-sync-node mb-2 pl-1 leading-relaxed text-xs font-serif text-slate-700 cursor-pointer hover:bg-slate-50 rounded p-1 transition-colors">
          <span class="font-bold text-slate-900 mr-1">[${item.number}]</span>
          <span>${renderInlineLatex(item.text, katexMacros)}</span>
        </li>
      `;
    }
    html += `
      <div class="mt-12 pt-6 border-t border-slate-300">
        <h3 class="text-lg font-serif font-bold text-slate-900 mb-4">${refTitle}</h3>
        <ol class="list-none space-y-1">
          ${bibList}
        </ol>
      </div>
    `;
  }

  // Keywords block
  let keywordsHtml = '';
  if (keywords) {
    const kwLabel = isChineseDoc ? '关键词：' : 'Key words: ';
    keywordsHtml = `
      <div class="mt-3 text-xs font-serif text-slate-700">
        <strong>${kwLabel}</strong>${renderInlineLatex(keywords, katexMacros)}
      </div>
    `;
  }

  // Paragraph formatting
  const paragraphs = html
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const formattedHtml = paragraphs
    .map((p) => {
      if (/^<(div|h1|h2|h3|h4|h5|pre|blockquote|ol|ul|table)/.test(p)) {
        return renderInlineLatex(p, katexMacros);
      }
      const rawSnippet = p.replace(/<[^>]*>/g, '').replace(/\\[a-zA-Z]+/g, '').trim().slice(0, 30);
      const loc = findSourceLocation(rawSnippet || p.slice(0, 30));
      const attrs = syncAttrs(loc, '正文段落');
      return `<p ${attrs} class="latex-sync-node my-2.5 font-serif text-slate-800 text-[15px] leading-[1.75] text-justify indent-6 cursor-pointer hover:bg-slate-50/40 rounded p-0.5 transition-colors">${renderInlineLatex(p, katexMacros)}</p>`;
    })
    .join('\n');

  // Footnotes
  let finalHtml = formattedHtml;
  if (footnotes.length > 0) {
    const fnList = footnotes
      .map(
        (fn) => `
      <div class="text-xs text-slate-600 font-serif mb-1 flex items-baseline gap-1.5">
        <span class="text-indigo-600 font-semibold">[${fn.id}]</span>
        <span>${fn.text}</span>
      </div>
    `
      )
      .join('');

    finalHtml += `
      <div class="mt-10 pt-4 border-t border-slate-200">
        ${fnList}
      </div>
    `;
  }

  let finalAbstract = abstract ? renderInlineLatex(abstract, katexMacros) : '';
  if (keywordsHtml && finalAbstract) {
    finalAbstract += keywordsHtml;
  }

  const duration = Math.round((performance.now() - startTime) * 10) / 10;
  const rawCharCount = finalHtml.replace(/<[^>]*>/g, '').length;
  const pageCountEstimate = Math.max(1, Math.ceil(rawCharCount / 1800));

  return {
    html: finalHtml,
    title: title || '未命名 LaTeX 文档',
    titleLoc,
    authors: authors.length > 0 ? authors : ['LaTeX Author'],
    authorsLoc,
    date: date || '2026',
    abstract: finalAbstract,
    abstractLoc,
    diagnostics,
    compileTimeMs: duration,
    toc,
    pageCountEstimate,
    engine: detectedEngine,
  };
}

// Check syntax diagnostics (respects comments and special XeLaTeX/pdfLaTeX packages)
function checkDiagnostics(source: string, diagnostics: Diagnostic[]) {
  const lines = source.split('\n');
  const envStack: { name: string; line: number }[] = [];

  // Ignore list for environments that don't need strict matching or are handled specially
  const ignoredEnvs = new Set([
    'document',
    'CJK',
    'CJK*',
    'comment',
    'algorithm',
    'algorithm*',
    'algorithmic',
    'algorithmicx',
    'algorithm2e',
    'tikzpicture',
    'pgfplots',
    'circuitikz',
    'tcolorbox',
    'subfigure',
    'subtable',
    'lstlisting',
    'minted',
  ]);

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const rawLine = lines[i];

    // Strip comments accurately without breaking \%
    let commentIdx = -1;
    for (let ci = 0; ci < rawLine.length; ci++) {
      if (rawLine[ci] === '%') {
        let bsCount = 0;
        let cj = ci - 1;
        while (cj >= 0 && rawLine[cj] === '\\') {
          bsCount++;
          cj--;
        }
        if (bsCount % 2 === 0) {
          commentIdx = ci;
          break;
        }
      }
    }
    const codePart = commentIdx !== -1 ? rawLine.substring(0, commentIdx) : rawLine;

    // Check \begin and \end
    const beginMatches = [...codePart.matchAll(/\\begin\{([a-zA-Z*0-9]+)\}/g)];
    for (const m of beginMatches) {
      if (!ignoredEnvs.has(m[1])) {
        envStack.push({ name: m[1], line: lineNum });
      }
    }

    const endMatches = [...codePart.matchAll(/\\end\{([a-zA-Z*0-9]+)\}/g)];
    for (const m of endMatches) {
      const endName = m[1];
      if (ignoredEnvs.has(endName)) continue;

      if (envStack.length === 0) {
        diagnostics.push({
          line: lineNum,
          message: `多余的闭合环境 \\end{${endName}}，没有对应的 \\begin`,
          type: 'error',
        });
      } else {
        const last = envStack.pop();
        if (last && last.name !== endName) {
          diagnostics.push({
            line: lineNum,
            message: `环境不匹配: \\begin{${last.name}} (第 ${last.line} 行) 与 \\end{${endName}} (第 ${lineNum} 行)`,
            type: 'error',
          });
        }
      }
    }

    // Mathematical $ count check (ignoring \$ and verbatim)
    if (!codePart.includes('verb') && !codePart.includes('lstinline')) {
      const dollarMatches = [...codePart.matchAll(/(^|[^\\])\$/g)];
      if (dollarMatches.length % 2 !== 0 && !codePart.includes('$$')) {
        diagnostics.push({
          line: lineNum,
          message: `本行可能存在未闭合的数学公式符号 $`,
          type: 'warning',
        });
      }
    }

    // Common typo
    if (/\\beign\{/.test(codePart)) {
      diagnostics.push({
        line: lineNum,
        message: `拼写错误: \\beign 应为 \\begin`,
        type: 'error',
      });
    }
  }

  while (envStack.length > 0) {
    const unclosed = envStack.pop();
    if (unclosed && !ignoredEnvs.has(unclosed.name)) {
      diagnostics.push({
        line: unclosed.line,
        message: `未闭合的环境: \\begin{${unclosed.name}} (第 ${unclosed.line} 行缺少 \\end{${unclosed.name}})`,
        type: 'error',
      });
    }
  }
}

// Display math renderer using KaTeX
function renderDisplayMath(math: string, macros?: Record<string, any>): string {
  try {
    const rendered = katex.renderToString(math, {
      displayMode: true,
      throwOnError: false,
      strict: false,
      trust: true,
      macros: macros || BUILTIN_KATEX_MACROS,
    });
    return `<div class="my-4 overflow-x-auto py-2 text-center select-text">${rendered}</div>`;
  } catch {
    return `<div class="my-3 p-2 bg-red-50 text-red-700 font-mono text-xs rounded border border-red-200">数学公式渲染错误: ${escapeHtml(math)}</div>`;
  }
}

// Inline LaTeX & Math renderer
export function renderInlineLatex(text: string, macros?: Record<string, any>): string {
  let res = text;
  const effectiveMacros = macros || BUILTIN_KATEX_MACROS;

  // Math formulas $...$ or \(...\)
  res = res.replace(/(^|[^\\])\$([^\$]+)\$/g, (_, prefix, math) => {
    try {
      const rendered = katex.renderToString(math.trim(), {
        displayMode: false,
        throwOnError: false,
        strict: false,
        trust: true,
        macros: effectiveMacros,
      });
      return `${prefix}${rendered}`;
    } catch {
      return `${prefix}<span class="text-red-500">$${math}$</span>`;
    }
  });

  res = res.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => {
    try {
      const rendered = katex.renderToString(math.trim(), {
        displayMode: false,
        throwOnError: false,
        strict: false,
        trust: true,
        macros: effectiveMacros,
      });
      return rendered;
    } catch {
      return `<span class="text-red-500">${math}</span>`;
    }
  });

  // Text styling
  res = res.replace(/\\textbf\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/g, '<strong>$1</strong>');
  res = res.replace(/\\textit\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/g, '<em>$1</em>');
  res = res.replace(/\\emph\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/g, '<em>$1</em>');
  res = res.replace(/\\underline\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/g, '<u>$1</u>');
  res = res.replace(/\\texttt\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/g, '<code class="bg-slate-100 text-slate-800 px-1 py-0.5 rounded text-[13px] font-mono">$1</code>');
  res = res.replace(/\\textsc\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/g, '<span class="uppercase tracking-wider text-xs font-semibold">$1</span>');
  res = res.replace(/\\textsf\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/g, '<span class="font-sans">$1</span>');

  // XeLaTeX & CTeX Chinese font styles
  res = res.replace(/\\kaishu\{([^}]+)\}/g, '<span class="font-serif italic text-slate-800">$1</span>');
  res = res.replace(/\\heiti\{([^}]+)\}/g, '<strong class="font-sans font-bold text-slate-900">$1</strong>');
  res = res.replace(/\\songti\{([^}]+)\}/g, '<span class="font-serif text-slate-800">$1</span>');
  res = res.replace(/\\fangsong\{([^}]+)\}/g, '<span class="font-serif text-slate-700">$1</span>');

  // Font sizes
  res = res.replace(/\\Huge\s+([^\\$]+)/g, '<span class="text-3xl font-serif font-bold">$1</span>');
  res = res.replace(/\\huge\s+([^\\$]+)/g, '<span class="text-2xl font-serif font-bold">$1</span>');
  res = res.replace(/\\LARGE\s+([^\\$]+)/g, '<span class="text-xl font-serif font-semibold">$1</span>');
  res = res.replace(/\\Large\s+([^\\$]+)/g, '<span class="text-lg font-serif font-semibold">$1</span>');
  res = res.replace(/\\large\s+([^\\$]+)/g, '<span class="text-base font-serif font-medium">$1</span>');
  res = res.replace(/\\small\s+([^\\$]+)/g, '<span class="text-sm font-serif">$1</span>');
  res = res.replace(/\\footnotesize\s+([^\\$]+)/g, '<span class="text-xs font-serif text-slate-600">$1</span>');
  res = res.replace(/\\scriptsize\s+([^\\$]+)/g, '<span class="text-[11px] font-serif text-slate-500">$1</span>');
  res = res.replace(/\\tiny\s+([^\\$]+)/g, '<span class="text-[10px] font-serif text-slate-400">$1</span>');

  // Text color
  res = res.replace(/\\textcolor\{([^}]+)\}\{([^}]+)\}/g, (_, color, content) => {
    const colMap: Record<string, string> = {
      red: 'text-red-600',
      blue: 'text-blue-600',
      green: 'text-emerald-600',
      gray: 'text-slate-500',
      purple: 'text-purple-600',
      orange: 'text-amber-600',
      black: 'text-slate-900',
    };
    const cClass = colMap[color.toLowerCase()] || 'text-slate-800';
    return `<span class="${cClass}">${content}</span>`;
  });

  // SI units & quantities: \SI{100}{\meter\per\second}, \si{\kilo\gram}, \num{1.23e-4}
  res = res.replace(/\\SI\{([^}]+)\}\{([^}]+)\}/g, (_, val, unit) => {
    const cleanUnit = unit
      .replace(/\\per\b/g, '/')
      .replace(/\\meter\b/g, 'm')
      .replace(/\\second\b/g, 's')
      .replace(/\\kilo\b/g, 'k')
      .replace(/\\gram\b/g, 'g')
      .replace(/\\volt\b/g, 'V')
      .replace(/\\ampere\b/g, 'A')
      .replace(/\\watt\b/g, 'W')
      .replace(/\\joule\b/g, 'J')
      .replace(/\\newton\b/g, 'N')
      .replace(/\\hertz\b/g, 'Hz')
      .replace(/\\[a-zA-Z]+/g, '');
    return `${val} ${cleanUnit}`;
  });
  res = res.replace(/\\si\{([^}]+)\}/g, (_, unit) => {
    const cleanUnit = unit
      .replace(/\\per\b/g, '/')
      .replace(/\\meter\b/g, 'm')
      .replace(/\\second\b/g, 's')
      .replace(/\\kilo\b/g, 'k')
      .replace(/\\gram\b/g, 'g')
      .replace(/\\[a-zA-Z]+/g, '');
    return cleanUnit;
  });
  res = res.replace(/\\num\{([^}]+)\}/g, '$1');

  // Colorbox: \colorbox{color}{text}
  res = res.replace(/\\colorbox\{([^}]+)\}\{([^}]+)\}/g, '<span class="bg-amber-100 text-slate-900 px-1 py-0.5 rounded text-sm">$2</span>');

  // Clean escapes
  res = res.replace(/\\%/g, '%');
  res = res.replace(/\\&/g, '&amp;');
  res = res.replace(/\\#/g, '#');
  res = res.replace(/\\_/g, '_');
  res = res.replace(/\\{/g, '{');
  res = res.replace(/\\}/g, '}');
  res = res.replace(/\\~/g, '~');
  res = res.replace(/\\\\/g, '<br/>');
  res = res.replace(/\\newline/g, '<br/>');
  res = res.replace(/\\quad/g, '&emsp;');
  res = res.replace(/\\qquad/g, '&emsp;&emsp;');
  res = res.replace(/\\par/g, '</p><p class="my-2.5 font-serif text-slate-800 text-[15px] leading-[1.75] text-justify indent-6">');

  return res;
}

// Tabular renderer: handles alignment, booktabs (\toprule, \midrule, \bottomrule), \multicolumn, \multirow
function renderTabular(
  colDef: string,
  content: string,
  macros?: Record<string, any>,
  syncRowAttrs?: (rowSnippet: string) => string
): string {
  const cleanContent = content.trim();
  const rows = cleanContent.split(/\\\\/);
  const colAligns = colDef.replace(/[^lcrX]/g, '').split('');

  let tableHtml = '<table class="w-full text-left font-serif text-sm border-collapse">';
  let isHeader = true;

  for (let rIdx = 0; rIdx < rows.length; rIdx++) {
    let rawRow = rows[rIdx].trim();
    if (!rawRow) continue;

    let hasTopRule = false;
    let hasMidRule = false;
    let hasBottomRule = false;

    if (rawRow.includes('\\toprule')) {
      hasTopRule = true;
      rawRow = rawRow.replace(/\\toprule/g, '').trim();
    }
    if (rawRow.includes('\\midrule')) {
      hasMidRule = true;
      rawRow = rawRow.replace(/\\midrule/g, '').trim();
    }
    if (rawRow.includes('\\bottomrule')) {
      hasBottomRule = true;
      rawRow = rawRow.replace(/\\bottomrule/g, '').trim();
    }
    if (rawRow.includes('\\hline')) {
      if (isHeader) hasTopRule = true;
      else hasMidRule = true;
      rawRow = rawRow.replace(/\\hline/g, '').trim();
    }
    rawRow = rawRow.replace(/\\cmidrule(\([^)]*\))?\{[^}]*\}/g, '').trim();

    if (!rawRow) continue;

    const cells = rawRow.split('&').map((c) => c.trim());
    const tag = isHeader ? 'th' : 'td';

    let borderClass = 'border-b border-slate-200';
    if (hasTopRule) borderClass += ' border-t-2 border-slate-900';
    if (hasMidRule) borderClass += ' border-b border-slate-400';
    if (hasBottomRule || rIdx === rows.length - 1) borderClass += ' border-b-2 border-slate-900';

    const bgClass = isHeader ? 'bg-slate-100 font-bold' : 'hover:bg-slate-50/60';
    const rowAttrs = syncRowAttrs ? syncRowAttrs(rawRow) : '';

    let rowHtml = `<tr ${rowAttrs} class="${borderClass} ${bgClass} transition-colors">`;

    let colIdx = 0;
    for (const cell of cells) {
      // Check \multicolumn{cols}{align}{content}
      const mcMatch = cell.match(/\\multicolumn\{(\d+)\}\{([^}]*)\}\{((?:[^{}]*|\{[^{}]*\})*)\}/);
      if (mcMatch) {
        const spanCols = parseInt(mcMatch[1], 10);
        const mcAlign = mcMatch[2].includes('c') ? 'text-center' : mcMatch[2].includes('r') ? 'text-right' : 'text-left';
        const innerContent = mcMatch[3];
        rowHtml += `<${tag} colspan="${spanCols}" class="px-3.5 py-2 ${mcAlign}">${renderInlineLatex(innerContent, macros)}</${tag}>`;
        colIdx += spanCols;
        continue;
      }

      // Check \multirow{rows}{width}{content}
      const mrMatch = cell.match(/\\multirow\{(\d+)\}\{([^}]*)\}\{((?:[^{}]*|\{[^{}]*\})*)\}/);
      if (mrMatch) {
        const spanRows = parseInt(mrMatch[1], 10);
        const innerContent = mrMatch[3];
        const align = colAligns[colIdx] === 'c' ? 'text-center' : colAligns[colIdx] === 'r' ? 'text-right' : 'text-left';
        rowHtml += `<${tag} rowspan="${spanRows}" class="px-3.5 py-2 ${align}">${renderInlineLatex(innerContent, macros)}</${tag}>`;
        colIdx++;
        continue;
      }

      const align = colAligns[colIdx] === 'c' ? 'text-center' : colAligns[colIdx] === 'r' ? 'text-right' : 'text-left';
      rowHtml += `<${tag} class="px-3.5 py-2 ${align}">${renderInlineLatex(cell, macros)}</${tag}>`;
      colIdx++;
    }

    rowHtml += '</tr>';
    tableHtml += rowHtml;
    isHeader = false;
  }

  tableHtml += '</table>';
  return tableHtml;
}

// Lists renderer (itemize and enumerate)
function renderLists(text: string, macros?: Record<string, any>, syncAttrs?: (snippet: string) => string): string {
  let res = text;

  res = res.replace(/\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/g, (_, content) => {
    const items = content.split(/\\item\s+/).filter(Boolean);
    const lis = items
      .map((it: string) => {
        const attrs = syncAttrs ? syncAttrs(it.slice(0, 30)) : '';
        return `<li ${attrs} class="latex-sync-node my-1.5 font-serif text-[14.5px] leading-relaxed cursor-pointer hover:text-indigo-600 transition-colors">${renderInlineLatex(it.trim(), macros)}</li>`;
      })
      .join('');
    return `<ul class="list-disc pl-6 my-3 space-y-1 text-slate-800">${lis}</ul>`;
  });

  res = res.replace(/\\begin\{enumerate\}([\s\S]*?)\\end\{enumerate\}/g, (_, content) => {
    const items = content.split(/\\item\s+/).filter(Boolean);
    const lis = items
      .map((it: string) => {
        const attrs = syncAttrs ? syncAttrs(it.slice(0, 30)) : '';
        return `<li ${attrs} class="latex-sync-node my-1.5 font-serif text-[14.5px] leading-relaxed cursor-pointer hover:text-indigo-600 transition-colors">${renderInlineLatex(it.trim(), macros)}</li>`;
      })
      .join('');
    return `<ol class="list-decimal pl-6 my-3 space-y-1 text-slate-800">${lis}</ol>`;
  });

  return res;
}

function parseBodyBlocks(content: string, macros?: Record<string, any>): string {
  return renderInlineLatex(content.trim(), macros);
}

function stripLatexCommands(str: string): string {
  return str
    .replace(/\\[a-zA-Z]+(\[[^\]]*\])?(\{([^}]*)\})?/g, '$3')
    .replace(/[{}]/g, '')
    .trim();
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>?/gm, '');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Algorithm box renderer
function renderAlgorithmBox(
  id: string,
  number: number,
  caption: string,
  content: string,
  isChineseDoc: boolean,
  macros: Record<string, any> | undefined,
  attrs: string,
  syncRowAttrs?: (snippet: string) => string
): string {
  const algLabel = isChineseDoc ? '算法' : 'Algorithm';
  const cleanContent = content.replace(/\\caption\{[^}]*\}/g, '').replace(/\\label\{[^}]*\}/g, '').trim();

  let bodyContent = cleanContent;
  const algMatch = cleanContent.match(/\\begin\{(?:algorithmic|algorithmicx)\}(?:\[\d+\])?([\s\S]*?)\\end\{(?:algorithmic|algorithmicx)\}/);
  if (algMatch) {
    bodyContent = algMatch[1].trim();
  }

  const linesHtml = renderAlgorithmicLines(bodyContent, isChineseDoc, macros, syncRowAttrs);

  return `
    <div id="${id}" ${attrs} class="latex-sync-node my-6 border-t-2 border-b-2 border-slate-900 bg-white p-3 font-serif select-text shadow-2xs cursor-pointer hover:border-indigo-400 transition-colors">
      <div class="border-b border-slate-800 pb-2 mb-2.5 flex items-baseline justify-between">
        <div class="text-sm font-bold text-slate-900 tracking-wide">
          <strong class="font-bold">${algLabel} ${number}</strong>${caption ? `: ${caption}` : ''}
        </div>
        <span class="text-xs font-mono text-slate-400 select-none">#${id}</span>
      </div>
      ${linesHtml}
    </div>
  `;
}

// Algorithmic lines renderer
function renderAlgorithmicLines(
  content: string,
  isChineseDoc: boolean,
  macros: Record<string, any> | undefined,
  syncRowAttrs?: (snippet: string) => string,
  wrapperAttrs: string = ''
): string {
  const rawLines = content.split('\n').map((l) => l.trim()).filter(Boolean);

  const headerLines: { label: string; text: string; raw: string }[] = [];
  const codeLines: { num: number | null; indent: number; text: string; raw: string }[] = [];
  let lineNumber = 0;
  let indentLevel = 0;

  for (const rawLine of rawLines) {
    // 1. Require / Ensure / Input / Output
    const reqMatch = rawLine.match(/^\\(?:Require|REQUIRE|Input|KwIn)\s*(.*)/i);
    if (reqMatch) {
      headerLines.push({
        label: isChineseDoc ? '输入：' : 'Require:',
        text: reqMatch[1],
        raw: rawLine,
      });
      continue;
    }

    const ensMatch = rawLine.match(/^\\(?:Ensure|ENSURE|Output|KwOut|KwResult)\s*(.*)/i);
    if (ensMatch) {
      headerLines.push({
        label: isChineseDoc ? '输出：' : 'Ensure:',
        text: ensMatch[1],
        raw: rawLine,
      });
      continue;
    }

    // 2. Control flow keywords adjusting indent
    if (/^\\(?:EndIf|EndFor|EndWhile|EndFunction|EndProcedure|Until)\b/i.test(rawLine)) {
      indentLevel = Math.max(0, indentLevel - 1);
    } else if (/^\\(?:Else|ElseIf)\b/i.test(rawLine)) {
      indentLevel = Math.max(0, indentLevel - 1);
    }

    const currentIndent = indentLevel;

    if (/^\\(?:If|For|ForAll|While|Repeat|Function|Procedure)\b/i.test(rawLine)) {
      indentLevel++;
    } else if (/^\\(?:Else|ElseIf)\b/i.test(rawLine)) {
      indentLevel++;
    }

    const isNumbered = !rawLine.startsWith('\\Statex') && !rawLine.startsWith('\\tcc') && !rawLine.startsWith('\\tcp');
    if (isNumbered) {
      lineNumber++;
    }

    let formatted = rawLine
      .replace(/^\\Statex\s*/, '')
      .replace(/^\\State\s*/, '')
      .replace(/\\If\{((?:[^{}]*|\{[^{}]*\})*)\}/g, (_, cond) => `<strong>if</strong> ${cond} <strong>then</strong>`)
      .replace(/\\ElseIf\{((?:[^{}]*|\{[^{}]*\})*)\}/g, (_, cond) => `<strong>else if</strong> ${cond} <strong>then</strong>`)
      .replace(/\\Else\b/g, '<strong>else</strong>')
      .replace(/\\EndIf\b/g, '<strong>end if</strong>')
      .replace(/\\For\{((?:[^{}]*|\{[^{}]*\})*)\}/g, (_, cond) => `<strong>for</strong> ${cond} <strong>do</strong>`)
      .replace(/\\ForAll\{((?:[^{}]*|\{[^{}]*\})*)\}/g, (_, cond) => `<strong>for all</strong> ${cond} <strong>do</strong>`)
      .replace(/\\EndFor\b/g, '<strong>end for</strong>')
      .replace(/\\While\{((?:[^{}]*|\{[^{}]*\})*)\}/g, (_, cond) => `<strong>while</strong> ${cond} <strong>do</strong>`)
      .replace(/\\EndWhile\b/g, '<strong>end while</strong>')
      .replace(/\\Repeat\b/g, '<strong>repeat</strong>')
      .replace(/\\Until\{((?:[^{}]*|\{[^{}]*\})*)\}/g, (_, cond) => `<strong>until</strong> ${cond}`)
      .replace(/\\Function\{([^}]+)\}\{([^}]+)\}/g, (_, name, args) => `<strong>function</strong> <span class="font-mono uppercase text-xs">${name}</span>(${args})`)
      .replace(/\\EndFunction\b/g, '<strong>end function</strong>')
      .replace(/\\Procedure\{([^}]+)\}\{([^}]+)\}/g, (_, name, args) => `<strong>procedure</strong> <span class="font-mono uppercase text-xs">${name}</span>(${args})`)
      .replace(/\\EndProcedure\b/g, '<strong>end procedure</strong>')
      .replace(/\\Return\b\s*(.*)/g, (_, val) => `<strong>return</strong> ${val}`)
      .replace(/\\Comment\{([^}]+)\}/g, (_, c) => `<span class="text-slate-400 font-mono text-xs italic ml-3">\\triangleright ${c}</span>`)
      .replace(/\\tcc\{([^}]+)\}/g, (_, c) => `<span class="text-slate-400 font-mono text-xs italic">/* ${c} */</span>`)
      .replace(/\\tcp\{([^}]+)\}/g, (_, c) => `<span class="text-slate-400 font-mono text-xs italic">// ${c}</span>`)
      .replace(/\\textbf\{([^}]+)\}/g, '<strong>$1</strong>');

    codeLines.push({
      num: isNumbered ? lineNumber : null,
      indent: currentIndent,
      text: formatted,
      raw: rawLine,
    });
  }

  let html = `<div ${wrapperAttrs} class="space-y-0.5 font-serif text-[13.5px] leading-relaxed">`;

  if (headerLines.length > 0) {
    html += `<div class="space-y-1 pb-2 mb-2 border-b border-slate-200">`;
    for (const h of headerLines) {
      const lineAttrs = syncRowAttrs ? syncRowAttrs(h.raw) : '';
      html += `
        <div ${lineAttrs} class="latex-sync-node flex items-baseline hover:bg-indigo-50/30 rounded px-1 transition-colors">
          <span class="font-bold text-slate-900 mr-2 shrink-0">${h.label}</span>
          <span class="text-slate-800">${renderInlineLatex(h.text, macros)}</span>
        </div>
      `;
    }
    html += `</div>`;
  }

  for (const line of codeLines) {
    const indentPx = line.indent * 20;
    const lineAttrs = syncRowAttrs ? syncRowAttrs(line.raw) : '';
    html += `
      <div ${lineAttrs} class="latex-sync-node flex items-baseline hover:bg-slate-50 py-0.5 px-1 rounded transition-colors" style="padding-left: ${indentPx + 4}px">
        ${line.num !== null ? `<span class="font-mono text-xs text-slate-400 select-none w-6 text-right pr-3 shrink-0">${line.num}:</span>` : `<span class="w-6 shrink-0"></span>`}
        <span class="flex-1 text-slate-800">${renderInlineLatex(line.text, macros)}</span>
      </div>
    `;
  }

  html += `</div>`;
  return html;
}

// TikZ vector renderer
function renderTikzPicture(
  id: number,
  opts: string,
  content: string,
  macros: Record<string, any> | undefined,
  attrs: string
): string {
  const cleanContent = content.trim();

  const nodes = new Map<string, any>();
  const draws: any[] = [];
  let defaultX = 0;
  let defaultY = 0;

  // Parse nodes & coordinates
  const nodeRegex = /\\(node|coordinate)(?:\[([^\]]*)\])?\s*(?:\(([^)]+)\))?\s*(?:at\s*\(([^)]+)\))?\s*(?:\{((?:[^{}]*|\{[^{}]*\})*)\})?;/g;
  let match: RegExpExecArray | null;
  while ((match = nodeRegex.exec(cleanContent)) !== null) {
    const isCoord = match[1] === 'coordinate';
    const nOpts = match[2] || '';
    const nId = match[3] || `node_${nodes.size + 1}`;
    const atCoord = match[4];
    const rawLabel = match[5] || '';
    const label = rawLabel ? renderInlineLatex(rawLabel, macros) : '';

    let x = defaultX;
    let y = defaultY;

    if (atCoord) {
      const parts = atCoord.split(',').map((s) => parseFloat(s.trim()));
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        x = parts[0];
        y = parts[1];
      }
    } else {
      const relMatch = nOpts.match(/(right|left|above|below)(?:\s+of)?=([a-zA-Z0-9_-]+)/);
      if (relMatch && nodes.has(relMatch[2])) {
        const refNode = nodes.get(relMatch[2]);
        const dist = 3;
        if (relMatch[1] === 'right') { x = refNode.x + dist; y = refNode.y; }
        else if (relMatch[1] === 'left') { x = refNode.x - dist; y = refNode.y; }
        else if (relMatch[1] === 'above') { x = refNode.x; y = refNode.y + dist; }
        else if (relMatch[1] === 'below') { x = refNode.x; y = refNode.y - dist; }
      } else {
        defaultX += 2.5;
      }
    }

    const isCircle = nOpts.includes('circle');
    const shape = isCoord ? 'coordinate' : (isCircle ? 'circle' : 'rectangle');
    const draw = nOpts.includes('draw') || !nOpts.includes('fill');

    let fillColor = '#ffffff';
    if (nOpts.includes('fill=')) {
      const fMatch = nOpts.match(/fill=([a-zA-Z0-9!]+)/);
      if (fMatch) {
        const fVal = fMatch[1];
        if (fVal.includes('blue')) fillColor = '#eff6ff';
        else if (fVal.includes('green') || fVal.includes('emerald')) fillColor = '#f0fdf4';
        else if (fVal.includes('red') || fVal.includes('rose')) fillColor = '#fff1f2';
        else if (fVal.includes('yellow') || fVal.includes('amber')) fillColor = '#fffbeb';
        else if (fVal.includes('purple')) fillColor = '#faf5ff';
        else fillColor = '#f8fafc';
      }
    }

    nodes.set(nId, {
      id: nId,
      x,
      y,
      label,
      rawLabel,
      shape,
      draw,
      fillColor,
      strokeColor: '#334155',
    });
  }

  // Parse \draw commands
  const drawRegex = /\\draw(?:\[([^\]]*)\])?\s*([^;]+);/g;
  while ((match = drawRegex.exec(cleanContent)) !== null) {
    const dOpts = match[1] || '';
    const body = match[2].trim();

    const hasArrowEnd = dOpts.includes('->') || dOpts.includes('-latex') || dOpts.includes('-stealth');
    const hasArrowStart = dOpts.includes('<-');
    const isDashed = dOpts.includes('dashed');
    const width = dOpts.includes('thick') ? 2 : dOpts.includes('very thick') ? 3 : 1.5;

    let color = '#334155';
    if (dOpts.includes('blue')) color = '#2563eb';
    else if (dOpts.includes('red')) color = '#dc2626';
    else if (dOpts.includes('green')) color = '#16a34a';
    else if (dOpts.includes('purple')) color = '#9333ea';

    // Node to node: (A) -- (B)
    const n2nMatch = body.match(/\(([a-zA-Z0-9_-]+)\)\s*--\s*\(([a-zA-Z0-9_-]+)\)/);
    if (n2nMatch) {
      draws.push({
        type: 'line',
        fromNode: n2nMatch[1],
        toNode: n2nMatch[2],
        hasArrowStart,
        hasArrowEnd,
        isDashed,
        color,
        width,
      });
      continue;
    }

    // Node to coord: (A) -- (x, y)
    const n2cMatch = body.match(/\(([a-zA-Z0-9_-]+)\)\s*--\s*\(([^)]+)\)(?:\s*node(?:\[([^\]]*)\])?\s*\{([^}]*)\})?/);
    if (n2cMatch && nodes.has(n2cMatch[1])) {
      const fromN = nodes.get(n2cMatch[1]);
      const cParts = n2cMatch[2].split(',').map((s) => parseFloat(s.trim()));
      if (cParts.length >= 2 && !isNaN(cParts[0]) && !isNaN(cParts[1])) {
        draws.push({
          type: 'line',
          x1: fromN.x,
          y1: fromN.y,
          x2: cParts[0],
          y2: cParts[1],
          hasArrowStart,
          hasArrowEnd,
          isDashed,
          color,
          width,
          label: n2cMatch[4] ? renderInlineLatex(n2cMatch[4], macros) : '',
        });
        continue;
      }
    }

    // Coord to coord: (x1, y1) -- (x2, y2)
    const c2cMatch = body.match(/\(([^)]+)\)\s*--\s*\(([^)]+)\)(?:\s*node(?:\[([^\]]*)\])?\s*\{([^}]*)\})?/);
    if (c2cMatch) {
      const p1 = c2cMatch[1].split(',').map((s) => parseFloat(s.trim()));
      const p2 = c2cMatch[2].split(',').map((s) => parseFloat(s.trim()));
      if (p1.length >= 2 && p2.length >= 2 && !isNaN(p1[0]) && !isNaN(p2[0])) {
        draws.push({
          type: 'line',
          x1: p1[0],
          y1: p1[1],
          x2: p2[0],
          y2: p2[1],
          hasArrowStart,
          hasArrowEnd,
          isDashed,
          color,
          width,
          label: c2cMatch[4] ? renderInlineLatex(c2cMatch[4], macros) : '',
        });
        continue;
      }
    }

    // Rectangle: (x1, y1) rectangle (x2, y2)
    const rectMatch = body.match(/\(([^)]+)\)\s*rectangle\s*\(([^)]+)\)/);
    if (rectMatch) {
      const p1 = rectMatch[1].split(',').map((s) => parseFloat(s.trim()));
      const p2 = rectMatch[2].split(',').map((s) => parseFloat(s.trim()));
      if (p1.length >= 2 && p2.length >= 2) {
        draws.push({
          type: 'rect',
          x1: Math.min(p1[0], p2[0]),
          y1: Math.min(p1[1], p2[1]),
          x2: Math.max(p1[0], p2[0]),
          y2: Math.max(p1[1], p2[1]),
          color,
          width,
          isDashed,
        });
        continue;
      }
    }

    // Circle: (x, y) circle (r)
    const circMatch = body.match(/\(([^)]+)\)\s*circle\s*\(([^)]+)\)/);
    if (circMatch) {
      const p = circMatch[1].split(',').map((s) => parseFloat(s.trim()));
      const r = parseFloat(circMatch[2]);
      if (p.length >= 2 && !isNaN(r)) {
        draws.push({
          type: 'circle',
          x1: p[0],
          y1: p[1],
          r,
          color,
          width,
          isDashed,
        });
      }
    }
  }

  // Calculate Bounding Box
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  nodes.forEach((n) => {
    minX = Math.min(minX, n.x - 1);
    maxX = Math.max(maxX, n.x + 1);
    minY = Math.min(minY, n.y - 1);
    maxY = Math.max(maxY, n.y + 1);
  });

  draws.forEach((d) => {
    if (d.x1 !== undefined) { minX = Math.min(minX, d.x1 - 0.5); maxX = Math.max(maxX, d.x1 + 0.5); }
    if (d.x2 !== undefined) { minX = Math.min(minX, d.x2 - 0.5); maxX = Math.max(maxX, d.x2 + 0.5); }
    if (d.y1 !== undefined) { minY = Math.min(minY, d.y1 - 0.5); maxY = Math.max(maxY, d.y1 + 0.5); }
    if (d.y2 !== undefined) { minY = Math.min(minY, d.y2 - 0.5); maxY = Math.max(maxY, d.y2 + 0.5); }
  });

  if (minX === Infinity) { minX = -1; maxX = 5; minY = -1; maxY = 3; }

  const unitScale = 60;
  const padding = 45;
  const svgWidth = Math.max(340, Math.round((maxX - minX) * unitScale + padding * 2));
  const svgHeight = Math.max(160, Math.round((maxY - minY) * unitScale + padding * 2));

  const toSvgX = (x: number) => padding + (x - minX) * unitScale;
  const toSvgY = (y: number) => svgHeight - (padding + (y - minY) * unitScale);

  const defs = `
    <defs>
      <marker id="tikz-arrow-${id}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#334155" />
      </marker>
    </defs>
  `;

  let svgElements = '';

  for (const d of draws) {
    let sx = 0, sy = 0, ex = 0, ey = 0;
    if (d.fromNode && nodes.has(d.fromNode)) {
      const n = nodes.get(d.fromNode);
      sx = toSvgX(n.x);
      sy = toSvgY(n.y);
    } else if (d.x1 !== undefined && d.y1 !== undefined) {
      sx = toSvgX(d.x1);
      sy = toSvgY(d.y1);
    }

    if (d.toNode && nodes.has(d.toNode)) {
      const n = nodes.get(d.toNode);
      ex = toSvgX(n.x);
      ey = toSvgY(n.y);
    } else if (d.x2 !== undefined && d.y2 !== undefined) {
      ex = toSvgX(d.x2);
      ey = toSvgY(d.y2);
    }

    const markerEnd = d.hasArrowEnd ? `marker-end="url(#tikz-arrow-${id})"` : '';
    const dashAttr = d.isDashed ? 'stroke-dasharray="4,4"' : '';

    if (d.type === 'line') {
      svgElements += `<line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="${d.color}" stroke-width="${d.width}" ${dashAttr} ${markerEnd} />\n`;
      if (d.label) {
        svgElements += `
          <foreignObject x="${ex + 6}" y="${ey - 12}" width="120" height="30">
            <div class="font-serif text-xs text-slate-800">${d.label}</div>
          </foreignObject>
        `;
      }
    } else if (d.type === 'rect') {
      const rx = toSvgX(d.x1);
      const ry = toSvgY(d.y2);
      const rw = Math.abs(toSvgX(d.x2) - toSvgX(d.x1));
      const rh = Math.abs(toSvgY(d.y1) - toSvgY(d.y2));
      svgElements += `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="none" stroke="${d.color}" stroke-width="${d.width}" ${dashAttr} />\n`;
    } else if (d.type === 'circle') {
      const cx = toSvgX(d.x1);
      const cy = toSvgY(d.y1);
      const cr = d.r * unitScale;
      svgElements += `<circle cx="${cx}" cy="${cy}" r="${cr}" fill="none" stroke="${d.color}" stroke-width="${d.width}" ${dashAttr} />\n`;
    }
  }

  nodes.forEach((n) => {
    if (n.shape === 'coordinate') return;
    const nx = toSvgX(n.x);
    const ny = toSvgY(n.y);

    if (n.shape === 'circle') {
      const radius = 24;
      svgElements += `<circle cx="${nx}" cy="${ny}" r="${radius}" fill="${n.fillColor}" stroke="${n.strokeColor}" stroke-width="1.5" />\n`;
      svgElements += `
        <foreignObject x="${nx - radius}" y="${ny - radius}" width="${radius * 2}" height="${radius * 2}">
          <div class="w-full h-full flex items-center justify-center font-serif text-xs text-slate-900 font-bold overflow-hidden select-text">${n.label}</div>
        </foreignObject>
      `;
    } else {
      const charLen = stripHtml(n.label).length;
      const w = Math.max(68, charLen * 9 + 28);
      const h = 36;
      svgElements += `<rect x="${nx - w / 2}" y="${ny - h / 2}" width="${w}" height="${h}" rx="4" fill="${n.fillColor}" stroke="${n.strokeColor}" stroke-width="1.5" />\n`;
      svgElements += `
        <foreignObject x="${nx - w / 2}" y="${ny - h / 2}" width="${w}" height="${h}">
          <div class="w-full h-full flex items-center justify-center font-serif text-xs text-slate-900 overflow-hidden select-text">${n.label}</div>
        </foreignObject>
      `;
    }
  });

  const rawTikzFull = `\\begin{tikzpicture}${opts ? `[${opts}]` : ''}\n${cleanContent}\n\\end{tikzpicture}`;

  return `
    <div ${attrs} class="latex-sync-node my-6 border border-slate-200 rounded-lg bg-white p-3 shadow-2xs group hover:border-indigo-300 transition-colors">
      <div class="flex items-center justify-between border-b border-slate-100 pb-2 mb-2 select-none">
        <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
          <svg class="w-3.5 h-3.5 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          TikZ 矢量图元 #${id}
        </span>
        <button
          type="button"
          data-toggle-target="tikz-code-${id}"
          class="text-[11px] text-slate-500 hover:text-indigo-600 px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
        >
          查看 TikZ 源码
        </button>
      </div>

      <div class="overflow-x-auto flex justify-center p-3 bg-slate-50/50 rounded-md border border-slate-100/80">
        <svg viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}" class="max-w-full h-auto">
          ${defs}
          ${svgElements}
        </svg>
      </div>

      <div id="tikz-code-${id}" class="hidden mt-3 pt-2 border-t border-slate-100">
        <pre class="p-3 bg-slate-900 text-slate-200 font-mono text-xs rounded-md overflow-x-auto leading-relaxed border border-slate-800 select-text"><code>${escapeHtml(rawTikzFull)}</code></pre>
      </div>
    </div>
  `;
}
