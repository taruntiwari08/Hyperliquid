import express from "express";
import {
    createAgent,
    getAgent,
    markAgentApproved,
} from "../controllers/agent.controller.js";

const router = express.Router();

router.post("/create", createAgent);
router.get("/:userAddress", getAgent);
router.post("/approved", markAgentApproved);

export default router;