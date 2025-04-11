import express from 'express';
import {
  createEtiqueta,
  getEtiquetas,
  getEtiquetaById,
  updateEtiqueta,
  deleteEtiqueta,
} from '../controllers/EtiquetaController.js';

const router = express.Router();

router.post('/etiquetas', createEtiqueta);
router.get('/etiquetas', getEtiquetas);
router.get('/etiquetas/:id', getEtiquetaById);
router.put('/etiquetas/:id', updateEtiqueta);
router.delete('/etiquetas/:id', deleteEtiqueta);

export default router;