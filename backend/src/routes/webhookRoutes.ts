import { Router } from 'express';
import { handleStrapiWebhook } from '../controllers/webhookController.js';

// Montado em /api (caminhos completos iguais aos de antes da separação).
const router = Router();

router.post('/webhooks/strapi', handleStrapiWebhook);

export default router;
