import { Router } from 'express';
import { getCosts, syncUsage } from '../controllers/finopsController.js';

const router = Router();

router.get('/costs', getCosts);
router.post('/sync', syncUsage);

export default router;
