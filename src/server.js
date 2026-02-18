import "dotenv/config";
import expresss from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { connectDB, closeDB } from "./db/connection.js";
import menuRoutes from "./routes/menu.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Middleware
app.use(express.json());
app.use(express.static("public"));

/* Middleware */
app.use(expresss.json());
app.use(expresss.urlencoded({ extended: true }));
app.use(expresss.static(join(__dirname, "..", "public")));

/* API Routes */
app.use("/api/menu", menuRoutes);

/* Start */
async function startServer() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server is running on localhost:${PORT}`);
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
