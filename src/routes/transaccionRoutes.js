import express from "express";
import {
  createTransactionController,
  getTransactionsController,
  getTransactionByIdController,
  updateTransactionController,
  deleteTransactionController,
  getTotalExpensesByDateController,
  getTotalIncomeByDateController,
  getDailyBalanceByDateController,
  getTotalExpensesByMonthController,
  getTotalIncomeByMonthController,
  getMonthlyBalanceByMonthController,
  getTransactionsControllerEstadoFalse,
} from "../controllers/transaccionController.js";

const router = express.Router();

// POST
router.post("/transactions", createTransactionController);

// GET
router.get("/transactions", getTransactionsController);
router.get("/transactions/pending", getTransactionsControllerEstadoFalse);
router.get("/transactions/:id", getTransactionByIdController);
router.get("/transactions/expenses/:date", getTotalExpensesByDateController);
router.get("/transactions/income/:date", getTotalIncomeByDateController);
router.get("/transactions/balance/:date", getDailyBalanceByDateController);


// Rutas para cálculos mensuales
router.get("/transactions/expenses/month/:month", getTotalExpensesByMonthController);
router.get("/transactions/income/month/:month", getTotalIncomeByMonthController);
router.get("/transactions/balance/month/:month", getMonthlyBalanceByMonthController);

// PUT
router.put("/transactions/:id", updateTransactionController);

// DELETE
router.delete("/transactions/:id", deleteTransactionController);

export default router;
