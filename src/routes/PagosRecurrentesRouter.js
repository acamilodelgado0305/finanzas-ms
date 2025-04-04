import express from "express";
import { createPago, getPagos, getPagoById, updatePago, deletePago } from "../controllers/PagosRecurrentesController.js";

const router = express.Router();

// Ruta para crear un nuevo pago pendiente (POST)
router.post("/pagospending", createPago);

// Ruta para obtener todos los pagos pendientes (GET)
router.get("/pagospending", getPagos);

// Ruta para obtener un pago pendiente por ID (GET)
router.get("/pagospending/:id", getPagoById);

// Ruta para actualizar un pago pendiente por ID (PUT)
router.put("/pagospending/:id", updatePago);

// Ruta para eliminar un pago pendiente por ID (DELETE)
router.delete("/pagospending/:id", deletePago);

export default router;
