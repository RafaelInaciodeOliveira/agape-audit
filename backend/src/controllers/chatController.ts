import type { Request, Response } from 'express';
import { getDb } from '../config/db.js';
import { UmblerService } from '../services/umbler.js';
import { getCachedChats } from '../services/chatCache.js';
import { sendError } from '../utils/httpErrors.js';
import { parseInput, chatsQuerySchema, bulkHideBodySchema } from '../validation/schemas.js';
import { getAgapeMemberId, getCarteiras, hasAgapeInteracted, isAgapeBotName, resolveCarteira } from '../services/businessConfig.js';

// Lista de chats (Umbler + auditorias), ocultar/reexibir, mensagens e auditorias por resposta de um chat.

// GET /api/chats
export async function listChats(req: Request, res: Response) {
  try {
    const query = parseInput(chatsQuerySchema, req.query, res);
    if (!query) return;
    const { carteira, search, attendantId, status } = query;
    const db = getDb();
    
    const targetStatus = status ?? 'finalizados';
    const agapeId = getAgapeMemberId();

    // Lista da Umbler vem do cache curto (compartilhado entre requisições e auditores).
    const states: Array<'Open' | 'Closed'> =
      targetStatus === 'ocultos' ? ['Open', 'Closed'] : [targetStatus === 'finalizados' ? 'Closed' : 'Open'];
    const [carteiras, hiddenChatsList, ...results] = await Promise.all([
      getCarteiras(),
      db.collection('hiddenChats').find({}, { projection: { chatId: 1 } }).toArray(),
      ...states.map((state) => getCachedChats(state)),
    ]);
    const hiddenChatsSet = new Set(hiddenChatsList.map((h: any) => h.chatId));
    const truncated = results.some((r) => r.truncated);
    const chatsToProcess = results
      .flatMap((r) => r.items)
      .filter((chat: any) => (targetStatus === 'ocultos') === hiddenChatsSet.has(chat.id));

    // Só as auditorias dos chats retornados, indexadas por chatId (antes: coleções inteiras + find em loop).
    const chatIds = chatsToProcess.map((c: any) => c.id);
    const [auditDocs, chatIdsWithMessageAudits] = await Promise.all([
      db.collection('audits').find({ chatId: { $in: chatIds } }, { projection: { _id: 0 } }).toArray(),
      db.collection('messageAudits').distinct('chatId', { chatId: { $in: chatIds } }),
    ]);
    const auditByChat = new Map(auditDocs.map((a: any) => [a.chatId, a]));
    const chatsWithMessageAudits = new Set(chatIdsWithMessageAudits);

    const analyzedChats = chatsToProcess.map((chat: any) => {
      const audit = auditByChat.get(chat.id);
      const hasMessageAudits = chatsWithMessageAudits.has(chat.id);
      const combinedTags = [...(chat.tags || []), ...(chat.contact?.tags || [])];
      const tagNames = Array.from(new Set(combinedTags.map((t: any) => t.name).filter(Boolean))) as string[];

      const carteiraTag = resolveCarteira(tagNames, carteiras);

      const lastMsgFromChat = chat.lastMessage;

      const agapeInteracted = hasAgapeInteracted(chat, agapeId);

      const lastMsgDate =
        lastMsgFromChat?.createdAtUTC || lastMsgFromChat?.createdAt ||
        chat.updatedAtUTC || chat.updatedAt || chat.createdAt;

      const chatStatus = (chat.closedAtUTC || chat.open === false) ? 'closed' : chat.waiting ? 'waiting' : 'open';

      const isAgapeLastMessage =
        lastMsgFromChat?.sentByOrganizationMember?.id === agapeId ||
        (lastMsgFromChat?.source === 'Bot' && isAgapeBotName(lastMsgFromChat?.botInstance?.botName));

      const effectiveOwnerId = isAgapeLastMessage ? agapeId : chat.organizationMember?.id;

      return {
        id: chat.id,
        contactName: chat.contact?.name || 'Cliente sem nome',
        contactPhone: chat.contact?.phoneNumber,
        contactPhoto: chat.contact?.profilePictureUrl || null,
        carteiraTag,
        allTags: tagNames,
        lastMessage: lastMsgFromChat || null,
        updatedAt: lastMsgDate,
        hasAgapeInteracted: agapeInteracted,
        chatStatus,
        effectiveOwnerId,
        audit: audit || null,
        hasMessageAudits,
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

    if (attendantId && attendantId !== 'TODOS') {
      chats = chats.filter((c: any) => c.effectiveOwnerId === attendantId);
    }
    if (carteira && carteira !== 'TODAS') {
      chats = chats.filter((c: any) => c.carteiraTag.toUpperCase().includes(carteira.toUpperCase()));
    }
    if (search) {
      const term = search.toLowerCase();
      chats = chats.filter((c: any) =>
        c.contactName.toLowerCase().includes(term) ||
        JSON.stringify(c.lastMessage).toLowerCase().includes(term) ||
        c.allTags.some((t: string) => t.toLowerCase().includes(term))
      );
    }

    res.json({ total: chats.length, items: chats, truncated });
  } catch (error) { sendError(res, error, 'GET /api/chats'); }
}

// POST /api/chats/:id/hide
export async function hideChat(req: Request, res: Response) {
  try {
    const db = getDb();
    await db.collection('hiddenChats').updateOne(
      { chatId: req.params.id },
      { $set: { chatId: req.params.id, hiddenAt: new Date().toISOString() } },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (error) { sendError(res, error, 'POST /api/chats/:id/hide'); }
}

// POST /api/chats/bulk-hide  { chatIds: string[] }
// Mesma regra do ocultar individual, em uma única ida ao banco. Upsert por chat:
// ocultar de novo um chat já oculto não duplica nem falha.
export async function bulkHideChats(req: Request, res: Response) {
  try {
    const input = parseInput(bulkHideBodySchema, req.body, res);
    if (!input) return;
    const hiddenAt = new Date().toISOString();
    const result = await getDb().collection('hiddenChats').bulkWrite(
      input.chatIds.map((chatId) => ({
        updateOne: {
          filter: { chatId },
          update: { $set: { chatId, hiddenAt } },
          upsert: true,
        },
      })),
      { ordered: false }
    );
    res.json({ success: true, hidden: input.chatIds.length, newlyHidden: result.upsertedCount });
  } catch (error) { sendError(res, error, 'POST /api/chats/bulk-hide'); }
}

// POST /api/chats/:id/unhide
export async function unhideChat(req: Request, res: Response) {
  try {
    const db = getDb();
    await db.collection('hiddenChats').deleteOne({ chatId: req.params.id });
    res.json({ success: true });
  } catch (error) { sendError(res, error, 'POST /api/chats/:id/unhide'); }
}

// GET /api/chats/:id/messages
export async function getChatMessages(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const messages = await UmblerService.getChatMessages(id);
    res.json(messages);
  } catch (error) { sendError(res, error, 'GET /api/chats/:id/messages'); }
}

// GET /api/chats/:id/message-audits
export async function getChatMessageAudits(req: Request, res: Response) {
  try {
    const db = getDb();
    const audits = await db.collection('messageAudits').find({ chatId: req.params.id }, { projection: { _id: 0 } }).toArray();
    const byMessageId: Record<string, any> = {};
    for (const a of audits) byMessageId[a.messageId] = a;
    res.json(byMessageId);
  } catch (error) { sendError(res, error, 'GET /api/chats/:id/message-audits'); }
}
