import { Router } from 'express';
import { listChats, hideChat, bulkHideChats, unhideChat, getChatMessages, getChatMessageAudits } from '../controllers/chatController.js';
import { idSchema, paramValidator } from '../validation/schemas.js';

// Montado em /api (caminhos completos iguais aos de antes da separação).
const router = Router();

router.param('id', paramValidator(idSchema));

router.get('/chats', listChats);
router.post('/chats/bulk-hide', bulkHideChats);
router.post('/chats/:id/hide', hideChat);
router.post('/chats/:id/unhide', unhideChat);
router.get('/chats/:id/messages', getChatMessages);
router.get('/chats/:id/message-audits', getChatMessageAudits);

export default router;
