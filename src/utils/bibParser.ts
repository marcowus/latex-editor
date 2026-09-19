import { FileItem } from '../types/latex';

export interface BibEntry {
  key: string;
  type: string;
  title?: string;
  author?: string;
  year?: string;
  journal?: string;
}

export interface LabelEntry {
  key: string;
  type: 'sec' | 'fig' | 'tab' | 'eq' | 'thm' | 'lem' | 'other';
  line?: number;
  fileName?: string;
  description?: string;
}

// Extract all bib entries from workspace
export function extractBibEntries(files: Record<string, FileItem>): BibEntry[] {
  const entries: BibEntry[] = [];
  const seenKeys = new Set<string>();

  for (const file of Object.values(files)) {
    if (!file.content) continue;

    // 1. Check .bib files
    if (file.name.endsWith('.bib') || file.type === 'bib') {
      const entryRegex = /@(\w+)\s*\{\s*([^,\s]+)\s*,([\s\S]*?)(?=\n@|\s*$)/g;
      let match;
      while ((match = entryRegex.exec(file.content)) !== null) {
        const type = match[1].toLowerCase();
        const key = match[2].trim();
        const body = match[3];

        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        const titleMatch = body.match(/title\s*=\s*[\{"]([^"\}]+)[\}"]/i);
        const authorMatch = body.match(/author\s*=\s*[\{"]([^"\}]+)[\}"]/i);
        const yearMatch = body.match(/year\s*=\s*[\{"]?(\d+)[\}"]?/i);
        const journalMatch = body.match(/(?:journal|booktitle)\s*=\s*[\{"]([^"\}]+)[\}"]/i);

        entries.push({
          key,
          type,
          title: titleMatch ? titleMatch[1].trim() : undefined,
          author: authorMatch ? authorMatch[1].trim() : undefined,
          year: yearMatch ? yearMatch[1].trim() : undefined,
          journal: journalMatch ? journalMatch[1].trim() : undefined,
        });
      }
    }

    // 2. Also check \bibitem in .tex files
    if (file.name.endsWith('.tex') || file.type === 'tex') {
      const bibItemRegex = /\\bibitem(?:\[[^\]]*\])?\{([^}]+)\}([\s\S]*?)(?=\\bibitem|\\end\{thebibliography\}|$)/g;
      let itemMatch;
      while ((itemMatch = bibItemRegex.exec(file.content)) !== null) {
        const key = itemMatch[1].trim();
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        const rawText = itemMatch[2].replace(/\\[a-zA-Z]+/g, '').replace(/[{}]/g, '').trim();
        const firstLine = rawText.split('\n')[0] || '';

        entries.push({
          key,
          type: 'misc',
          title: firstLine.slice(0, 60),
        });
      }
    }
  }

  return entries;
}

// Extract all labels defined with \label{...} in .tex files
export function extractLabels(files: Record<string, FileItem>): LabelEntry[] {
  const labels: LabelEntry[] = [];
  const seenKeys = new Set<string>();

  for (const file of Object.values(files)) {
    if (!file.content || !file.name.endsWith('.tex')) continue;

    const lines = file.content.split('\n');
    lines.forEach((lineText, idx) => {
      const labelRegex = /\\label\{([^}]+)\}/g;
      let match;
      while ((match = labelRegex.exec(lineText)) !== null) {
        const key = match[1].trim();
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        let type: LabelEntry['type'] = 'other';
        const lowerKey = key.toLowerCase();
        if (lowerKey.startsWith('sec:') || lowerKey.startsWith('ch:')) type = 'sec';
        else if (lowerKey.startsWith('fig:')) type = 'fig';
        else if (lowerKey.startsWith('tab:') || lowerKey.startsWith('tbl:')) type = 'tab';
        else if (lowerKey.startsWith('eq:')) type = 'eq';
        else if (lowerKey.startsWith('thm:')) type = 'thm';
        else if (lowerKey.startsWith('lem:')) type = 'lem';

        // Try to get nearby context (heading or equation)
        let description = '';
        if (type === 'sec') {
          const prevLines = lines.slice(Math.max(0, idx - 2), idx + 1).join(' ');
          const secMatch = prevLines.match(/\\(?:section|subsection|subsubsection)\{([^}]+)\}/);
          if (secMatch) description = secMatch[1];
        }

        labels.push({
          key,
          type,
          line: idx + 1,
          fileName: file.name,
          description: description || undefined,
        });
      }
    });
  }

  return labels;
}
