import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../db/connection.js";

const router = Router();
const COLLECTION = "menuItems";

/* ── Helper functions ── */

async function getActiveItems() {
    const db = getDB();
    return await db
        .collection(COLLECTION)
        .find({ is_active: true })
        .sort({ name: 1 })
        .toArray();
}

async function getArchivedItems() {
    const db = getDB();
    return await db
        .collection(COLLECTION)
        .find({ is_active: false })
        .sort({ name: 1 })
        .toArray();
}

async function getItemById(id) {
    const db = getDB();
    return await db
        .collection(COLLECTION)
        .findOne({ _id: new ObjectId(id) });
}

async function createItem(data) {
    const db = getDB();
    const item = {
        name: data.name,
        price: parseFloat(data.price),
        category: data.category,
        instructions: data.instructions || "",
        is_active: true,
        in_stock: true,
        created_at: new Date(),
        updated_at: new Date(),
    };
    const result = await db.collection(COLLECTION).insertOne(item);
    return { ...item, _id: result.insertedId };
}

async function updateItem(id, updates) {
    const db = getDB();
    const setData = { ...updates, updated_at: new Date() };
    if (setData.price !== undefined) {
        setData.price = parseFloat(setData.price);
    }
    return await db
        .collection(COLLECTION)
        .findOneAndUpdate(
            { _id: new ObjectId(id) },
            { $set: setData },
            { returnDocument: "after" },
        );
}

/* ── Routes ── */

// GET all active menu items
router.get("/", async (_req, res) => {
    try {
        res.json(await getActiveItems());
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch menu items." });
    }
});

// GET all archived menu items
router.get("/archive", async (_req, res) => {
    try {
        res.json(await getArchivedItems());
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch archived items." });
    }
});

// GET single menu item by ID
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

// POST create new menu item
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

// PUT update menu item
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

// PUT archive (soft delete) menu item
router.put("/:id/archive", async (req, res) => {
    try {
        const item = await updateItem(req.params.id, {
            is_active: false,
            in_stock: false,
        });
        if (!item) {
            return res.status(404).json({ error: "Item not found." });
        }
        res.json(item);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to archive item." });
    }
});

// PUT restore archived menu item
router.put("/:id/restore", async (req, res) => {
    try {
        const item = await updateItem(req.params.id, {
            is_active: true,
            in_stock: true,
        });
        if (!item) {
            return res.status(404).json({ error: "Item not found." });
        }
        res.json(item);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to restore item." });
    }
});

// DELETE permanently delete menu item
router.delete("/:id", async (req, res) => {
    try {
        const db = getDB();
        const result = await db
            .collection(COLLECTION)
            .deleteOne({ _id: new ObjectId(req.params.id) });
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: "Item not found." });
        }
        res.json({ message: "Item permanently deleted." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to delete item." });
    }
});

export default router;