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
}
