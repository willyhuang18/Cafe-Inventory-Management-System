import "dotenv/config";
import express from "express";
import { config } from "./config/index.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { connectDB, closeDB } from "./db/connection.js";
import { logger } from "./utils/logger.js";
import { requestLogger } from "./middleware/requestLogger.js";
import menuRoutes from "./routes/menu.js";
import inventoryRoutes from "./routes/inventory.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

/* Middleware */
app.use(requestLogger);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, "..", "public")));

/* API Routes */
app.use("/api/menu", menuRoutes);
app.use("/api/inventory", inventoryRoutes);

/* Start */
async function startServer() {
  try {
    await connectDB();
    app.listen(config.port, () => {
      logger.info(`Server is running on localhost:${config.port}`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

process.on("SIGINT", async () => {
  logger.info("Shutting down...");
  await closeDB();
  process.exit(0);
});

startServer();
