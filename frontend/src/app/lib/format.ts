// --- Formatadores de data BR compartilhados pelos painéis ---

/** "2026-01-15" → "15/01". Entradas fora do formato voltam como vieram. */
export function formatDayBR(isoStr: string) {
  if (!isoStr) return '';
  const parts = isoStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  return isoStr;
}
