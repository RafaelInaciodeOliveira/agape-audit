import { Router } from 'express';
import { getConfig } from '../controllers/configController.js';

// Montado em /api (caminhos completos iguais aos de antes da separação).
const router = Router();

router.get('/config', getConfig);

export default router;
