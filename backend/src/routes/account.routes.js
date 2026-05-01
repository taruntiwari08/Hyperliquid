import express from "express";

import {
    getBalance,
    getDebugState,
    getPositions,
    getBuilderStats,
} from "../controllers/account.controller.js";

const router = express.Router();

router.get("/balance/:address", getBalance);
router.get("/debug-state/:address", getDebugState);
router.get("/positions/:address", getPositions);
router.get("/builder-stats/:address", getBuilderStats);

export default router;