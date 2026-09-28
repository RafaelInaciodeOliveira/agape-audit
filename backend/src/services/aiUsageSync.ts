import { getDb } from '../config/db.js';
import { getAgapeMemberId } from './businessConfig.js';
import { getEncoding, Tiktoken } from 'js-tiktoken';
import AiUsage from '../models/AiUsage.js';
import { UmblerService } from './umbler.js';

// O agente de IA roda dentro da Umbler: nosso backend não faz a chamada ao LLM.
// A Umbler registra a cobrança em cada resposta do agente (message.billable), então este
// serviço lê as mensagens dos chats do Ágape e grava um AiUsage por resposta cobrada.
//
// - Custo: exato, a partir de billable.deductedCredits × UMBLER_CREDIT_VALUE.
// - Tokens: estimados com tiktoken, porque a Umbler não expõe a contagem real.
//   completion = texto da resposta; prompt = mensagens do cliente desde a resposta anterior
//   (não inclui prompt do sistema, histórico nem trechos da base, então subestima o real).

const SYNC_STATE_KEY = 'aiUsage:umbler';
// Reprocessa uma janela antes do último sync para não perder mensagens que chegaram durante a execução
const OVERLAP_MS = 60 * 60 * 1000;
const CONCURRENCY = 4;
// Id de membro do Ágape na Umbler (o mesmo AGAPE_MEMBER_ID usado em server.ts)
const agentMemberId = () => getAgapeMemberId();

let encoder: Tiktoken | null = null;
function countTokens(text: string) {
  if (!text) return 0;
  encoder ||= getEncoding('o200k_base');
  return encoder.encode(text).length;
}

function creditValue() {
  const value = Number(process.env.UMBLER_CREDIT_VALUE ?? '0.0001');
  return Number.isFinite(value) && value >= 0 ? value : 0.0001;
}

const eventTime = (m: any) => new Date(m.createdAtUTC || m.eventAtUTC || 0).getTime();

async function getSyncState() {
  const db = getDb();
  return db.collection('syncState').findOne({ key: SYNC_STATE_KEY });
}

async function setSyncState(fields: Record<string, unknown>) {
  const db = getDb();
  await db.collection('syncState').updateOne({ key: SYNC_STATE_KEY }, { $set: fields }, { upsert: true });
}

async function mapWithConcurrency<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}

// Converte as mensagens de um chat nos registros de consumo das respostas cobradas do agente
function buildUsageRecords(chat: any, messages: any[], agentMemberId: string) {
  const sorted = [...messages].sort((a, b) => eventTime(a) - eventTime(b));
  const records: any[] = [];
  let pendingPrompt: string[] = [];

  for (const m of sorted) {
    const isAgent = m.sentByOrganizationMember?.id === agentMemberId;
    if (m.source === 'Contact') {
      if (m.content) pendingPrompt.push(m.content);
      continue;
    }
    if (!isAgent) continue;

    const billing = m.billable;
    if (billing?.billable && billing.creditType === 'AI' && typeof billing.deductedCredits === 'number') {
      const credits = billing.deductedCredits;
      const isAudio = Boolean(billing.isAIAudio);
      const tier = billing.botLLM || 'Standard';
      records.push({
        source: 'umbler',
        externalId: m.id,
        chatId: chat.id,
        userId: chat.contact?.id || chat.id,
        userName: chat.contact?.name || undefined,
        modelName: `Umbler ${tier}${isAudio ? ' (áudio)' : ''}`,
        promptTokens: countTokens(pendingPrompt.join('\n')),
        completionTokens: countTokens(m.content || ''),
        credits,
        totalCost: credits * creditValue(),
        isAudio,
        tokensEstimated: true,
        timestamp: new Date(billing.eventAtUTC || m.createdAtUTC || m.eventAtUTC),
      });
    }
    pendingPrompt = [];
  }
  return records;
}

let running: Promise<SyncResult> | null = null;

export interface SyncResult { chatsScanned: number; recordsFound: number; inserted: number; failedChats: number; lastSyncAt: string | null; }

// Evita execuções simultâneas (intervalo automático + botão do painel)
export function syncAiUsageFromUmbler(opts: { full?: boolean } = {}) {
  running ||= runSync(agentMemberId(), opts).finally(() => { running = null; });
  return running;
}

async function runSync(agentMemberId: string, { full = false }: { full?: boolean }): Promise<SyncResult> {
  const startedAt = new Date();
  const state = await getSyncState();
  const since = !full && state?.lastSyncAt ? new Date(state.lastSyncAt).getTime() - OVERLAP_MS : 0;

  const [open, closed] = await Promise.all([
    UmblerService.getChats({ chatState: 'Open', memberId: agentMemberId }),
    UmblerService.getChats({ chatState: 'Closed', memberId: agentMemberId }),
  ]);
  const chatsById = new Map<string, any>();
  for (const chat of [...open.items, ...closed.items]) chatsById.set(chat.id, chat);

  // Só relê chats com atividade desde o último sync
  const chats = [...chatsById.values()].filter((chat) => {
    const last = new Date(chat.lastMessage?.createdAtUTC || chat.lastMessage?.eventAtUTC || 0).getTime();
    return last >= since;
  });

  const records: any[] = [];
  let failedChats = 0;
  await mapWithConcurrency(chats, CONCURRENCY, async (chat) => {
    try {
      const messages = await UmblerService.getChatMessagesWithBilling(chat.id);
      records.push(...buildUsageRecords(chat, messages, agentMemberId));
    } catch (error: any) {
      failedChats++;
      console.error(`[FinOps] Erro ao ler mensagens do chat ${chat.id}:`, error.response?.status || error.message);
    }
  });

  let inserted = 0;
  if (records.length > 0) {
    const result = await AiUsage.bulkWrite(
      records.map((r) => ({
        updateOne: {
          filter: { source: 'umbler', externalId: r.externalId },
          update: { $setOnInsert: r },
          upsert: true,
        },
      })),
      { ordered: false }
    );
    inserted = result.upsertedCount;
  }

  // getChats devolve lista vazia em caso de erro; nesse caso (ou se algum chat falhou) o marcador
  // não avança, para a próxima execução reler o mesmo período em vez de pular mensagens
  const complete = chatsById.size > 0 && failedChats === 0;
  const lastSyncAt = complete ? startedAt.toISOString() : (state?.lastSyncAt ? String(state.lastSyncAt) : null);
  const summary = { chatsScanned: chats.length, recordsFound: records.length, inserted, failedChats };
  await setSyncState(complete ? { lastSyncAt, lastResult: summary } : { lastResult: summary });
  console.log(`[FinOps] Sync Umbler: ${chats.length} chats lidos, ${records.length} respostas cobradas, ${inserted} novas${failedChats ? `, ${failedChats} com erro` : ''}.`);
  return { ...summary, lastSyncAt };
}

export async function getLastAiUsageSync() {
  const state = await getSyncState();
  return state?.lastSyncAt ? String(state.lastSyncAt) : null;
}
