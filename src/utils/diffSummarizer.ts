import { FileItem } from '../types/latex';
import { FileDiffSummary, HistoryRecord, HistorySource } from '../types/history';

/**
 * Compute line-level diff between two text strings
 */
export function computeLineDiff(
  oldText: string = '',
  newText: string = '',
  maxDiffLines = 60
): {
  addedLines: number;
  removedLines: number;
  diffLines: { type: 'add' | 'del' | 'normal'; content: string; lineNo?: number }[];
} {
  const oldLines = oldText.split(/\r?\n/);
  const newLines = newText.split(/\r?\n/);

  let added = 0;
  let removed = 0;
  const diffLines: { type: 'add' | 'del' | 'normal'; content: string; lineNo?: number }[] = [];

  // Simple and fast LCS/line diff scanner
  let i = 0;
  let j = 0;

  while (i < oldLines.length || j < newLines.length) {
    if (diffLines.length >= maxDiffLines) {
      diffLines.push({
        type: 'normal',
        content: `... (其余 ${Math.max(0, oldLines.length - i + newLines.length - j)} 行差异省略)`,
      });
      break;
    }

    if (i < oldLines.length && j < newLines.length) {
      if (oldLines[i] === newLines[j]) {
        // Unchanged line
        diffLines.push({ type: 'normal', content: oldLines[i], lineNo: j + 1 });
        i++;
        j++;
      } else {
        // Check if next lines match (simple lookahead)
        if (i + 1 < oldLines.length && oldLines[i + 1] === newLines[j]) {
          diffLines.push({ type: 'del', content: oldLines[i] });
          removed++;
          i++;
        } else if (j + 1 < newLines.length && oldLines[i] === newLines[j + 1]) {
          diffLines.push({ type: 'add', content: newLines[j], lineNo: j + 1 });
          added++;
          j++;
        } else {
          diffLines.push({ type: 'del', content: oldLines[i] });
          diffLines.push({ type: 'add', content: newLines[j], lineNo: j + 1 });
          removed++;
          added++;
          i++;
          j++;
        }
      }
    } else if (i < oldLines.length) {
      diffLines.push({ type: 'del', content: oldLines[i] });
      removed++;
      i++;
    } else {
      diffLines.push({ type: 'add', content: newLines[j], lineNo: j + 1 });
      added++;
      j++;
    }
  }

  return {
    addedLines: added,
    removedLines: removed,
    diffLines,
  };
}

/**
 * Detect LaTeX semantic changes in added/modified text
 */
