import express from 'express';
import {
  getAllExpenses,
  createExpense,
  getExpenseById,
  updateExpense,
  deleteExpense
} from '../controllers/ExpenseController.js';

const router = express.Router();

router.get('/expenses', getAllExpenses);
router.post('/expenses', createExpense);
router.get('/expenses/:id', getExpenseById);
router.put('/expenses/:id', updateExpense);
router.delete('/expenses/:id', deleteExpense);

export default router;
