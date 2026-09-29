import axios from 'axios';
import dotenv from 'dotenv';
import { logError } from '../utils/logger.js';
import { UmblerError } from '../utils/httpErrors.js';

dotenv.config();

const rawToken = (process.env.UMBLER_TOKEN || '').replace(/['"]/g, '').trim();
const organizationId = process.env.UMBLER_ORGANIZATION_ID;

const umblerApi = axios.create({
  // Sobrescrevível para homologação/testes com uma API simulada.
  baseURL: process.env.UMBLER_API_URL || 'https://app-utalk.umbler.com/api',
  // Sem timeout, uma Umbler travada deixaria a requisição do auditor pendurada para sempre.
  timeout: Number(process.env.UMBLER_TIMEOUT_MS) > 0 ? Number(process.env.UMBLER_TIMEOUT_MS) : 20_000,
  headers: {
    Authorization: `Bearer ${rawToken}`,
    'Content-Type': 'application/json',
  },
});

// Toda falha da Umbler vira UmblerError: as rotas respondem 502 e o log não carrega
// headers (token) nem parâmetros.
umblerApi.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(UmblerError.fromAxios(error))
);

// ---------- Paginação ----------
// Lista de chats: offset (Skip/Take) com `page.totalItems`/`page.maxTake` na resposta.
// Mensagens: cursor por data (FromEventUTC + TakeBefore), no máximo 250 por chamada.
const CHAT_PAGE_SIZE = 250;
const MESSAGE_PAGE_SIZE = 250; // máximo documentado da rota relative-messages
const PAGE_CONCURRENCY = 4;
const envInt = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
};
// Travas de segurança contra históricos gigantes (configuráveis no .env).
export const maxChatsPerQuery = () => envInt('UMBLER_MAX_CHATS', 5000);
export const maxMessagesPerChat = () => envInt('UMBLER_MAX_MESSAGES', 2000);

export const messageTime = (m: any) => new Date(m?.createdAtUTC || m?.eventAtUTC || 0).getTime();
export const chatActivityTime = (chat: any) =>
  new Date(chat?.lastMessage?.createdAtUTC || chat?.lastMessage?.eventAtUTC || chat?.updatedAtUTC || 0).getTime();

export interface ChatsResult {
  items: any[];
  /** Total que a Umbler informa para o filtro (pode ser maior que `items` se truncado). */
  total: number;
  truncated: boolean;
}

export interface GetChatsOptions {
  chatState?: 'Open' | 'Closed' | 'All';
  memberId?: string;
  /** Para de paginar ao chegar em chats sem atividade desde este instante (ms). Requer ordem por última mensagem, desc. */
  activeSince?: number;
  maxItems?: number;
}

async function fetchChatPage(params: Record<string, any>, skip: number, take: number) {
  const response = await umblerApi.get('/v1/chats/', {
    params: { ...params, Skip: skip, Take: take },
    paramsSerializer: { indexes: null }, // ContactTypes=DirectMessage&ContactTypes=Group (sem [])
  });
  const data = response.data;
  if (Array.isArray(data)) return { items: data, totalItems: data.length, maxTake: take };
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    totalItems: Number(data?.page?.totalItems ?? data?.items?.length ?? 0),
    maxTake: Number(data?.page?.maxTake) || take,
  };
}

