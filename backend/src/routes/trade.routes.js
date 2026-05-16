import express from "express";
import {
    openTrade,
    closePosition,
} from "../controllers/trade.controller.js";
import { getTradePreview } from "../controllers/preview.controller.js";

const router = express.Router();

router.post("/trade", openTrade);
router.post("/close-position", closePosition);
router.post("/trade/preview", getTradePreview);

export default router;