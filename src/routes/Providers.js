import express from 'express';
import {
  getAllProviders,
  createProvider,
  getProviderById,
  updateProvider,
  deleteProvider
} from '../controllers/ProviderController.js';

const router = express.Router();

router.get('/providers', getAllProviders);
router.post('/providers', createProvider);
router.get('/providers/:id', getProviderById);
router.put('/providers/:id', updateProvider);
router.delete('/providers/:id', deleteProvider);

export default router;
