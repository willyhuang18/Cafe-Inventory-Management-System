import "dotenv/config";
import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { connectDB, closeDB } from "./config/db.js";
import menuRoutes from "./routes/menu.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

/* Middleware */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, "public")));

/* API Routes */
app.use("/api/menu", menuRoutes);

/* SPA fallback */
app.get("*", (_req, res) => {
    res.sendFile(join(__dirname, "public", "index.html"));
});

/* Start */
async function startServer() {
    try {
        await connectDB();
        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
}

process.on("SIGINT", async () => {
    await closeDB();
    process.exit(0);
});

startServer();