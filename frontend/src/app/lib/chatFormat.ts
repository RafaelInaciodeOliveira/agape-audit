import type { Message } from './types';

// Formatação de chats, mensagens, notas e etiquetas exibidas na tela de auditoria.

const DYNAMIC_TAG_COLORS = [
  'bg-red-500/20 text-red-300 border-red-500/50',
  'bg-violet-500/20 text-violet-300 border-violet-500/50',
  'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/50',
  'bg-rose-500/20 text-rose-300 border-rose-500/50',
  'bg-lime-500/20 text-lime-300 border-lime-500/50',
];

export function getRatingColor(rating: number | null) {
  if (rating === 1) return { text: 'text-red-500', fill: 'fill-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30' };
  if (rating === 2) return { text: 'text-orange-500', fill: 'fill-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/30' };
  if (rating === 3) return { text: 'text-amber-400', fill: 'fill-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' };
  if (rating === 4) return { text: 'text-lime-400', fill: 'fill-lime-400', bg: 'bg-lime-500/10', border: 'border-lime-500/30' };
  if (rating === 5) return { text: 'text-emerald-400', fill: 'fill-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
  return { text: 'text-slate-400', fill: 'fill-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/30' };
}

export function normalizeMessages(data: unknown): Message[] {
  if (Array.isArray(data)) return data as Message[];
  const d = data as { items?: Message[]; messages?: Message[]; data?: Message[] } | undefined;
  return d?.items ?? d?.messages ?? d?.data ?? [];
}

export function getTagBadge(tagName: string) {
  const name = (tagName || '').trim().toUpperCase();
  if (name.includes('ANTARES')) return { icon: '🌟', style: 'bg-amber-500/20 text-amber-300 border-amber-500/50' };
  if (name.includes('ARCTURUS')) return { icon: '🌸', style: 'bg-pink-500/20 text-pink-300 border-pink-500/50' };
  if (name.includes('ALPHA')) return { icon: '🔥', style: 'bg-orange-500/20 text-orange-300 border-orange-500/50' };
  if (name.includes('SIGMA')) return { icon: '🟢', style: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50' };
  if (name.includes('SIRIUS')) return { icon: '🟣', style: 'bg-purple-500/20 text-purple-300 border-purple-500/50' };
  if (name.includes('CLIENTE PROVER') || name.includes('PROSPECT PROVER')) return { icon: '🔵', style: 'bg-blue-600/30 text-blue-300 border-blue-500/50' };
  if (name.includes('CATHOLIC')) return { icon: '🟣', style: 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50' };
  if (name.includes('GRUPO PROVER')) return { icon: '👯', style: 'bg-cyan-600/30 text-cyan-300 border-cyan-500/50' };
  if (name.includes('MULTIIGREJA')) return { icon: '🏘', style: 'bg-teal-600/30 text-teal-300 border-teal-500/50' };
  if (name.includes('ONBOARDING')) return { icon: '🚀', style: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50' };
  if (name.includes('PROVER NA PRÁTICA') || name.includes('BKO') || name.includes('COMERCIAL')) return { icon: '🐨', style: 'bg-slate-700/60 text-slate-200 border-slate-600' };

  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const colorStyle = DYNAMIC_TAG_COLORS[Math.abs(hash) % DYNAMIC_TAG_COLORS.length];
  return { icon: '🏷️', style: colorStyle };
}

export function formatDateTime(rawDate?: string | Date): { dateStr: string; timeStr: string } {
  if (!rawDate) return { dateStr: 'Hoje', timeStr: '' };
  try {
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return { dateStr: 'Hoje', timeStr: '' };
    const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return { dateStr: 'Hoje', timeStr };
    return { dateStr: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }), timeStr };
  } catch {
    return { dateStr: 'Hoje', timeStr: '' };
  }
}

export function formatRelativeTime(rawDate?: string | Date): string {
  if (!rawDate) return '';
  const d = new Date(rawDate);
  if (isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `há ${diffD} dia${diffD > 1 ? 's' : ''}`;
  const diffMonths = Math.floor(diffD / 30);
  if (diffMonths < 12) return `há ${diffMonths} ${diffMonths > 1 ? 'meses' : 'mês'}`;
  const diffYears = Math.floor(diffMonths / 12);
  return `há ${diffYears} ano${diffYears > 1 ? 's' : ''}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function renderMessageContent(msg: any): string {
  if (!msg) return 'Sem mensagem';
  if (typeof msg === 'string') {
    if (msg.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(msg);
        if (parsed.billingType || parsed.billable !== undefined) return '📢 [Evento de Sistema / Template Enviado]';
        return renderMessageContent(parsed);
      } catch { return msg; }
    }
    return msg;
  }
  if (typeof msg === 'object') {
    const type = (msg.type || msg.messageType || '').toString().toLowerCase();
    if (type === 'audio' || msg.fileType === 'audio') return '🎤 Áudio';
    if (type === 'image' || msg.fileType === 'image') return '📷 Imagem';
    if (type === 'document' || type === 'file') return '📄 Documento';
    if (type === 'video') return '🎥 Vídeo';
    if (type === 'sticker') return '🎴 Figurinha';
    if (msg.text && typeof msg.text === 'string') return msg.text;
    if (msg.fallbackText) return msg.fallbackText;
    if (msg.body) return msg.body;
    if (msg.caption) return msg.caption;
    if (msg.content) {
      const contentStr = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      if (contentStr.includes('"billingType"') || contentStr.includes('"billable"')) return '📢 [Mensagem de Template Automática]';
      return renderMessageContent(msg.content);
    }
    return 'Mensagem do sistema';
  }
  return 'Mensagem enviada';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractMediaUrl(msg: any): string | null {
  if (!msg) return null;
  if (typeof msg.content === 'string' && msg.content.startsWith('http')) return msg.content;
  if (typeof msg.url === 'string') return msg.url;
  if (typeof msg.mediaUrl === 'string') return msg.mediaUrl;
  if (msg.content && typeof msg.content === 'object' && msg.content.url) return msg.content.url;
  
  try {
    const str = JSON.stringify(msg);
    const match = str.match(/(https:\/\/[^"]+\.amazonaws\.com[^"]+)/);
    if (match) return match[0];
  } catch {
    // Ignora erros de JSON
  }
  return null;
}
