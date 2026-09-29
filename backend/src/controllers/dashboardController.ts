import type { Request, Response } from 'express';
import { getDb } from '../config/db.js';
import { getCachedChats } from '../services/chatCache.js';
import { sendError } from '../utils/httpErrors.js';
import { getAgapeMemberId, hasAgapeInteracted } from '../services/businessConfig.js';

// Resumo do dia exibido no modal de boas-vindas.

// --- ROTA DO DASHBOARD DE BOAS-VINDAS ---
// GET /api/dashboard
export async function getDashboard(req: Request, res: Response) {
  try {
    const db = getDb();
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

    const { items: openChats } = await getCachedChats('Open');
    const openIds = openChats.map((c: any) => c.id);

    // Puxa só as auditorias dos chats abertos
    const auditedIds = await db.collection('audits').distinct('chatId', { chatId: { $in: openIds } });
    const auditedSet = new Set(auditedIds);

    // CORREÇÃO: Puxa a lista de chats ocultos para o dashboard ignorar eles
    const hiddenChatsList = await db.collection('hiddenChats').find({}, { projection: { chatId: 1 } }).toArray();
    const hiddenChatsSet = new Set(hiddenChatsList.map((h: any) => h.chatId));
    
    // Conta apenas os que a IA atuou, que NÃO foram auditados e NÃO estão ocultos
    const agapeId = getAgapeMemberId();
    const pendingChats = (openChats || []).filter((chat: any) =>
      !auditedSet.has(chat.id) && !hiddenChatsSet.has(chat.id) && hasAgapeInteracted(chat, agapeId)
    ).length;

    res.json({ newStrapiRules, weeklyAvgRating, pendingChats, auditsThisWeek: ratings.length });
  } catch (error: any) {
    return sendError(res, error, 'GET /api/dashboard');
  }
}
