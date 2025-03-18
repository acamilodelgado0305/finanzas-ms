import upload from "../../config/multerConfig.js";
import express from 'express';

import {
  getAllExpenses,
  createExpense,
  getExpenseById,
  updateExpense,
  deleteExpense,
} from '../controllers/Expense/ExpenseController.js';

import {
  getExpenseVouchers,
  ExpenseManageVouchers,
  getExpensesWithFalseState,
  updateExpenseStatus,
  bulkUploadExpenses
} from '../controllers/Expense/funciones/ExpenseFunciones.js';

const router = express.Router();

router.get('/expenses', getAllExpenses);
router.get('/expenses/false', getExpensesWithFalseState);
router.post('/expenses', createExpense);
router.get('/expenses/:id', getExpenseById);
router.put('/expenses/:id', updateExpense);
router.put('/expenses/:id/status', updateExpenseStatus);
router.delete('/expenses/:id', deleteExpense);
router.get('/expenses/:id/vouchers', getExpenseVouchers);
router.patch('/expenses/:id/vouchers', ExpenseManageVouchers);

// ✅ Nueva ruta para carga masiva
router.post("/expenses/bulk-upload", upload.single("file"), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Archivo no recibido. Asegúrate de que el campo se llame "file".' });
  }
  next();
}, bulkUploadExpenses);

export default router;