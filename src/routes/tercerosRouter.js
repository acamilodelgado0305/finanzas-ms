import express from "express";
import upload from "../../config/multerConfig.js";
import {
  getAllTerceros,

  getTerceroById,

} from "../controllers/tercerosController.js";

const router = express.Router();

// Rutas existentes
router.get("/terceros", getAllTerceros);
router.get("/incomes/:id", getTerceroById);


export default router;
