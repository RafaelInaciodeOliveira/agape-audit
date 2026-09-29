import type { Request, Response } from 'express';
import { getDb } from '../config/db.js';
import { newId } from '../utils/ids.js';
import { sendError } from '../utils/httpErrors.js';
import { parseInput, chatAuditBodySchema, messageAuditBodySchema } from '../validation/schemas.js';

// Gravação das auditorias: geral (por chat) e por resposta do Ágape.

// POST /api/audits
export async function saveChatAudit(req: Request, res: Response) {
  try {
    const input = parseInput(chatAuditBodySchema, req.body, res);
    if (!input) return;
    const { chatId, clientName, carteiraTag, rating, failReasons, violatedPromptRules, knowledgeBaseFail, auditorFeedback, topicId, subtopicId } = input;
    // O auditor é quem está autenticado (assinado no JWT); o valor enviado pelo cliente é só fallback.
    const auditorEmail = req.user?.sub || input.auditorEmail || null;
    const nowIso = new Date().toISOString();
    const db = getDb();
    
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
          auditorFeedback, auditorEmail, updatedAt: nowIso,
        },
        $setOnInsert: { id: newId(), createdAt: nowIso },
      },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (error) { sendError(res, error, 'POST /api/audits'); }
}

// POST /api/message-audits
export async function saveMessageAudit(req: Request, res: Response) {
  try {
    const input = parseInput(messageAuditBodySchema, req.body, res);
    if (!input) return;
    const { chatId, messageId, clientQuestion, topicId, subtopicId, failReasons, violatedPromptRules, knowledgeBaseFail, auditorFeedback, trainAi, targetModule, qaQuestion, qaAnswer } = input;
    const auditorEmail = req.user?.sub || input.auditorEmail || null;
    const nowIso = new Date().toISOString();
    
    const db = getDb();
    
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
          auditorEmail, updatedAt: nowIso,
        },
        $setOnInsert: { id: newId(), createdAt: nowIso },
      },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (error) { sendError(res, error, 'POST /api/message-audits'); }
}
