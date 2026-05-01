import express from "express";
import { getPrices } from "../controllers/market.controller.js";

const router = express.Router();

router.get("/prices", getPrices);

export default router;