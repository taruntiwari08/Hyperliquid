import express from "express";
import cors from "cors";

import agentRoutes from "./routes/agent.routes.js";
import tradeRoutes from "./routes/trade.routes.js";
import marketRoutes from "./routes/market.routes.js";
import accountRoutes from "./routes/account.routes.js";

const app = express();

const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://hyperliquid-puwj.vercel.app",
];

const corsOptions = {
    origin: (origin, callback) => {
        // Allow Postman, curl, server-to-server requests
        if (!origin) {
            return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
};

// ✅ CORS first
app.use(cors(corsOptions));

// ✅ Manual preflight handler — avoids app.options("*") crash
app.use((req, res, next) => {
    if (req.method === "OPTIONS") {
        res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
        res.header(
            "Access-Control-Allow-Methods",
            "GET,POST,PUT,PATCH,DELETE,OPTIONS"
        );
        res.header(
            "Access-Control-Allow-Headers",
            "Content-Type,Authorization"
        );
        res.header("Access-Control-Allow-Credentials", "true");

        return res.sendStatus(204);
    }

    next();
});

app.use(express.json());

app.use("/agent", agentRoutes);
app.use("/", tradeRoutes);
app.use("/", marketRoutes);
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