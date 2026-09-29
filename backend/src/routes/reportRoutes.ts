import { Router } from 'express';
import { getThemesReport, getQualityReport, getValueReport, exportReportCsv } from '../controllers/reportController.js';

// Montado em /api (caminhos completos iguais aos de antes da separação).
const router = Router();

router.get('/reports/themes', getThemesReport);
router.get('/reports/quality', getQualityReport);
router.get('/reports/value', getValueReport);
router.get('/reports/export', exportReportCsv);

export default router;
