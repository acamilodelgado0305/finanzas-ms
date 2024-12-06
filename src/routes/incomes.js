import express from 'express';
import {
  getAllIncomes,
  createIncome,
  getIncomeById,
  updateIncome,
  deleteIncome,
  manageVouchers,
  getIncomeVouchers
} from '../controllers/IncomeController.js';

const router = express.Router();

router.get('/incomes', getAllIncomes);
router.post('/incomes', createIncome);
router.get('/incomes/:id', getIncomeById);
router.put('/incomes/:id', updateIncome);
router.delete('/incomes/:id', deleteIncome);
router.patch('/incomes/:id/vouchers', manageVouchers); // Nueva ruta para gestionar vouchers
router.get('/incomes/:id/vouchers', getIncomeVouchers);

export default router;