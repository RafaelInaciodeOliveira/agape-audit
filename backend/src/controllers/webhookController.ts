import type { Request, Response } from 'express';
import { getDb } from '../config/db.js';
import { newId } from '../utils/ids.js';
import { logError } from '../utils/logger.js';
import { sendError } from '../utils/httpErrors.js';
import { strapiToText } from '../services/strapiContent.js';

// Webhook do Strapi: novidades publicadas viram itens do módulo "Novidades Prover".

// POST /api/webhooks/strapi
export async function handleStrapiWebhook(req: Request, res: Response) {
  // Proteção opcional: no painel do Strapi, adicione o header "Authorization: Bearer <STRAPI_WEBHOOK_SECRET>"
  const secret = process.env.STRAPI_WEBHOOK_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    console.warn('[Strapi] Webhook recusado: header Authorization ausente ou inválido.');
    return res.status(401).json({ error: 'Não autorizado.' });
  }

  try {
    // Strapi v4 e v5 enviam { event, model, uid, entry }; "data" cobre integrações customizadas
    const { event, model, uid } = req.body || {};
    const entry = req.body?.entry || req.body?.data;
    const entryId = entry?.documentId || entry?.id;

    if (!event || !entry) {
      console.warn('[Strapi] Payload sem "event" ou "entry"; nada a fazer.');
      return res.json({ success: true, message: 'Ignorado: payload sem event/entry.' });
    }

    // Chave estável do artigo no Strapi: evita duplicar o card a cada create/update/publish
    const strapiKey = entryId != null ? `${model || uid || 'entry'}:${entryId}` : null;
    const db = getDb();

    if (event === 'entry.unpublish' || event === 'entry.delete') {
      if (!strapiKey) return res.json({ success: true, message: 'Ignorado: entrada sem id.' });
      try {
        const { deletedCount } = await db.collection('knowledge').deleteMany({ source: 'strapi_webhook', strapiKey });
        console.log(`[Strapi] ${event}: ${deletedCount} item(ns) removido(s) de Novidades Prover (${strapiKey}).`);
      } catch (dbError: any) {
        logError('Strapi remover novidade', dbError);
        throw dbError;
      }
      return res.json({ success: true, message: 'Novidade removida da Base de Conhecimento.' });
    }

    if (event !== 'entry.create' && event !== 'entry.update' && event !== 'entry.publish') {
      return res.json({ success: true, message: `Evento ignorado: ${event}.` });
    }

    // Com Draft & Publish ativo, create/update de rascunho chegam com publishedAt = null
    if ('publishedAt' in entry && !entry.publishedAt) {
      console.log(`[Strapi] ${event} ignorado: "${entry.title}" ainda é rascunho (publishedAt = null).`);
      return res.json({ success: true, message: 'Ignorado: rascunho não publicado.' });
    }

    const title = strapiToText(entry.title).replace(/[\s:;,.-]+$/, '');
    const description = strapiToText(entry.description_prover) || strapiToText(entry.description_catholic);

    if (!title || !description) {
      console.warn('[Strapi] Ignorado: artigo sem título ou descrição. Campos recebidos em entry:', Object.keys(entry).join(', '));
      return res.json({ success: true, message: 'Ignorado: sem título ou descrição' });
    }

    const steps = Array.isArray(entry.step)
      ? entry.step.map((s: any) => strapiToText(s?.text ?? s)).filter(Boolean).join('\n')
      : '';

    const qaQuestion = `Quais são as novidades sobre: ${title}?`;
    const qaAnswer = steps ? `${description}\n\n${steps}` : description;

    const releaseDate = entry.release || entry.publishedAt;
    const nowIso = new Date().toISOString();

    try {
      const filter = strapiKey ? { source: 'strapi_webhook', strapiKey } : { source: 'strapi_webhook', title: qaQuestion };
      const result = await db.collection('knowledge').updateOne(
        filter,
        {
          $set: {
            title: qaQuestion,
            content: qaAnswer,
            releaseDate: releaseDate ? new Date(releaseDate).toISOString() : null,
            updatedAt: nowIso,
          },
          $setOnInsert: {
            id: newId(),
            module: 'Novidades Prover',
            section: 'Base Geral de Conhecimento',
            source: 'strapi_webhook',
            strapiKey,
            createdAt: nowIso,
          },
        },
        { upsert: true }
      );
      const action = result.upsertedCount ? 'criada' : 'atualizada';
      console.log(`🚀 [Strapi] ${event}: novidade '${title}' ${action} em Novidades Prover (${strapiKey}).`);
      return res.json({ success: true, message: `Novidade ${action} na Base de Conhecimento!` });
    } catch (dbError: any) {
      logError('Strapi salvar novidade', dbError);
      throw dbError;
    }
  } catch (error: any) {
    return sendError(res, error, 'POST /api/webhooks/strapi');
  }
}
