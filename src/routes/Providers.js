import express from 'express';
import upload from '../../config/multerConfig.js';
import {
  getAllProviders,
  createProvider,
  getProviderById,
  updateProvider,
  deleteProvider
} from '../controllers/Proveedores/ProviderController.js';

import { manageAttachments } from '../controllers/Proveedores/funciones/manageAttachments.js';

const router = express.Router();

// Rutas existentes
router.get('/providers', getAllProviders);
router.post('/providers', createProvider);
router.get('/providers/:id', getProviderById);
router.put('/providers/:id', updateProvider);
router.delete('/providers/:id', deleteProvider);

router.patch('/providers/:id/adjuntos', upload.array('adjuntos', 5), manageAttachments);

export default router;
