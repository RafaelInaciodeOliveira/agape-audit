// --- WEBHOOK DO STRAPI (Novidades Prover -> Base de Conhecimento) ---
// Converte campos de texto do Strapi em texto puro. Aceita os dois formatos de rich text:
// string (HTML/Markdown) e o editor "Blocks" do Strapi 5 (array JSON de nós com children/text).
export function strapiToText(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') {
    return value
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|li|h[1-6])>/gi, '\n')
      .replace(/<[^>]*>?/gm, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
  if (Array.isArray(value)) {
    return value.map(strapiToText).filter(Boolean).join('\n').trim();
  }
  if (typeof value === 'object') {
    if (typeof value.text === 'string') return value.text;
    if (Array.isArray(value.children)) {
      const inline = value.children.every((c: any) => typeof c?.text === 'string');
      return inline ? value.children.map((c: any) => c.text).join('') : strapiToText(value.children);
    }
  }
  return '';
}
