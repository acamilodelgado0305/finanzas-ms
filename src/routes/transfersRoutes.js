import express from 'express';
import {
  createTransferController,
  getTransfersController,
  getTransferByIdController,
  updateTransferController,
  deleteTransferController
} from '../controllers/transfersController.js';

const router = express.Router();

router.post('/transfers', createTransferController);
router.get('/transfers', getTransfersController);
router.get('/transfers/:id', getTransferByIdController);
router.put('/transfers/:id', updateTransferController);
router.delete('/transfers/:id', deleteTransferController);

export default router;