async function fetchAllChats(opts: GetChatsOptions): Promise<ChatsResult> {
  const params: Record<string, any> = {
    organizationId,
    'Sectors.Rule': 'Any',
    'Tags.Rule': 'Any',
    ContactTypes: ['DirectMessage', 'Group'],
    LastMessage: 'All',
    Order: 'Desc',
    ChatOrderBy: 'LastMessage',
    IncludePinneds: false,
    Visibility: 'Show',
    ChatState: opts.chatState || 'All',
    Behavior: 'CountAllAndGetSlice',
  };
  if (opts.memberId) {
    params['Members.Rule'] = 'ContainsAny';
    params['Members.Values'] = opts.memberId;
  }
  const maxItems = opts.maxItems ?? maxChatsPerQuery();

  const first = await fetchChatPage(params, 0, CHAT_PAGE_SIZE);
  const pageSize = Math.min(CHAT_PAGE_SIZE, first.maxTake);
  const total = first.totalItems;
  const items = [...first.items];
  const wanted = Math.min(total, maxItems);
  const stale = (chat: any) => opts.activeSince !== undefined && chatActivityTime(chat) < opts.activeSince;

  if (opts.activeSince !== undefined) {
    // Incremental: páginas em sequência, parando no primeiro chat sem atividade recente.
    while (items.length < wanted && first.items.length > 0 && !stale(items[items.length - 1])) {
      const page = await fetchChatPage(params, items.length, pageSize);
      if (page.items.length === 0) break;
      items.push(...page.items);
    }
    const fresh = items.filter((c) => !stale(c));
    return { items: fresh, total, truncated: items.length >= maxItems && !stale(items[items.length - 1]) };
  }

  // Completo: com o total conhecido, busca as páginas restantes em paralelo.
  const skips: number[] = [];
  for (let skip = items.length; skip < wanted; skip += pageSize) skips.push(skip);
  const pages: any[][] = new Array(skips.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(PAGE_CONCURRENCY, skips.length) }, async () => {
    while (next < skips.length) {
      const i = next++;
      pages[i] = (await fetchChatPage(params, skips[i], pageSize)).items;
    }
  }));
  for (const page of pages) items.push(...page);

  // Dedup: a lista pode mudar entre páginas (chat recebe mensagem e "sobe").
  const byId = new Map<string, any>();
  for (const chat of items.slice(0, maxItems)) if (chat?.id && !byId.has(chat.id)) byId.set(chat.id, chat);
  return { items: [...byId.values()], total, truncated: total > maxItems };
}

/**
 * Busca mensagens de um chat recuando no tempo, de 250 em 250, até acabar o histórico,
 * atingir `maxMessages` ou passar de `since` (ms). Devolve em ordem cronológica.
 */
async function fetchChatMessages(
  chatId: string,
  { includeMetadata, maxMessages = maxMessagesPerChat(), since }: { includeMetadata: boolean; maxMessages?: number; since?: number }
): Promise<any[]> {
  const byId = new Map<string, any>();
  const noId: any[] = [];
  let cursor = new Date().toISOString();

  while (byId.size + noId.length < maxMessages) {
    const response = await umblerApi.get(`/v1/chats/${encodeURIComponent(chatId)}/relative-messages/`, {
      params: {
        organizationId,
        FromEventUTC: cursor,
        Take: MESSAGE_PAGE_SIZE,
        Direction: 'TakeBefore',
        IncludeMetadata: includeMetadata,
      },
    });
    const data = response.data?.messages ?? response.data?.items ?? response.data?.data ?? response.data;
    const batch: any[] = Array.isArray(data) ? data : [];
    for (const m of batch) {
      if (m?.id) byId.set(m.id, m);
      else noId.push(m);
    }
    if (batch.length < MESSAGE_PAGE_SIZE) break;

    const oldest = Math.min(...batch.map(messageTime).filter((t) => t > 0));
    if (!Number.isFinite(oldest) || oldest >= new Date(cursor).getTime()) break; // cursor não andou
    if (since !== undefined && oldest < since) break;
    cursor = new Date(oldest).toISOString();
  }

  return [...byId.values(), ...noId].sort((a, b) => messageTime(a) - messageTime(b)).slice(-maxMessages);
}

