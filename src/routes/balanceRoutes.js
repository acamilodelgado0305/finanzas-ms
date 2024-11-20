import express from "express";
import {
  getGeneralBalance,
} from "../controllers/balanceController.js";

const router = express.Router();

router.get("/balance/general", getGeneralBalance);


export default router;