import { Router } from "express";
import { getDB } from "../db/connection.js";

const router = Router();

// GET    /api/inventory               — all inventory records
// GET    /api/inventory/analytics     — aggregated cost/restock data
// POST   /api/inventory               — log a restock
// PUT    /api/inventory/:id           — adjust record
// PATCH  /api/inventory/:id/use       — decrease quantity (staff use)
// DELETE /api/inventory/:id           — remove a record

export default router;
