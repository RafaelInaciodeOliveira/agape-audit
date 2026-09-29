import { Router } from 'express';
import { getDashboard } from '../controllers/dashboardController.js';

// Montado em /api (caminhos completos iguais aos de antes da separação).
const router = Router();

router.get('/dashboard', getDashboard);

export default router;
