import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient, Db } from 'mongodb';
import { UmblerService } from './services/umbler.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

let dbInstance: Db | null = null;
async function getDb(): Promise<Db> {
  if (dbInstance) return dbInstance;
  const client = new MongoClient(process.env.MONGODB_URI as string);
  await client.connect();
  dbInstance = client.db();
  return dbInstance;
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const DEFAULT_TOPICS: Array<{ name: string; subtopics: string[] }> = [
  { name: 'Cadastros', subtopics: ['Pessoas', 'Grupos', 'Importação'] },
  { name: 'Financeiro', subtopics: ['Fluxo de Caixa', 'Lançamentos', 'Relatórios'] },
  { name: 'Agenda', subtopics: [] },
  { name: 'Aplicativo / Site', subtopics: [] },
  { name: 'Processos e APIs', subtopics: [] },
  { name: 'Suporte Técnico', subtopics: [] },
  { name: 'Onboarding / Primeiros Passos', subtopics: [] },
  { name: 'Vendas / Comercial', subtopics: [] },
  { name: 'Outro', subtopics: [] },
];

async function initDb() {
  const db = await getDb();
  await db.collection('audits').createIndex({ chatId: 1 }, { unique: true });
  await db.collection('messageAudits').createIndex({ chatId: 1, messageId: 1 }, { unique: true });

  const existingTopics = await db.collection('topics').countDocuments();
  if (existingTopics === 0) {
    for (const topic of DEFAULT_TOPICS) {
      const topicId = newId();
      await db.collection('topics').insertOne({ id: topicId, name: topic.name, createdAt: new Date().toISOString() });
      for (const subtopicName of topic.subtopics) {
        await db.collection('subtopics').insertOne({
          id: newId(), topicId, name: subtopicName, createdAt: new Date().toISOString(),
        });
      }
    }
  }
}
initDb().catch((err) => console.error('Erro ao inicializar o MongoDB:', err.message));

const CARTEIRAS = ['ANTARES', 'ARCTURUS', 'ALPHA', 'SIGMA', 'SIRIUS'];
const AGAPE_MEMBER_ID = 'afDzOd4PFUB3xLbX';
const KNOWN_ATTENDANTS = [
  { id: AGAPE_MEMBER_ID, name: 'Ágape (IA)' },
  { id: 'Zfn4fJl90YDKSkka', name: 'Grazi' },
  { id: 'ZuSZZB90jnWXPdJM', name: 'Grasieli Kolaço' },
  { id: 'ZuSZiD4N-bRbWZZf', name: 'Brenda Prover' },
  { id: 'ZuSZiB90jnWXPu0V', name: 'Amanda' },
  { id: 'ZfnQ9OEJHZvJ95w6', name: 'Suporte' },
  { id: 'acpzV_4hy6-atHJl', name: 'Ana Carolina' },
];

app.get('/api/chats', async (req, res) => {
  try {
    const { carteira, search, attendantId, status } = req.query;
    const db = await getDb();
    
    const auditedList = await db.collection('audits').find({}, { projection: { _id: 0 } }).toArray();
    const messageAuditsList = await db.collection('messageAudits').find({}, { projection: { chatId: 1 } }).toArray();
    const chatsWithMessageAudits = new Set(messageAuditsList.map((a: any) => a.chatId));

    const targetStatus = status ? String(status).toLowerCase() : 'finalizados';
    const chatState = targetStatus === 'finalizados' ? 'Closed' : 'Open';

    const { items: umblerChats, total: umblerTotal } = await UmblerService.getChats({
      chatState,
      memberId: attendantId && attendantId !== 'TODOS' ? String(attendantId) : undefined,
    });
    const chatsToProcess = umblerChats || [];

    const analyzedChats = chatsToProcess.map((chat: any) => {
      const audit = auditedList.find((a: any) => a.chatId === chat.id);
      const hasMessageAudits = chatsWithMessageAudits.has(chat.id);
      const combinedTags = [...(chat.tags || []), ...(chat.contact?.tags || [])];
      const tagNames = Array.from(new Set(combinedTags.map((t: any) => t.name).filter(Boolean))) as string[];

      const carteiraTag = tagNames.find((name: string) =>
        CARTEIRAS.some(c => name.toUpperCase().includes(c))
      ) || 'ANTARES';

      const lastMsgFromChat = chat.lastMessage;
      const chatMembers = [
        ...(chat.organizationMembers || []),
        ...(chat.organizationMemberHistory || []).map((h: any) => ({ id: h.memberId })),
      ];
      const hasAgapeInteracted =
        chatMembers.some((m: any) => m?.id === AGAPE_MEMBER_ID) ||
        chat.organizationMember?.id === AGAPE_MEMBER_ID ||
        chat.lastOrganizationMember?.id === AGAPE_MEMBER_ID;

      const lastMsgDate =
        lastMsgFromChat?.createdAtUTC || lastMsgFromChat?.createdAt ||
        chat.updatedAtUTC || chat.updatedAt || chat.createdAt;

      const chatStatus = (chat.closedAtUTC || chat.open === false) ? 'closed' : chat.waiting ? 'waiting' : 'open';

      return {
        id: chat.id,
        contactName: chat.contact?.name || 'Cliente sem nome',
        contactPhone: chat.contact?.phoneNumber,
        contactPhoto: chat.contact?.profilePictureUrl || null,
        carteiraTag,
        allTags: tagNames,
        lastMessage: lastMsgFromChat || null,
        updatedAt: lastMsgDate,
        hasAgapeInteracted,
        chatStatus,
        audit: audit || null,
        hasMessageAudits,
        cachedMessages: []
      };
    });

    let chats = analyzedChats;
    if (targetStatus === 'esperando') {
      chats = chats.filter((c: any) => c.chatStatus === 'waiting');
    } else if (targetStatus === 'entrada') {
      chats = chats.filter((c: any) => c.chatStatus !== 'waiting');
    }
    
    chats.sort((a: any, b: any) => {
      const dateA = new Date(a.updatedAt).getTime() || 0;
      const dateB = new Date(b.updatedAt).getTime() || 0;
      return dateB - dateA;
    });

    if (carteira && carteira !== 'TODAS') {
      chats = chats.filter((c: any) => c.carteiraTag.toUpperCase().includes(String(carteira).toUpperCase()));
    }
    if (search) {
      const term = String(search).toLowerCase();
      chats = chats.filter((c: any) =>
        c.contactName.toLowerCase().includes(term) ||
        JSON.stringify(c.lastMessage).toLowerCase().includes(term) ||
        c.allTags.some((t: string) => t.toLowerCase().includes(term))
      );
    }

    res.json({ total: chats.length, items: chats });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/chats/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const messages = await UmblerService.getChatMessages(id);
    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao buscar mensagens do Umbler' });
  }
});

app.post('/api/audits', async (req, res) => {
  try {
    const { chatId, clientName, carteiraTag, rating, violatedPromptRules, knowledgeBaseFail, auditorFeedback, auditorEmail } = req.body;
    const db = await getDb();
    await db.collection('audits').updateOne(
      { chatId },
      {
        $set: {
          chatId, clientName, carteiraTag, rating,
          violatedPromptRules: violatedPromptRules ? 1 : 0,
          knowledgeBaseFail: knowledgeBaseFail ? 1 : 0,
          auditorFeedback, auditorEmail, createdAt: new Date().toISOString(),
        },
        $setOnInsert: { id: newId() },
      },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/config', (req, res) => {
  res.json({ agapeMemberId: AGAPE_MEMBER_ID, attendants: KNOWN_ATTENDANTS });
});

// TOPICOS / SUBTOPICOS CRUD OMITIDO POR ESPAÇO, PODE MANTER O SEU NORMALMENTE
app.get('/api/topics', async (req, res) => {
  try {
    const db = await getDb();
    const topics = await db.collection('topics').find({}, { projection: { _id: 0 } }).sort({ name: 1 }).toArray();
    const subtopics = await db.collection('subtopics').find({}, { projection: { _id: 0 } }).sort({ name: 1 }).toArray();
    const result = topics.map((t: any) => ({ ...t, subtopics: subtopics.filter((s: any) => s.topicId === t.id) }));
    res.json(result);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});
app.post('/api/topics', async (req, res) => {
  try {
    const { name } = req.body;
    const db = await getDb();
    const id = newId();
    await db.collection('topics').insertOne({ id, name, createdAt: new Date().toISOString() });
    res.json({ id, name, subtopics: [] });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});
app.put('/api/topics/:id', async (req, res) => {
  try {
    const db = await getDb();
    await db.collection('topics').updateOne({ id: req.params.id }, { $set: { name: req.body.name } });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});
app.delete('/api/topics/:id', async (req, res) => {
  try {
    const db = await getDb();
    await db.collection('subtopics').deleteMany({ topicId: req.params.id });
    await db.collection('topics').deleteOne({ id: req.params.id });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});
app.post('/api/topics/:topicId/subtopics', async (req, res) => {
  try {
    const db = await getDb();
    const id = newId();
    await db.collection('subtopics').insertOne({ id, topicId: req.params.topicId, name: req.body.name, createdAt: new Date().toISOString() });
    res.json({ id, topicId: req.params.topicId, name: req.body.name });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});
app.put('/api/subtopics/:id', async (req, res) => {
  try {
    const db = await getDb();
    await db.collection('subtopics').updateOne({ id: req.params.id }, { $set: { name: req.body.name } });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});
app.delete('/api/subtopics/:id', async (req, res) => {
  try {
    const db = await getDb();
    await db.collection('subtopics').deleteOne({ id: req.params.id });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/api/chats/:id/message-audits', async (req, res) => {
  try {
    const db = await getDb();
    const audits = await db.collection('messageAudits').find({ chatId: req.params.id }, { projection: { _id: 0 } }).toArray();
    const byMessageId: Record<string, any> = {};
    for (const a of audits) byMessageId[a.messageId] = a;
    res.json(byMessageId);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/api/message-audits', async (req, res) => {
  try {
    const { chatId, messageId, clientQuestion, topicId, subtopicId, violatedPromptRules, knowledgeBaseFail, auditorFeedback, trainAi, qaQuestion, qaAnswer, auditorEmail } = req.body;
    let generatedQa = 0;
    if (trainAi && qaQuestion && qaAnswer) {
      await UmblerService.createKnowledgeBaseQA(qaQuestion, qaAnswer);
      generatedQa = 1;
    }
    const db = await getDb();
    await db.collection('messageAudits').updateOne(
      { chatId, messageId },
      {
        $set: {
          chatId, messageId, clientQuestion: clientQuestion || null,
          topicId: topicId || null, subtopicId: subtopicId || null,
          violatedPromptRules: violatedPromptRules ? 1 : 0,
          knowledgeBaseFail: knowledgeBaseFail ? 1 : 0,
          auditorFeedback, generatedQa,
          qaQuestion: generatedQa ? qaQuestion : null,
          qaAnswer: generatedQa ? qaAnswer : null,
          auditorEmail, createdAt: new Date().toISOString(),
        },
        $setOnInsert: { id: newId() },
      },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// ==== RELATÓRIOS (COM FILTRO DE DATA E BI AVANÇADO) ====
app.get('/api/reports/themes', async (req, res) => {
  try {
    const { days } = req.query;
    let dateFilter: any = {};
    if (days && days !== 'all') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - parseInt(String(days), 10));
      dateFilter = { createdAt: { $gte: cutoff.toISOString() } };
    }

    const db = await getDb();
    const [audits, topics, subtopics] = await Promise.all([
      db.collection('messageAudits').find(dateFilter, { projection: { _id: 0 } }).toArray(),
      db.collection('topics').find({}, { projection: { _id: 0 } }).toArray(),
      db.collection('subtopics').find({}, { projection: { _id: 0 } }).toArray(),
    ]);
    const topicById = new Map(topics.map((t: any) => [t.id, t.name]));
    const subtopicById = new Map(subtopics.map((s: any) => [s.id, s.name]));

    const groups = new Map<string, any>();
    for (const a of audits) {
      const key = `${a.topicId || ''}::${a.subtopicId || ''}`;
      if (!groups.has(key)) {
        groups.set(key, {
          topicId: a.topicId || null, topicName: a.topicId ? topicById.get(a.topicId) || null : null,
          subtopicId: a.subtopicId || null, subtopicName: a.subtopicId ? subtopicById.get(a.subtopicId) || null : null,
          total: 0, kbFailCount: 0,
        });
      }
      const g = groups.get(key);
      g.total += 1;
      if (a.knowledgeBaseFail) g.kbFailCount += 1;
    }

    const rows = Array.from(groups.values()).sort((a, b) => b.total - a.total);
    res.json(rows);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/api/reports/quality', async (req, res) => {
  try {
    const { days } = req.query;
    let dateFilter: any = {};
    if (days && days !== 'all') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - parseInt(String(days), 10));
      dateFilter = { createdAt: { $gte: cutoff.toISOString() } };
    }

    const db = await getDb();
    const [audits, chatAudits] = await Promise.all([
      db.collection('messageAudits').find(dateFilter, { projection: { _id: 0 } }).toArray(),
      db.collection('audits').find(dateFilter, { projection: { _id: 0 } }).toArray(),
    ]);

    const totalAudited = audits.length;
    // Puxa as métricas exatas de tipos de falha nas respostas
    const violatedCount = audits.filter((a: any) => a.violatedPromptRules).length;
    const kbFailCount = audits.filter((a: any) => a.knowledgeBaseFail).length;

    const ratings = chatAudits.map((a: any) => a.rating).filter((r: any) => typeof r === 'number');
    const avgRating = ratings.length > 0 ? ratings.reduce((s: number, r: number) => s + r, 0) / ratings.length : null;

    const byDayMap = new Map<string, any>();
    for (const a of audits) {
      const day = String(a.createdAt || '').slice(0, 10);
      if (!byDayMap.has(day)) byDayMap.set(day, { day, total: 0, violatedCount: 0, kbFailCount: 0 });
      const d = byDayMap.get(day);
      d.total += 1;
      if (a.violatedPromptRules) d.violatedCount += 1;
      if (a.knowledgeBaseFail) d.kbFailCount += 1;
    }
    const byDay = Array.from(byDayMap.values()).sort((a, b) => a.day.localeCompare(b.day));

    // NOVO: Agrupa o desempenho por Carteira usando as auditorias gerais do Chat
    const byCarteiraMap = new Map<string, any>();
    for (const c of chatAudits) {
      const carteira = c.carteiraTag || 'Outros';
      if (!byCarteiraMap.has(carteira)) byCarteiraMap.set(carteira, { carteira, total: 0, kbFailCount: 0, violatedCount: 0 });
      const d = byCarteiraMap.get(carteira);
      d.total += 1;
      if (c.knowledgeBaseFail) d.kbFailCount += 1;
      if (c.violatedPromptRules) d.violatedCount += 1;
    }
    const byCarteira = Array.from(byCarteiraMap.values()).sort((a, b) => b.total - a.total);

    res.json({ totalAudited, violatedCount, kbFailCount, avgRating, byDay, byCarteira });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/api/reports/value', async (req, res) => {
  try {
    const { days } = req.query;
    let dateFilter: any = {};
    if (days && days !== 'all') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - parseInt(String(days), 10));
      dateFilter = { createdAt: { $gte: cutoff.toISOString() } };
    }

    const db = await getDb();
    const [chatAudits, messageAudits] = await Promise.all([
      db.collection('audits').find(dateFilter, { projection: { _id: 0 } }).toArray(),
      db.collection('messageAudits').find(dateFilter, { projection: { _id: 0 } }).toArray(),
    ]);

    const chatsAudited = chatAudits.length;
    const qaGenerated =
      chatAudits.reduce((s: number, a: any) => s + (a.generatedQa || 0), 0) +
      messageAudits.reduce((s: number, a: any) => s + (a.generatedQa || 0), 0);

    const ratingCounts = new Map<number, number>();
    for (const a of chatAudits) {
      if (typeof a.rating !== 'number') continue;
      ratingCounts.set(a.rating, (ratingCounts.get(a.rating) || 0) + 1);
    }
    const ratingDistribution = Array.from(ratingCounts.entries())
      .map(([rating, count]) => ({ rating, count }))
      .sort((a, b) => b.rating - a.rating); // Decrescente será feito no frontend

    const byDayMap = new Map<string, number>();
    for (const a of messageAudits) {
      const day = String(a.createdAt || '').slice(0, 10);
      byDayMap.set(day, (byDayMap.get(day) || 0) + 1);
    }
    const messagesAuditedByDay = Array.from(byDayMap.entries())
      .map(([day, total]) => ({ day, total }))
      .sort((a, b) => a.day.localeCompare(b.day));

    res.json({ chatsAudited, qaGenerated, ratingDistribution, messagesAuditedByDay });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

function toCsvCell(value: any): string {
  const str = value === null || value === undefined ? '' : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

app.get('/api/reports/export', async (req, res) => {
  try {
    const db = await getDb();
    const [audits, topics, subtopics] = await Promise.all([
      db.collection('messageAudits').find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray(),
      db.collection('topics').find({}, { projection: { _id: 0 } }).toArray(),
      db.collection('subtopics').find({}, { projection: { _id: 0 } }).toArray(),
    ]);
    const topicById = new Map(topics.map((t: any) => [t.id, t.name]));
    const subtopicById = new Map(subtopics.map((s: any) => [s.id, s.name]));

    const header = [
      'Chat ID', 'Mensagem ID', 'Pergunta do Cliente', 'Tópico', 'Subtópico',
      'Violou Diretrizes', 'Falha na Base', 'Observação do Auditor',
      'Gerou Q&A', 'Pergunta Treino', 'Resposta Treino', 'Auditor', 'Data',
    ];
    const lines = [header.map(toCsvCell).join(',')];
    for (const r of audits as any[]) {
      lines.push([
        r.chatId, r.messageId, r.clientQuestion,
        r.topicId ? topicById.get(r.topicId) : '', r.subtopicId ? subtopicById.get(r.subtopicId) : '',
        r.violatedPromptRules ? 'Sim' : 'Não', r.knowledgeBaseFail ? 'Sim' : 'Não', r.auditorFeedback,
        r.generatedQa ? 'Sim' : 'Não', r.qaQuestion, r.qaAnswer, r.auditorEmail, r.createdAt,
      ].map(toCsvCell).join(','));
    }
    const csv = '\uFEFF' + lines.join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="auditorias-agape-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor Restaurado com Sucesso na porta ${PORT}!`);
});