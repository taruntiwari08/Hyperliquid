import "dotenv/config";

import app from "./app.js";
import { connectDB } from "./db/db.js";
import { initSymbolConverter } from "./utils/hyperliquid.js";

async function startServer() {
    try {
        await connectDB();

        console.log("⏳ Initializing Hyperliquid...");

        await initSymbolConverter();

        const PORT = process.env.PORT || 3000;

        app.listen(PORT, () => {
            console.log(`🚀 Backend running on port ${PORT}`);
        });
    } catch (err) {
        console.error("❌ SERVER INIT ERROR:", err);
        process.exit(1);
    }
}

startServer();