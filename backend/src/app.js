import express from "express";
import cors from "cors";

import agentRoutes from "./routes/agent.routes.js";
import tradeRoutes from "./routes/trade.routes.js";
import marketRoutes from "./routes/market.routes.js";
import accountRoutes from "./routes/account.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/agent", agentRoutes);

// keep old endpoint style working:
// /trade
// /close-position
app.use("/", tradeRoutes);

// /prices
app.use("/", marketRoutes);

// /balance/:address
// /positions/:address
// /debug-state/:address
// /builder-stats/:address
app.use("/", accountRoutes);

app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        mode: process.env.HL_IS_TESTNET === "true" ? "testnet" : "mainnet",
        builder: process.env.BUILDER_ADDRESS,
        builderFeeTenthsBp: Number(process.env.BUILDER_FEE_TENTHS_BP || 100),
    });
});

export default app;