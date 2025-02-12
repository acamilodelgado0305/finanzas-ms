import express from "express";
import {
  getGeneralBalance,
  getMonthlyBalance
} from "../controllers/balanceController.js";

const router = express.Router();

router.get("/balance/general", getGeneralBalance);


router.get('/balance/month/:monthYear', getMonthlyBalance);


export default router;