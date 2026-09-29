import { Router } from 'express';
import { saveChatAudit, saveMessageAudit } from '../controllers/auditController.js';

// Montado em /api (caminhos completos iguais aos de antes da separação).
const router = Router();

router.post('/audits', saveChatAudit);
router.post('/message-audits', saveMessageAudit);

export default router;
