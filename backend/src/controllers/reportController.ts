import type { Request, Response } from 'express';
import { getDb } from '../config/db.js';
import { sendError } from '../utils/httpErrors.js';
import { parseInput, reportQuerySchema } from '../validation/schemas.js';
import { buildDateFilter, toCsvCell } from '../services/reportHelpers.js';

// Relatórios: temas, qualidade, valor gerado e exportação CSV.

// GET /api/reports/themes
export async function getThemesReport(req: Request, res: Response) {
  try {
    const query = parseInput(reportQuerySchema, req.query, res);
    if (!query) return;
    const { startDate, endDate } = query;
    const dateFilter = buildDateFilter(startDate, endDate);

    const db = getDb();
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
  } catch (error) { sendError(res, error, 'GET /api/reports/themes'); }
}

// GET /api/reports/quality
export async function getQualityReport(req: Request, res: Response) {
  try {
    const query = parseInput(reportQuerySchema, req.query, res);
    if (!query) return;
    const { startDate, endDate } = query;
    const dateFilter = buildDateFilter(startDate, endDate);

    const db = getDb();
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
  } catch (error) { sendError(res, error, 'GET /api/reports/quality'); }
}

// GET /api/reports/value
export async function getValueReport(req: Request, res: Response) {
  try {
    const query = parseInput(reportQuerySchema, req.query, res);
    if (!query) return;
    const { startDate, endDate } = query;
    const dateFilter = buildDateFilter(startDate, endDate);

    const db = getDb();
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
  } catch (error) { sendError(res, error, 'GET /api/reports/value'); }
}

// NOVA LÓGICA: Uma linha por Chat, colunas dinâmicas para as mensagens auditadas
// GET /api/reports/export
export async function exportReportCsv(req: Request, res: Response) {
  try {
    const query = parseInput(reportQuerySchema, req.query, res);
    if (!query) return;
    const { startDate, endDate, reasonId } = query;
    const dateFilter = buildDateFilter(startDate, endDate);

    const db = getDb();
    
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
  } catch (error) { sendError(res, error, 'GET /api/reports/export'); }
}
