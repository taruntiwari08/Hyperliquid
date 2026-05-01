import express from "express";
import {
    openTrade,
    closePosition,
} from "../controllers/trade.controller.js";

const router = express.Router();

router.post("/trade", openTrade);
router.post("/close-position", closePosition);

export default router;