import express from 'express';
import {
  createTransactionController,
  getTransactionsController,
  getTransactionByIdController,
  updateTransactionController,
  deleteTransactionController
} from '../controllers/transaccionController.js';

const router = express.Router();

router.post('/transactions', createTransactionController);
router.get('/transactions', getTransactionsController);
router.get('/transactions/:id', getTransactionByIdController);
router.put('/transactions/:id', updateTransactionController);
router.delete('/transactions/:id', deleteTransactionController);

export default router;

