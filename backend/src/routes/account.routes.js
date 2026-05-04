import express from "express";

import {
    getBalance,
    getDebugState,
    getPositions,
    getBuilderStats,
    getOpenOrders,
} from "../controllers/account.controller.js";

const router = express.Router();

router.get("/balance/:address", getBalance);
router.get("/debug-state/:address", getDebugState);
router.get("/positions/:address", getPositions);
router.get("/builder-stats/:address", getBuilderStats);
router.get("/open-orders/:address", getOpenOrders);

export default router;