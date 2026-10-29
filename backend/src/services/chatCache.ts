import { UmblerService, type ChatsResult } from './umbler.js';

// Cache curtíssimo da lista de chats da Umbler. A tela principal faz polling e vários
// auditores podem estar com ela aberta: em vez de cada requisição paginar a Umbler
// inteira, todas dentro da janela compartilham o mesmo resultado (e a mesma busca em
// andamento). Falhas não são cacheadas.
const TTL_MS = (() => {
  const v = Number(process.env.CHATS_CACHE_TTL_MS);
  return Number.isFinite(v) && v >= 0 ? v : 15_000;
})();

type ChatState = 'Open' | 'Closed';
const entries = new Map<ChatState, { at: number; value: Promise<ChatsResult> }>();

export function getCachedChats(chatState: ChatState): Promise<ChatsResult> {
  const hit = entries.get(chatState);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const value = UmblerService.getChats({ chatState });
  entries.set(chatState, { at: Date.now(), value });
  value.catch(() => {
    if (entries.get(chatState)?.value === value) entries.delete(chatState);
  });
  return value;
}

export function invalidateChatCache() {
  entries.clear();
  reportEntries.clear();
}

// Relatórios: chats com atividade desde `sinceMs`, paginando a Umbler (ordem pela última
// mensagem, desc) só até sair do período, com o teto de segurança UMBLER_MAX_CHATS.
// Cache de 1 minuto por início de período: trocar só a data final não refaz a busca.
const REPORT_TTL_MS = 60_000;
const reportEntries = new Map<number, { at: number; value: Promise<ChatsResult> }>();

export function getCachedChatsActiveSince(sinceMs: number): Promise<ChatsResult> {
  const now = Date.now();
  for (const [key, entry] of reportEntries) if (now - entry.at >= REPORT_TTL_MS) reportEntries.delete(key);
  const hit = reportEntries.get(sinceMs);
  if (hit) return hit.value;

  const value = UmblerService.getChats({ chatState: 'All', activeSince: sinceMs });
  reportEntries.set(sinceMs, { at: now, value });
  value.catch(() => {
    if (reportEntries.get(sinceMs)?.value === value) reportEntries.delete(sinceMs);
  });
  return value;
}
