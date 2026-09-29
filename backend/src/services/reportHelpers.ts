// Filtro de período dos relatórios: datas YYYY-MM-DD interpretadas em UTC, dia inteiro.
// Sem as duas datas, não filtra.
export function buildDateFilter(startDate?: string, endDate?: string): Record<string, any> {
  if (startDate && endDate) {
    return { createdAt: { $gte: `${startDate}T00:00:00.000Z`, $lte: `${endDate}T23:59:59.999Z` } };
  }
  return {};
}

export function toCsvCell(value: any): string {
  const str = value === null || value === undefined ? '' : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}
