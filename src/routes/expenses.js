import express from 'express';
import {
  getAllExpenses,
  createExpense,
  getExpenseById,
  updateExpense,
  deleteExpense,
  getExpenseVouchers,
  ExpenseManageVouchers
} from '../controllers/ExpenseController.js';



const router = express.Router();

router.get('/expenses', getAllExpenses);
router.post('/expenses', createExpense);
router.get('/expenses/:id', getExpenseById);
router.put('/expenses/:id', updateExpense);
router.delete('/expenses/:id', deleteExpense);
router.get('/expenses/:id/vouchers', getExpenseVouchers);
router.patch('/expenses/:id/vouchers', ExpenseManageVouchers);

export default router;
