import { Router } from "express";
import {
    getActiveItems,
    getArchivedItems,
    getItemById,
    createItem,
    updateItem,
    archiveItem,
    restoreItem,
    deleteItem,
} from "../models/MenuItem.js";

const router = Router();

router.get("/", async (_req, res) => {
    try {
        res.json(await getActiveItems());
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch menu items." });
    }
});

router.get("/archive", async (_req, res) => {
    try {
        res.json(await getArchivedItems());
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch archived items." });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const item = await getItemById(req.params.id);
        if (!item) {
            return res.status(404).json({ error: "Item not found." });
        }
        res.json(item);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch item." });
    }
});

router.post("/", async (req, res) => {
    try {
        const { name, price, category, instructions } = req.body;
        if (!name || price === undefined || !category) {
            return res
                .status(400)
                .json({ error: "Name, price, and category are required." });
        }
        const item = await createItem({ name, price, category, instructions });
        res.status(201).json(item);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to create item." });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const item = await updateItem(req.params.id, req.body);
        if (!item) {
            return res.status(404).json({ error: "Item not found." });
        }
        res.json(item);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to update item." });
    }
});

router.put("/:id/archive", async (req, res) => {
    try {
        const item = await archiveItem(req.params.id);
        if (!item) {
            return res.status(404).json({ error: "Item not found." });
        }
        res.json(item);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to archive item." });
    }
});

router.put("/:id/restore", async (req, res) => {
    try {
        const item = await restoreItem(req.params.id);
        if (!item) {
            return res.status(404).json({ error: "Item not found." });
        }
        res.json(item);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to restore item." });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const success = await deleteItem(req.params.id);
        if (!success) {
            return res.status(404).json({ error: "Item not found." });
        }
        res.json({ message: "Item permanently deleted." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to delete item." });
    }
});

export default router;