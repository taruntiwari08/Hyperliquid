import express from "express";
import { getPrices, getMarketContexts } from "../controllers/market.controller.js";

const router = express.Router();

router.get("/prices", getPrices);
router.get("/market-contexts", getMarketContexts);

export default router;