import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { MongoClient, Db } from 'mongodb';
import { UmblerService } from './services/umbler.js';
import knowledgeRoutes from './routes/knowledgeRoutes.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const mongoUri = process.env.MONGODB_URI || '';
if (mongoUri) {
  mongoose.connect(mongoUri)
    .then(() => console.log('🍃 Mongoose conectado com sucesso ao MongoDB Atlas!'))
    .catch((err) => console.error('❌ Erro ao conectar Mongoose:', err));
}

app.use('/api/knowledge', knowledgeRoutes);

let dbInstance: Db | null = null;
async function getDb(): Promise<Db> {
  if (dbInstance) return dbInstance;
  const client = new MongoClient(mongoUri);
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

  const existingReasons = await db.collection('failReasons').countDocuments();
  if (existingReasons === 0) {
    const DEFAULT_FAIL_REASONS = [
      { id: 'reason_violation', name: 'Violou diretrizes (ex: usou menus, se reapresentou)' },
      { id: 'reason_kb_fail', name: 'Resposta Incorreta / Falta na Base' }
    ];
    for (const fr of DEFAULT_FAIL_REASONS) {
      await db.collection('failReasons').insertOne({ ...fr, createdAt: new Date().toISOString() });
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
    
    const hiddenChatsList = await db.collection('hiddenChats').find({}, { projection: { chatId: 1 } }).toArray();
    const hiddenChatsSet = new Set(hiddenChatsList.map((h: any) => h.chatId));

    const auditedList = await db.collection('audits').find({}, { projection: { _id: 0 } }).toArray();
    const messageAuditsList = await db.collection('messageAudits').find({}, { projection: { chatId: 1 } }).toArray();
    const chatsWithMessageAudits = new Set(messageAuditsList.map((a: any) => a.chatId));

    const targetStatus = status ? String(status).toLowerCase() : 'finalizados';
    let chatsToProcess: any[] = [];

    if (targetStatus === 'ocultos') {
      const [{ items: openChats }, { items: closedChats }] = await Promise.all([
        UmblerService.getChats({ chatState: 'Open', memberId: attendantId && attendantId !== 'TODOS' ? String(attendantId) : undefined }),
        UmblerService.getChats({ chatState: 'Closed', memberId: attendantId && attendantId !== 'TODOS' ? String(attendantId) : undefined })
      ]);
      chatsToProcess = [...(openChats || []), ...(closedChats || [])].filter((chat: any) => hiddenChatsSet.has(chat.id));
    } else {
      const chatState = targetStatus === 'finalizados' ? 'Closed' : 'Open';
      const { items: umblerChats } = await UmblerService.getChats({
        chatState,
        memberId: attendantId && attendantId !== 'TODOS' ? String(attendantId) : undefined,
      });
      chatsToProcess = (umblerChats || []).filter((chat: any) => !hiddenChatsSet.has(chat.id));
    }

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
    if (targetStatus === 'abertos') {
      chats = chats.filter((c: any) => c.chatStatus !== 'closed');
    } else if (targetStatus === 'finalizados') {
      chats = chats.filter((c: any) => c.chatStatus === 'closed');
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
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/api/chats/:id/hide', async (req, res) => {
  try {
    const db = await getDb();
    await db.collection('hiddenChats').updateOne(
      { chatId: req.params.id },
      { $set: { chatId: req.params.id, hiddenAt: new Date().toISOString() } },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/api/chats/:id/unhide', async (req, res) => {
  try {
    const db = await getDb();
    await db.collection('hiddenChats').deleteOne({ chatId: req.params.id });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/api/chats/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const messages = await UmblerService.getChatMessages(id);
    res.json(messages);
  } catch { res.status(500).json({ error: 'Erro ao buscar mensagens do Umbler' }); }
});

app.post('/api/audits', async (req, res) => {
  try {
    const { chatId, clientName, carteiraTag, rating, failReasons, violatedPromptRules, knowledgeBaseFail, auditorFeedback, auditorEmail, topicId, subtopicId } = req.body;
    const db = await getDb();
    
    let isViolated = violatedPromptRules ? 1 : 0;
    let isKbFail = knowledgeBaseFail ? 1 : 0;

    if (Array.isArray(failReasons)) {
       isViolated = failReasons.includes('reason_violation') ? 1 : 0;
       isKbFail = failReasons.includes('reason_kb_fail') ? 1 : 0;
    }

    await db.collection('audits').updateOne(
      { chatId },
      {
        $set: {
          chatId, clientName, carteiraTag, rating,
          topicId: topicId || null,
          subtopicId: subtopicId || null,
          failReasons: failReasons || [],
          violatedPromptRules: isViolated,
          knowledgeBaseFail: isKbFail,
          auditorFeedback, auditorEmail, createdAt: new Date().toISOString(),
        },
        $setOnInsert: { id: newId() },
      },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/api/config', (_req, res) => {
  res.json({
    agapeMemberId: AGAPE_MEMBER_ID,
    attendants: KNOWN_ATTENDANTS,
    defaultKnowledgeBaseId: process.env.UMBLER_KB_ID,
  });
});

app.get('/api/fail-reasons', async (_req, res) => {
  try {
    const db = await getDb();
    const reasons = await db.collection('failReasons').find({}, { projection: { _id: 0 } }).sort({ createdAt: 1 }).toArray();
    res.json(reasons);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/api/fail-reasons', async (req, res) => {
  try {
    const { name } = req.body;
    const db = await getDb();
    const id = newId();
    await db.collection('failReasons').insertOne({ id, name, createdAt: new Date().toISOString() });
    res.json({ id, name });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.put('/api/fail-reasons/:id', async (req, res) => {
  try {
    const db = await getDb();
    await db.collection('failReasons').updateOne({ id: req.params.id }, { $set: { name: req.body.name } });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/fail-reasons/:id', async (req, res) => {
  try {
    const db = await getDb();
    await db.collection('failReasons').deleteOne({ id: req.params.id });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/api/topics', async (_req, res) => {
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
    const { chatId, messageId, clientQuestion, topicId, subtopicId, failReasons, violatedPromptRules, knowledgeBaseFail, auditorFeedback, trainAi, targetModule, qaQuestion, qaAnswer, auditorEmail } = req.body;
    
    const db = await getDb();
    
    // 1. Busca a auditoria existente para não zerar a flag de QA se ela já foi treinada
    const existingAudit = await db.collection('messageAudits').findOne({ chatId, messageId });
    let generatedQa = existingAudit?.generatedQa || 0;

    let isViolated = violatedPromptRules ? 1 : 0;
    let isKbFail = knowledgeBaseFail ? 1 : 0;

    if (Array.isArray(failReasons)) {
       isViolated = failReasons.includes('reason_violation') ? 1 : 0;
       isKbFail = failReasons.includes('reason_kb_fail') ? 1 : 0;
    }

    if (trainAi && qaQuestion && qaAnswer) {
      await db.collection('knowledge').insertOne({
        id: newId(),
        module: targetModule || 'Módulo Geral',
        section: 'Auditorias Recentes',
        title: qaQuestion,
        content: qaAnswer,
        source: 'auditoria',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      generatedQa = 1;
    }

    await db.collection('messageAudits').updateOne(
      { chatId, messageId },
      {
        $set: {
          chatId, messageId, clientQuestion: clientQuestion || null,
          topicId: topicId || null, subtopicId: subtopicId || null,
          failReasons: failReasons || [],
          violatedPromptRules: isViolated,
          knowledgeBaseFail: isKbFail,
          auditorFeedback, generatedQa,
          targetModule: targetModule || null,
          qaQuestion: generatedQa ? (existingAudit?.qaQuestion || qaQuestion) : null,
          qaAnswer: generatedQa ? (existingAudit?.qaAnswer || qaAnswer) : null,
          auditorEmail, createdAt: new Date().toISOString(),
        },
        $setOnInsert: { id: newId() },
      },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/api/reports/themes', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let dateFilter: any = {};
    if (startDate && endDate) {
      dateFilter = { createdAt: { $gte: `${startDate}T00:00:00.000Z`, $lte: `${endDate}T23:59:59.999Z` } };
    }

    const db = await getDb();
    const [msgAudits, chatAudits, topics, subtopics] = await Promise.all([
      db.collection('messageAudits').find(dateFilter, { projection: { _id: 0 } }).toArray(),
      db.collection('audits').find(dateFilter, { projection: { _id: 0 } }).toArray(),
      db.collection('topics').find({}, { projection: { _id: 0 } }).toArray(),
      db.collection('subtopics').find({}, { projection: { _id: 0 } }).toArray(),
    ]);
    const topicById = new Map(topics.map((t: any) => [t.id, t.name]));
    const subtopicById = new Map(subtopics.map((s: any) => [s.id, s.name]));

    const allAudits = [...msgAudits, ...chatAudits];

    const groups = new Map<string, any>();
    for (const a of allAudits) {
      if (!a.messageId && !a.topicId && !a.subtopicId) continue;

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
    const { startDate, endDate } = req.query;
    let dateFilter: any = {};
    if (startDate && endDate) {
      dateFilter = { createdAt: { $gte: `${startDate}T00:00:00.000Z`, $lte: `${endDate}T23:59:59.999Z` } };
    }

    const db = await getDb();
    const [audits, chatAudits, allReasons] = await Promise.all([
      db.collection('messageAudits').find(dateFilter, { projection: { _id: 0 } }).toArray(),
      db.collection('audits').find(dateFilter, { projection: { _id: 0 } }).toArray(),
      db.collection('failReasons').find({}, { projection: { _id: 0 } }).toArray(),
    ]);

    const totalAudited = audits.length;
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

    const reasonMap = new Map(allReasons.map((r: any) => [r.id, r.name]));
    const reasonCounts = new Map<string, number>();

    const processReasons = (arr: any[]) => {
      for (const item of arr) {
         if (item.failReasons && Array.isArray(item.failReasons) && item.failReasons.length > 0) {
           for (const rId of item.failReasons) {
             reasonCounts.set(rId, (reasonCounts.get(rId) || 0) + 1);
           }
         } else {
           if (item.violatedPromptRules) reasonCounts.set('reason_violation', (reasonCounts.get('reason_violation') || 0) + 1);
           if (item.knowledgeBaseFail) reasonCounts.set('reason_kb_fail', (reasonCounts.get('reason_kb_fail') || 0) + 1);
         }
      }
    };

    processReasons(audits);
    processReasons(chatAudits);

    const reasonsDistribution = Array.from(reasonCounts.entries())
      .map(([id, count]) => ({ id, name: reasonMap.get(id) || id, count }))
      .sort((a, b) => b.count - a.count);

    res.json({ totalAudited, violatedCount, kbFailCount, avgRating, byDay, byCarteira, reasonsDistribution });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/api/reports/value', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let dateFilter: any = {};
    if (startDate && endDate) {
      dateFilter = { createdAt: { $gte: `${startDate}T00:00:00.000Z`, $lte: `${endDate}T23:59:59.999Z` } };
    }

    const db = await getDb();
    const [chatAudits, messageAudits, qaGenerated] = await Promise.all([
      db.collection('audits').find(dateFilter, { projection: { _id: 0 } }).toArray(),
      db.collection('messageAudits').find(dateFilter, { projection: { _id: 0 } }).toArray(),
      // CONTAGEM BLINDADA: Conta diretamente as inserções reais feitas na base de conhecimento!
      db.collection('knowledge').countDocuments({ source: 'auditoria', ...dateFilter })
    ]);

    const chatsAudited = chatAudits.length;

    const ratingCounts = new Map<number, number>();
    for (const a of chatAudits) {
      if (typeof a.rating !== 'number') continue;
      ratingCounts.set(a.rating, (ratingCounts.get(a.rating) || 0) + 1);
    }
    const ratingDistribution = Array.from(ratingCounts.entries())
      .map(([rating, count]) => ({ rating, count }))
      .sort((a, b) => b.rating - a.rating);

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

// NOVA LÓGICA: Uma linha por Chat, colunas dinâmicas para as mensagens auditadas
app.get('/api/reports/export', async (req, res) => {
  try {
    const { startDate, endDate, reasonId } = req.query;
    let dateFilter: any = {};
    if (startDate && endDate) {
      dateFilter = { createdAt: { $gte: `${startDate}T00:00:00.000Z`, $lte: `${endDate}T23:59:59.999Z` } };
    }

    const db = await getDb();
    
    const [messageAuditsRaw, chatAuditsRaw, hiddenChatsList, topics, subtopics, failReasons] = await Promise.all([
      db.collection('messageAudits').find(dateFilter).sort({ createdAt: 1 }).toArray(), // 1 para ordem cronológica
      db.collection('audits').find(dateFilter).sort({ createdAt: -1 }).toArray(),
      db.collection('hiddenChats').find({}, { projection: { chatId: 1 } }).toArray(),
      db.collection('topics').find({}, { projection: { _id: 0 } }).toArray(),
      db.collection('subtopics').find({}, { projection: { _id: 0 } }).toArray(),
      db.collection('failReasons').find({}, { projection: { _id: 0 } }).toArray(),
    ]);

    const hiddenChatsSet = new Set(hiddenChatsList.map((h: any) => h.chatId));

    // Remove os ocultos da lista bruta
    const validChatAudits = chatAuditsRaw.filter((a: any) => !hiddenChatsSet.has(a.chatId));
    const validMessageAudits = messageAuditsRaw.filter((a: any) => !hiddenChatsSet.has(a.chatId));

    const topicById = new Map(topics.map((t: any) => [t.id, t.name]));
    const subtopicById = new Map(subtopics.map((s: any) => [s.id, s.name]));
    const reasonById = new Map(failReasons.map((r: any) => [r.id, r.name]));

    const formatReasons = (reasonsArr: string[], vRules: any, kbFail: any) => {
      if (reasonsArr && reasonsArr.length > 0) {
        return reasonsArr.map((id: string) => reasonById.get(id) || id).join(', ');
      }
      let old = [];
      if (vRules) old.push('Violou diretrizes');
      if (kbFail) old.push('Falta na base');
      return old.length > 0 ? old.join(', ') : '-';
    };

    // AGRUPADOR: Junta auditoria geral e de mensagens no mesmo Chat ID
    const groupedChats = new Map<string, any>();

    for (const c of validChatAudits) {
      groupedChats.set(c.chatId, {
        chatAudit: c,
        msgAudits: [],
        createdAt: new Date(c.createdAt),
        clientName: c.clientName || 'Desconhecido',
        carteiraTag: c.carteiraTag || '-'
      });
    }

    for (const m of validMessageAudits) {
      if (!groupedChats.has(m.chatId)) {
        // Se a pessoa auditou só a mensagem, mas não deu nota geral ainda
        groupedChats.set(m.chatId, {
          chatAudit: null,
          msgAudits: [m],
          createdAt: new Date(m.createdAt),
          clientName: 'Desconhecido',
          carteiraTag: '-'
        });
      } else {
        groupedChats.get(m.chatId).msgAudits.push(m);
      }
    }

    const finalGroups = [];
    let maxMessagesInSingleChat = 0;

    // FILTRO DE RANKING DE FALHAS
    for (const group of groupedChats.values()) {
      let keep = true;
      if (reasonId) {
        const chatHasReason = group.chatAudit && (
          (group.chatAudit.failReasons && group.chatAudit.failReasons.includes(reasonId)) ||
          (reasonId === 'reason_violation' && group.chatAudit.violatedPromptRules) ||
          (reasonId === 'reason_kb_fail' && group.chatAudit.knowledgeBaseFail)
        );
        const msgHasReason = group.msgAudits.some((m: any) => 
          (m.failReasons && m.failReasons.includes(reasonId)) ||
          (reasonId === 'reason_violation' && m.violatedPromptRules) ||
          (reasonId === 'reason_kb_fail' && m.knowledgeBaseFail)
        );
        keep = chatHasReason || msgHasReason;
      }
      
      if (keep) {
        if (group.msgAudits.length > maxMessagesInSingleChat) {
          maxMessagesInSingleChat = group.msgAudits.length;
        }
        finalGroups.push(group);
      }
    }

    // Ordena do mais recente para o mais antigo
    finalGroups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Montando o Cabeçalho Base
    const header = [
      'Data da Auditoria', 'Hora', 'Cliente', 'Carteira', 'Nota Geral',
      'Tópico Geral', 'Subtópico Geral', 'Motivos de Falha Geral', 'Feedback Geral'
    ];

    // Adiciona as colunas dinâmicas com base no chat que teve mais mensagens corrigidas
    for (let i = 1; i <= maxMessagesInSingleChat; i++) {
      header.push(
        `Pergunta do Cliente ${i}`,
        `Tópico (Msg ${i})`,
        `Subtópico (Msg ${i})`,
        `Motivos de Falha (Msg ${i})`,
        `Feedback (Msg ${i})`,
        `Gerou Q&A? (Msg ${i})`
      );
    }

    const lines = [header.map(toCsvCell).join(';')];

    // Preenchendo os dados (Uma linha por chat)
    for (const group of finalGroups) {
      const c = group.chatAudit || {};
      const row = [
        group.createdAt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        group.createdAt.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }),
        group.clientName,
        group.carteiraTag,
        c.rating ? `${c.rating} Estrelas` : 'Sem nota',
        c.topicId ? topicById.get(c.topicId) || c.topicId : '-',
        c.subtopicId ? subtopicById.get(c.subtopicId) || c.subtopicId : '-',
        formatReasons(c.failReasons, c.violatedPromptRules, c.knowledgeBaseFail),
        c.auditorFeedback || '-'
      ];

      // Preenchendo as colunas dinâmicas de cada mensagem
      for (let i = 0; i < maxMessagesInSingleChat; i++) {
        const m = group.msgAudits[i];
        if (m) {
          row.push(
            m.clientQuestion || '-',
            m.topicId ? topicById.get(m.topicId) || m.topicId : '-',
            m.subtopicId ? subtopicById.get(m.subtopicId) || m.subtopicId : '-',
            formatReasons(m.failReasons, m.violatedPromptRules, m.knowledgeBaseFail),
            m.auditorFeedback || '-',
            m.generatedQa ? 'Sim' : 'Não'
          );
        } else {
          // Se esse chat teve menos mensagens corrigidas que o máximo, deixa os campos com "-"
          row.push('-', '-', '-', '-', '-', '-');
        }
      }

      lines.push(row.map(toCsvCell).join(';'));
    }

    const csv = '\uFEFF' + lines.join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    const fileNameSuffix = reasonId ? `-filtro-falha` : '';
    res.setHeader('Content-Disposition', `attachment; filename="auditorias-agape${fileNameSuffix}-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/api/webhooks/strapi', async (req, res) => {
  try {
    const { event, entry } = req.body;

    if (event === 'entry.create' || event === 'entry.publish' || event === 'entry.update') {
      const title = entry?.title || entry?.titulo || entry?.name || 'Nova Atualização do Sistema';
      const content = entry?.content || entry?.conteudo || entry?.description || entry?.texto || '';

      if (!content) return res.status(400).json({ error: 'Artigo sem conteúdo, ignorado.' });

      const qaQuestion = `Quais são as novidades sobre: ${title}?`;
      const qaAnswer = `Sobre a novidade "${title}":\n\n${content}`;

      const db = await getDb();
      await db.collection('knowledge').insertOne({
        id: newId(),
        module: 'Novidades Prover',
        section: 'Base Geral de Conhecimento',
        title: qaQuestion,
        content: qaAnswer,
        source: 'strapi_webhook',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      console.log(`🚀 Strapi Webhook: Novidade '${title}' salva no TXT Novidades Prover!`);
      return res.json({ success: true, message: 'Novidade recebida e salva na Base de Conhecimento!' });
    }

    res.json({ success: true, message: 'Evento ignorado (não é criação/publicação).' });
  } catch (error: any) {
    console.error('Erro no Webhook do Strapi:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// --- ROTA DO DASHBOARD DE BOAS-VINDAS ---
app.get('/api/dashboard', async (req, res) => {
  try {
    const db = await getDb();
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const newStrapiRules = await db.collection('knowledge').countDocuments({
      source: 'strapi_webhook',
      createdAt: { $gte: yesterday }
    });

    const recentAudits = await db.collection('audits').find({
      createdAt: { $gte: lastWeek }
    }).toArray();
    const ratings = recentAudits.map((a: any) => a.rating).filter((r: any) => typeof r === 'number');
    const weeklyAvgRating = ratings.length > 0 ? (ratings.reduce((a: number,b: number)=>a+b,0)/ratings.length).toFixed(1) : '0.0';

    const { items: openChats } = await UmblerService.getChats({ chatState: 'Open' });
    
    // Puxa as auditorias
    const auditedList = await db.collection('audits').find({}, { projection: { chatId: 1 } }).toArray();
    const auditedSet = new Set(auditedList.map((a: any) => a.chatId));

    // CORREÇÃO: Puxa a lista de chats ocultos para o dashboard ignorar eles
    const hiddenChatsList = await db.collection('hiddenChats').find({}, { projection: { chatId: 1 } }).toArray();
    const hiddenChatsSet = new Set(hiddenChatsList.map((h: any) => h.chatId));
    
    // Conta apenas os que a IA atuou, que NÃO foram auditados e NÃO estão ocultos
    const pendingChats = (openChats || []).filter((chat: any) => {
      if (auditedSet.has(chat.id) || hiddenChatsSet.has(chat.id)) return false;

      const chatMembers = [
        ...(chat.organizationMembers || []),
        ...(chat.organizationMemberHistory || []).map((h: any) => ({ id: h.memberId })),
      ];
      const hasAgapeInteracted =
        chatMembers.some((m: any) => m?.id === AGAPE_MEMBER_ID) ||
        chat.organizationMember?.id === AGAPE_MEMBER_ID ||
        chat.lastOrganizationMember?.id === AGAPE_MEMBER_ID;

      return hasAgapeInteracted;
    }).length;

    res.json({ newStrapiRules, weeklyAvgRating, pendingChats, auditsThisWeek: ratings.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor Restaurado e Mongoose Conectado na porta ${PORT}!`);
});