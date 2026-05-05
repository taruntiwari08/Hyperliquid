import express from "express";
import {
    getTradeHistory,
    getTransferHistory,
    getMarkets,
} from "../controllers/history.controller.js";

const router = express.Router();

// Trade fill history — ?startTime=ms&endTime=ms
router.get("/history/trades/:address", getTradeHistory);

// Deposit / withdrawal history — ?startTime=ms&endTime=ms
router.get("/history/transfers/:address", getTransferHistory);

// All tradable markets (for coin search)
router.get("/markets", getMarkets);

export default router;
