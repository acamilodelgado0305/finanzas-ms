import express from "express";
import upload from "../../config/multerConfig.js";
import {
  getAllIncomes,
  createIncome,
  getIncomeById,
  updateIncome,
  deleteIncome,
  manageVouchers,
  getIncomeVouchers,
  bulkUploadIncomes
} from "../controllers/IncomeController.js";

const router = express.Router();

// Rutas existentes
router.get("/incomes", getAllIncomes);
router.post("/incomes", createIncome);
router.get("/incomes/:id", getIncomeById);
router.put("/incomes/:id", updateIncome);
router.delete("/incomes/:id", deleteIncome);
router.patch("/incomes/:id/vouchers", manageVouchers);
router.get("/incomes/:id/vouchers", getIncomeVouchers);

// ✅ Nueva ruta para carga masiva
router.post("/incomes/bulk-upload", upload.single("file"), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Archivo no recibido. Asegúrate de que el campo se llame "file".' });
  }
  next();
}, bulkUploadIncomes);

export default router;
