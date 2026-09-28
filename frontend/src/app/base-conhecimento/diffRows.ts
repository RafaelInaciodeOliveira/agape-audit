import { diffLines, diffWordsWithSpace, type Change } from 'diff';

export type RowKind = 'context' | 'added' | 'removed';

export interface DiffSegment {
  text: string;
  highlight: boolean;
}

export interface DiffLineRow {
  type: 'line';
  kind: RowKind;
  oldNumber: number | null;
  newNumber: number | null;
  segments: DiffSegment[];
}

export interface DiffCollapsedRow {
  type: 'collapsed';
  id: string;
  hiddenCount: number;
  rows: DiffLineRow[];
}

export type DiffRow = DiffLineRow | DiffCollapsedRow;

export interface DiffResult {
  rows: DiffRow[];
  added: number;
  removed: number;
  identical: boolean;
  timedOut: boolean;
}

// Acima disso o diff por palavra fica caro e pouco legível; mostra a linha inteira marcada.
const MAX_WORD_DIFF_CHARS = 4000;

function splitLines(value: string): string[] {
  return value.replace(/\n$/, '').split('\n');
}

function wordSegments(oldLine: string, newLine: string): { oldSegs: DiffSegment[]; newSegs: DiffSegment[] } | null {
  if (oldLine.length + newLine.length > MAX_WORD_DIFF_CHARS) return null;
  const parts = diffWordsWithSpace(oldLine, newLine);
  const oldSegs: DiffSegment[] = [];
  const newSegs: DiffSegment[] = [];
  for (const part of parts) {
    if (!part.added) oldSegs.push({ text: part.value, highlight: !!part.removed });
    if (!part.removed) newSegs.push({ text: part.value, highlight: !!part.added });
  }
  // Se quase tudo mudou, o destaque por palavra só polui — mantém a linha inteira.
  const changedChars = parts.filter(p => p.added || p.removed).reduce((n, p) => n + p.value.length, 0);
  if (changedChars > (oldLine.length + newLine.length) * 0.7) return null;
  return { oldSegs, newSegs };
}

function whole(text: string): DiffSegment[] {
  return [{ text, highlight: false }];
}

/**
 * Compara `oldText` (base) com `newText` e devolve linhas prontas para renderizar:
 * numeração dos dois lados e destaque por palavra em linhas modificadas.
 * Com `collapse`, todo trecho inalterado vira um bloco recolhido (expansível na UI),
 * deixando visíveis só as adições e remoções.
 */
export function buildDiffRows(oldText: string, newText: string, collapse = true): DiffResult {
  if (oldText === newText) {
    return { rows: [], added: 0, removed: 0, identical: true, timedOut: false };
  }

  let changes: Change[] | undefined = diffLines(oldText, newText, { timeout: 2000 });
  let timedOut = false;
  if (!changes) {
    // Textos gigantes e muito diferentes: mostra como substituição completa.
    timedOut = true;
    changes = [
      { value: oldText, removed: true, added: false, count: 0 },
      { value: newText, added: true, removed: false, count: 0 },
    ];
  }

  const lineRows: DiffLineRow[] = [];
  let oldNo = 1;
  let newNo = 1;
  let added = 0;
  let removed = 0;

  for (let i = 0; i < changes.length; i++) {
    const part = changes[i];
    const next = changes[i + 1];

    if (part.removed && next?.added) {
      const oldLines = splitLines(part.value);
      const newLines = splitLines(next.value);
      const paired = Math.min(oldLines.length, newLines.length);
      const pairs = Array.from({ length: paired }, (_, k) => wordSegments(oldLines[k], newLines[k]));

      oldLines.forEach((line, k) => {
        lineRows.push({ type: 'line', kind: 'removed', oldNumber: oldNo++, newNumber: null, segments: pairs[k]?.oldSegs ?? whole(line) });
      });
      newLines.forEach((line, k) => {
        lineRows.push({ type: 'line', kind: 'added', oldNumber: null, newNumber: newNo++, segments: pairs[k]?.newSegs ?? whole(line) });
      });
      removed += oldLines.length;
      added += newLines.length;
      i++;
      continue;
    }

    const lines = splitLines(part.value);
    for (const line of lines) {
      if (part.added) {
        lineRows.push({ type: 'line', kind: 'added', oldNumber: null, newNumber: newNo++, segments: whole(line) });
        added++;
      } else if (part.removed) {
        lineRows.push({ type: 'line', kind: 'removed', oldNumber: oldNo++, newNumber: null, segments: whole(line) });
        removed++;
      } else {
        lineRows.push({ type: 'line', kind: 'context', oldNumber: oldNo++, newNumber: newNo++, segments: whole(line) });
      }
    }
  }

  if (!collapse) return { rows: lineRows, added, removed, identical: false, timedOut };

  const rows: DiffRow[] = [];
  let i = 0;
  while (i < lineRows.length) {
    if (lineRows[i].kind !== 'context') {
      rows.push(lineRows[i++]);
      continue;
    }
    let j = i;
    while (j < lineRows.length && lineRows[j].kind === 'context') j++;
    const run = lineRows.slice(i, j);
    rows.push({ type: 'collapsed', id: `c-${i}`, hiddenCount: run.length, rows: run });
    i = j;
  }

  return { rows, added, removed, identical: false, timedOut };
}
