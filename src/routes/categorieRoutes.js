import express from "express";
import {
  createCategorieController,
  getCategoriesController,
  getCategorieByIdController,
  updateCategorieController,
  deleteCategorieController,
} from "../controllers/categoriesController.js";

const router = express.Router();

router.post("/categories", createCategorieController);
router.get("/categories", getCategoriesController);
router.get("/categories/:id", getCategorieByIdController);
router.put("/categories/:id", updateCategorieController);
router.delete("/categories/:id", deleteCategorieController);

export default router;
