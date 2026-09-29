import { Router } from 'express';
import { listFailReasons, createFailReason, renameFailReason, deleteFailReason, listTopics, createTopic, renameTopic, deleteTopic, createSubtopic, renameSubtopic, deleteSubtopic } from '../controllers/taxonomyController.js';
import { idSchema, paramValidator } from '../validation/schemas.js';

// Montado em /api (caminhos completos iguais aos de antes da separação).
const router = Router();

router.param('id', paramValidator(idSchema));
router.param('topicId', paramValidator(idSchema));

router.get('/fail-reasons', listFailReasons);
router.post('/fail-reasons', createFailReason);
router.put('/fail-reasons/:id', renameFailReason);
router.delete('/fail-reasons/:id', deleteFailReason);
router.get('/topics', listTopics);
router.post('/topics', createTopic);
router.put('/topics/:id', renameTopic);
router.delete('/topics/:id', deleteTopic);
router.post('/topics/:topicId/subtopics', createSubtopic);
router.put('/subtopics/:id', renameSubtopic);
router.delete('/subtopics/:id', deleteSubtopic);

export default router;
