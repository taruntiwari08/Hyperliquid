import express from "express";
import { getCandles } from "../controllers/chart.controller.js";

const router = express.Router();

router.get("/candles/:coin", getCandles);

export default router;