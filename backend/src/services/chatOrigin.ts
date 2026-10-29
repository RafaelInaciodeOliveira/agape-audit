import { getDb } from '../config/db.js';
import { UmblerService } from './umbler.js';
import { getAgapeMemberId, hasAgapeInteracted } from './businessConfig.js';
import { logError } from '../utils/logger.js';

// Origem da conversa: a opção escolhida pelo contato no menu do chatbot de entrada.
// O menu chega como mensagem do bot (messageType "List") com `question.options`
// ("Tirar Dúvidas", "Falar com especialista", "Nova contratação"). O contato responde
// tocando na opção (ListReply com o rótulo) ou digitando o número dela ("1").
// Não existe etiqueta, setor ou campo no chat que guarde essa escolha, e a transferência
// para o Ágape também acontece em outras opções; por isso lemos o próprio menu.

export type ChatOrigin = 'tirar_duvidas' | 'outro';

const TARGET_OPTION = 'tirar duvidas';
// Instâncias de chatbot (mais recentes primeiro) examinadas por chat; cada uma custa uma chamada.
const MAX_BOT_RUNS = 4;
const CONCURRENCY = 6;

const normalize = (s: unknown) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

const optionLabels = (m: any): string[] | null => {
  const options = m?.source === 'Bot' ? m?.question?.options : null;
  return Array.isArray(options) && options.length > 0 ? options.map((o: any) => normalize(o?.label)) : null;
};

/**
 * Opção escolhida no menu de entrada dentro de `entries` (ordem cronológica).
 * null = nenhum menu com "Tirar Dúvidas" ou o contato ainda não respondeu.
 */
export function detectOrigin(entries: any[]): ChatOrigin | null {
  let menu: { id?: string; labels: string[] } | null = null;
  for (const m of entries) {
    const labels = optionLabels(m);
    if (labels) {
      if (labels.includes(TARGET_OPTION)) menu = { id: m.id, labels };
      continue;
    }
    if (!menu || m?.source !== 'Contact' || m?._t !== 'MessageModel') continue;

    const answer = normalize(m.content ?? m.text);
    const byNumber = /^\d{1,2}$/.test(answer) ? menu.labels[Number(answer) - 1] : undefined;
    const choice = menu.labels.includes(answer) ? answer : byNumber;
    if (choice) return choice === TARGET_OPTION ? 'tirar_duvidas' : 'outro';
    // Resposta fora das opções: o bot repete o menu; segue procurando.
  }
  return null;
}

type BotRun = { botInstanceId?: string; createdAt?: string };

const botRuns = (chat: any): BotRun[] =>
  (Array.isArray(chat?.bots) ? chat.bots : [])
    .filter((b: BotRun) => b?.createdAt)
    .sort((a: BotRun, b: BotRun) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());

async function classify(chat: any): Promise<ChatOrigin> {
  // A escolha mais recente vale (o chat pode ser reaberto e passar pelo menu de novo).
  for (const run of botRuns(chat).slice(0, MAX_BOT_RUNS)) {
    const origin = detectOrigin(await UmblerService.getMessagesAfter(chat.id, run.createdAt!));
    if (origin) return origin;
  }
  return 'outro';
}

// Uma classificação por chat em andamento, compartilhada entre requisições simultâneas (polling).
const inFlight = new Map<string, Promise<ChatOrigin>>();

/**
 * Ids dos chats iniciados pela opção "Tirar Dúvidas". Só examina chats em que o Ágape
 * participou (essa opção sempre transfere para ele). O resultado fica salvo em `chatOrigins`,
 * associado à última execução de chatbot do chat: só reclassifica se um chatbot novo rodar.
 */
export async function getTirarDuvidasChatIds(chats: any[]): Promise<Set<string>> {
  const agapeId = getAgapeMemberId();
  const candidates = chats.filter((c) => c?.id && hasAgapeInteracted(c, agapeId) && botRuns(c).length > 0);
  if (candidates.length === 0) return new Set();

  const collection = getDb().collection('chatOrigins');
  const cached = await collection
    .find({ chatId: { $in: candidates.map((c) => c.id) } }, { projection: { _id: 0, chatId: 1, origin: 1, botInstanceId: 1 } })
    .toArray();
  const cacheById = new Map(cached.map((d: any) => [d.chatId, d]));

  const result = new Set<string>();
  const pending: Array<{ chat: any; botInstanceId: string | null }> = [];
  for (const chat of candidates) {
    const botInstanceId = botRuns(chat)[0]?.botInstanceId ?? null;
    const hit = cacheById.get(chat.id);
    if (hit && hit.botInstanceId === botInstanceId) {
      if (hit.origin === 'tirar_duvidas') result.add(chat.id);
    } else {
      pending.push({ chat, botInstanceId });
    }
  }

  let next = 0;
  const writes: any[] = [];
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, async () => {
    while (next < pending.length) {
      const { chat, botInstanceId } = pending[next++];
      let promise = inFlight.get(chat.id);
      if (!promise) {
        promise = classify(chat).finally(() => inFlight.delete(chat.id));
        inFlight.set(chat.id, promise);
      }
      try {
        const origin = await promise;
        if (origin === 'tirar_duvidas') result.add(chat.id);
        writes.push({
          updateOne: {
            filter: { chatId: chat.id },
            update: { $set: { chatId: chat.id, origin, botInstanceId, checkedAt: new Date().toISOString() } },
            upsert: true,
          },
        });
      } catch (e) {
        // Sem cache para este chat: tenta de novo na próxima consulta.
        logError(`Origem do chat ${chat.id}`, e);
      }
    }
  }));
  if (writes.length > 0) await collection.bulkWrite(writes, { ordered: false });
  return result;
}
