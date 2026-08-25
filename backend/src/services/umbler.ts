import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const rawToken = (process.env.UMBLER_TOKEN || '').replace(/['"]/g, '').trim();
const organizationId = process.env.UMBLER_ORGANIZATION_ID;

const umblerApi = axios.create({
  baseURL: 'https://app-utalk.umbler.com/api',
  headers: {
    Authorization: `Bearer ${rawToken}`,
    'Content-Type': 'application/json',
  },
});

export const UmblerService = {
  // Busca as etiquetas/tags
  getTags: async () => {
    try {
      const response = await umblerApi.get('/v1/tags/', {
        params: { organizationId },
      });
      return response.data || [];
    } catch (e) {
      console.error('Erro ao buscar tags no Umbler:', e.message);
      return [];
    }
  },

  // Busca a lista de chats de clientes.
  // chatState: 'Open' | 'Closed' | 'All'. memberId: filtra só chats desse membro (ex: o Ágape).
  getChats: async (opts: { chatState?: 'Open' | 'Closed' | 'All'; memberId?: string } = {}) => {
    try {
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
        Take: 250,
        Behavior: 'CountAllAndGetSlice',
      };
      if (opts.memberId) {
        params['Members.Rule'] = 'ContainsAny';
        params['Members.Values'] = opts.memberId;
      }

      const response = await umblerApi.get('/v1/chats/', {
        params,
        paramsSerializer: { indexes: null }, // ContactTypes=DirectMessage&ContactTypes=Group (sem [])
      });

      const data = response.data;
      if (Array.isArray(data)) {
        return { items: data, total: data.length };
      }
      if (data && Array.isArray(data.items)) {
        return { items: data.items, total: data.page?.totalItems ?? data.items.length };
      }
      return { items: [], total: 0 };
    } catch (e) {
      console.error('Erro ao buscar chats no Umbler:', e.response?.data || e.message);
      return { items: [], total: 0 };
    }
  },

  getChatMessages: async (chatId: string) => {
  const organizationId = process.env.UMBLER_ORGANIZATION_ID;

  try {
    const url = `/v1/chats/${chatId}/relative-messages/`;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔎 BUSCANDO HISTÓRICO UMBLER');
    console.log('Chat ID:', chatId);
    console.log('Organization ID:', organizationId);
    console.log('URL:', url);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const response = await umblerApi.get(url, {
      params: {
        organizationId,
        FromEventUTC: new Date().toISOString(),
        Take: 250,
        Direction: 'TakeBefore',
        IncludeMetadata: false,
      }
    });

    console.log('✅ STATUS UMBLER:', response.status);
    console.log('📦 HEADERS UMBLER:', response.headers);
    console.log('📨 RESPOSTA COMPLETA UMBLER:');
    console.dir(response.data, { depth: null });

    const msgs =
      response.data?.messages ??
      response.data?.items ??
      response.data?.data ??
      response.data;

    console.log('🎯 MENSAGENS EXTRAÍDAS:');
    console.dir(msgs, { depth: null });

    if (Array.isArray(msgs)) {
      console.log(`✅ ${msgs.length} mensagens encontradas`);
      return msgs;
    }

    console.warn('⚠️ Resposta não contém um array de mensagens');

    return [];

  } catch (e: any) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ ERRO REAL DA UMBLER');
    console.error('Status:', e.response?.status);
    console.error('Status Text:', e.response?.statusText);
    console.error('URL:', e.config?.url);
    console.error('Params:', e.config?.params);
    console.error('Resposta:', e.response?.data);
    console.error('Mensagem:', e.message);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return [];
  }
},

  // Cria um novo Q&A
  createKnowledgeBaseQA: async (question: string, answer: string) => {
    const kbId = process.env.UMBLER_KB_ID;

    const qaResponse = await umblerApi.post(`/v1/knowledge-bases/${kbId}/qa/`, {
      question,
      answer,
    });

    await umblerApi.post(`/v1/knowledge-bases/${kbId}/ingest/`);
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

    const listResp = await umblerApi.get(`/v1/knowledge-bases/${kbId}/documents/`, {
      params: { organizationId },
    });
    const existing = (listResp.data?.items || []).find(
      (d: any) => (d.fileName || '').replace(/^\.\//, '').trim().toLowerCase() === targetName
    );
    if (existing) {
      await umblerApi.delete(`/v1/knowledge-bases/${kbId}/documents/${existing.id}/`, {
        params: { organizationId },
      });
    }

    const form = new FormData();
    const blob = new Blob([content], { type: 'text/plain' });
    form.append('Document', blob, fileName);
    await umblerApi.post(`/v1/knowledge-bases/${kbId}/documents/`, form, {
      params: { organizationId },
      // A instância tem Content-Type: application/json fixo por padrão; precisa
      // ser removido aqui pra o axios detectar o FormData e montar o multipart certo.
      headers: { 'Content-Type': undefined },
    });

    await umblerApi.post(`/v1/knowledge-bases/${kbId}/ingest/`, {}, { params: { organizationId } });
  },

  // Remove da Umbler o documento correspondente a um arquivo apagado localmente
  // kbId: base de conhecimento de onde remover; se não informado, usa a padrão do .env.
  deleteKnowledgeDocument: async (fileName: string, kbId?: string) => {
    kbId = kbId || process.env.UMBLER_KB_ID;
    const targetName = fileName.replace(/^\.\//, '').trim().toLowerCase();

    const listResp = await umblerApi.get(`/v1/knowledge-bases/${kbId}/documents/`, {
      params: { organizationId },
    });
    const existing = (listResp.data?.items || []).find(
      (d: any) => (d.fileName || '').replace(/^\.\//, '').trim().toLowerCase() === targetName
    );
    if (existing) {
      await umblerApi.delete(`/v1/knowledge-bases/${kbId}/documents/${existing.id}/`, {
        params: { organizationId },
      });
      await umblerApi.post(`/v1/knowledge-bases/${kbId}/ingest/`, {}, { params: { organizationId } });
    }
  },
};