function extractSemanticFeatures(addedText: string, removedText: string): {
  tags: string[];
  summaries: string[];
} {
  const tags: string[] = [];
  const summaries: string[] = [];

  // 1. Theorems and proofs
  if (
    /\\begin\{(theorem|lemma|proposition|corollary|assumption)\}/i.test(addedText) ||
    /\\begin\{proof\}/i.test(addedText)
  ) {
    tags.push('定理证明');
    const thmMatch = addedText.match(/\\begin\{theorem\}(\[[^\]]+\])?/i);
    const thmTitle = thmMatch?.[1]?.replace(/[\[\]]/g, '') || '';
    summaries.push(thmTitle ? `新增定理「${thmTitle}」与分析证明` : '新增收敛性定理与证明环境');
  }

  // 2. Math equations
  if (/\\begin\{(equation|align|gather|multline)\*?\}/i.test(addedText) || /\$\$/i.test(addedText)) {
    tags.push('公式推导');
    if (!summaries.some(s => s.includes('定理'))) {
      summaries.push('推导并插入带有对齐/标号的数学公式环境');
    }
  }

  // 3. Tables and figures
  if (/\\begin\{(table|tabular|longtable)\}/i.test(addedText) || /\\toprule/i.test(addedText)) {
    tags.push('数据表格');
    summaries.push('调整或插入学术标准三线表结构');
  }
  if (/\\begin\{tikzpicture\}/i.test(addedText)) {
    tags.push('TikZ架构');
    summaries.push('生成基于 TikZ 的闭环系统矢量架构框图');
  }

  // 4. Algorithms
  if (/\\begin\{(algorithm|algorithmic)\}/i.test(addedText)) {
    tags.push('算法流程');
    summaries.push('新增自适应算法伪代码迭代求解环境');
  }

  // 5. Sections and structure
  const sectionMatch = addedText.match(/\\section\{([^}]+)\}/i);
  if (sectionMatch) {
    tags.push('章节结构');
    summaries.push(`新增/规划章节「${sectionMatch[1]}」`);
  }

  // 6. Citations
  if (/\\cite\{([^}]+)\}/i.test(addedText)) {
    tags.push('文献引用');
    const citeMatch = addedText.match(/\\cite\{([^}]+)\}/i);
    summaries.push(`插入文内引用 \\cite{${citeMatch?.[1] || '...'}}`);
  }

  // 7. BibTeX entry
  if (/@(article|inproceedings|book|misc)\{([^,]+),/i.test(addedText)) {
    tags.push('文献库');
    const bibMatch = addedText.match(/@(article|inproceedings|book|misc)\{([^,]+),/i);
    summaries.push(`追加参考文献条目 [${bibMatch?.[2] || ''}]`);
  }

  // 8. TAC Primary Thesis
  if (/% P0/i.test(addedText) || /IEEE TAC/i.test(addedText)) {
    tags.push('TAC主论题');
    summaries.push('定义 IEEE TAC 核心控制主论题 P0 与 C1-C4 论证图谱');
  }

  return { tags, summaries };
}

/**
 * Map source to user-friendly badge label
 */
export function getSourceLabel(source: HistorySource): string {
  switch (source) {
    case 'ai':
      return 'AI 助手写入';
    case 'manual':
      return '编辑区改动';
    case 'zotero':
      return 'Zotero 引用';
    case 'wizard':
      return '向导插入';
    case 'rollback':
      return '回退前备份';
    case 'template':
      return '加载模板';
    default:
      return '历史版本';
  }
}

/**
 * Compare two workspace file trees and construct a complete HistoryRecord
 */
export function createHistoryRecord(
  prevFiles: Record<string, FileItem>,
  currentFiles: Record<string, FileItem>,
  activeFileId: string,
  rootIds: string[],
  source: HistorySource,
  customSummary?: string
): HistoryRecord | null {
  const fileDiffs: FileDiffSummary[] = [];
  let totalAdded = 0;
  let totalRemoved = 0;
  let combinedAddedText = '';
  let combinedRemovedText = '';
  const modifiedFileNames: string[] = [];

  const allFileIds = Array.from(
    new Set([...Object.keys(prevFiles), ...Object.keys(currentFiles)])
  );

  for (const fId of allFileIds) {
    const oldFile = prevFiles[fId];
    const newFile = currentFiles[fId];

    if (!oldFile && newFile && newFile.type !== 'folder') {
      // Newly created file
      const { addedLines, removedLines, diffLines } = computeLineDiff('', newFile.content || '');
      fileDiffs.push({
        filePath: newFile.path,
        fileName: newFile.name,
        status: 'created',
        addedLines,
        removedLines,
        diffLines,
      });
      totalAdded += addedLines;
      combinedAddedText += (newFile.content || '') + '\n';
      modifiedFileNames.push(newFile.name);
    } else if (oldFile && !newFile && oldFile.type !== 'folder') {
      // Deleted file
      const { addedLines, removedLines, diffLines } = computeLineDiff(oldFile.content || '', '');
      fileDiffs.push({
        filePath: oldFile.path,
        fileName: oldFile.name,
        status: 'deleted',
        addedLines,
        removedLines,
        diffLines,
      });
      totalRemoved += removedLines;
      combinedRemovedText += (oldFile.content || '') + '\n';
      modifiedFileNames.push(oldFile.name);
    } else if (oldFile && newFile && oldFile.type !== 'folder') {
      // Check if content changed
      if (oldFile.content !== newFile.content) {
        const { addedLines, removedLines, diffLines } = computeLineDiff(
          oldFile.content || '',
          newFile.content || ''
        );
        if (addedLines > 0 || removedLines > 0) {
          fileDiffs.push({
            filePath: newFile.path,
            fileName: newFile.name,
            status: 'modified',
            addedLines,
            removedLines,
            diffLines,
          });
          totalAdded += addedLines;
          totalRemoved += removedLines;
          combinedAddedText += (newFile.content || '') + '\n';
          combinedRemovedText += (oldFile.content || '') + '\n';
          modifiedFileNames.push(newFile.name);
        }
      }
    }
  }

  // If no files changed, do not record history
  if (fileDiffs.length === 0) {
    return null;
  }

  const { tags, summaries } = extractSemanticFeatures(combinedAddedText, combinedRemovedText);

  // Add source tag
  if (source === 'ai' && !tags.includes('AI写入')) tags.unshift('AI写入');
  if (source === 'zotero' && !tags.includes('文献引用')) tags.unshift('Zotero');
  if (source === 'rollback') tags.unshift('回退保护');

  // Build high-level summary string
  let generatedSummary = customSummary || '';
  if (!generatedSummary) {
    const fileLabel = modifiedFileNames.length === 1
      ? modifiedFileNames[0]
      : `${modifiedFileNames[0]} 等 ${modifiedFileNames.length} 个文件`;

    if (summaries.length > 0) {
      generatedSummary = `${fileLabel}: ${summaries[0]} (+${totalAdded} -${totalRemoved} 行)`;
    } else if (totalAdded > 0 && totalRemoved > 0) {
      generatedSummary = `${fileLabel}: 修改正文内容 (+${totalAdded} / -${totalRemoved} 行)`;
    } else if (totalAdded > 0) {
      generatedSummary = `${fileLabel}: 扩充新增内容 (+${totalAdded} 行)`;
    } else {
      generatedSummary = `${fileLabel}: 精简删除内容 (-${totalRemoved} 行)`;
    }
  }

  return {
    id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    source,
    sourceLabel: getSourceLabel(source),
    summary: generatedSummary,
    details: summaries.length > 0 ? summaries : undefined,
    tags,
    fileDiffs,
    totalAddedLines: totalAdded,
    totalRemovedLines: totalRemoved,
    snapshot: {
      files: JSON.parse(JSON.stringify(currentFiles)),
      activeFileId,
      rootIds: [...rootIds],
    },
  };
}