export const UmblerService = {
  // Busca as etiquetas/tags
  getTags: async () => {
    try {
      const response = await umblerApi.get('/v1/tags/', {
        params: { organizationId },
      });
      return response.data || [];
    } catch (e) {
      logError('Umbler getTags', e);
      return [];
    }
  },

  // Busca a lista de chats de clientes, paginando até o fim (ou até UMBLER_MAX_CHATS).
  // chatState: 'Open' | 'Closed' | 'All'. memberId: filtra só chats desse membro (ex: o Ágape).
  // Em caso de erro lança exceção: devolver uma lista parcial esconderia chats sem aviso.
  getChats: async (opts: GetChatsOptions = {}): Promise<ChatsResult> => {
    const result = await fetchAllChats(opts);
    if (result.truncated) {
      console.warn(`[Umbler] getChats(${opts.chatState ?? 'All'}): ${result.total} chats, limitado a ${result.items.length} (UMBLER_MAX_CHATS).`);
    }
    return result;
  },

  // Em caso de falha lança UmblerError (a rota responde 502); antes devolvia [] e a tela
  // mostrava "nenhuma mensagem" num chat que tem histórico.
  getChatMessages: async (chatId: string) => fetchChatMessages(chatId, { includeMetadata: false }),

  // Mensagens com metadados de cobrança (message.billable), usado pelo sync de custos de IA.
  // `since` (ms) interrompe a paginação ao chegar em mensagens já sincronizadas.
  getChatMessagesWithBilling: async (chatId: string, opts: { since?: number } = {}): Promise<any[]> => {
    return fetchChatMessages(chatId, { includeMetadata: true, since: opts.since, maxMessages: envInt('UMBLER_MAX_MESSAGES_FINOPS', 20_000) });
  },

  // Cria um novo Q&A
  createKnowledgeBaseQA: async (question: string, answer: string) => {
    const kbId = process.env.UMBLER_KB_ID;

    const qaResponse = await umblerApi.post(`/v1/knowledge-bases/${encodeURIComponent(kbId)}/qa/`, {
      question,
      answer,
    });

    await umblerApi.post(`/v1/knowledge-bases/${encodeURIComponent(kbId)}/ingest/`);
    return qaResponse.data;
  },

  // Lista todas as bases de conhecimento da conta (pra escolher onde sincronizar cada arquivo)
  listKnowledgeBases: async () => {
    const response = await umblerApi.get('/v1/knowledge-bases/', {
      params: { organizationId },
    });
    return response.data || [];
  },

  // Sincroniza um arquivo da base de conhecimento local com a Umbler:
  // se já existir um documento com esse nome lá, apaga e recria (a API não tem "editar").
  // kbId: base de conhecimento de destino; se não informado, usa a padrão do .env.
  syncKnowledgeDocument: async (fileName: string, content: string, kbId?: string) => {
    kbId = kbId || process.env.UMBLER_KB_ID;
    const targetName = fileName.replace(/^\.\//, '').trim().toLowerCase();

    const listResp = await umblerApi.get(`/v1/knowledge-bases/${encodeURIComponent(kbId)}/documents/`, {
      params: { organizationId },
    });
    const existing = (listResp.data?.items || []).find(
      (d: any) => (d.fileName || '').replace(/^\.\//, '').trim().toLowerCase() === targetName
    );
    if (existing) {
      await umblerApi.delete(`/v1/knowledge-bases/${encodeURIComponent(kbId)}/documents/${encodeURIComponent(existing.id)}/`, {
        params: { organizationId },
      });
    }

    const form = new FormData();
    const blob = new Blob([content], { type: 'text/plain' });
    form.append('Document', blob, fileName);
    await umblerApi.post(`/v1/knowledge-bases/${encodeURIComponent(kbId)}/documents/`, form, {
      params: { organizationId },
      // A instância tem Content-Type: application/json fixo por padrão; precisa
      // ser removido aqui pra o axios detectar o FormData e montar o multipart certo.
      headers: { 'Content-Type': undefined },
    });

    await umblerApi.post(`/v1/knowledge-bases/${encodeURIComponent(kbId)}/ingest/`, {}, { params: { organizationId } });
  },

  // Remove da Umbler o documento correspondente a um arquivo apagado localmente
  // kbId: base de conhecimento de onde remover; se não informado, usa a padrão do .env.
  deleteKnowledgeDocument: async (fileName: string, kbId?: string) => {
    kbId = kbId || process.env.UMBLER_KB_ID;
    const targetName = fileName.replace(/^\.\//, '').trim().toLowerCase();

    const listResp = await umblerApi.get(`/v1/knowledge-bases/${encodeURIComponent(kbId)}/documents/`, {
      params: { organizationId },
    });
    const existing = (listResp.data?.items || []).find(
      (d: any) => (d.fileName || '').replace(/^\.\//, '').trim().toLowerCase() === targetName
    );
    if (existing) {
      await umblerApi.delete(`/v1/knowledge-bases/${encodeURIComponent(kbId)}/documents/${encodeURIComponent(existing.id)}/`, {
        params: { organizationId },
      });
      await umblerApi.post(`/v1/knowledge-bases/${encodeURIComponent(kbId)}/ingest/`, {}, { params: { organizationId } });
    }
  },
};