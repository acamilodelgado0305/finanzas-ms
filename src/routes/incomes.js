import express from 'express';
import {
  getAllIncomes,
  createIncome,
  getIncomeById,
  updateIncome,
  deleteIncome
} from '../controllers/IncomeController.js';

const router = express.Router();

router.get('/incomes', getAllIncomes);
router.post('/incomes', createIncome);
router.get('/incomes/:id', getIncomeById);
router.put('/incomes/:id', updateIncome);
router.delete('/incomes/:id', deleteIncome);

export default router;
