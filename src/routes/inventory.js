import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../db/connection.js";
import { logger } from "../utils/logger.js";

const router = Router();
const INGREDIENTS_COL = "ingredientItems";
const INVENTORY_COL = "inventoryItems";

/* ── Helper: safe ObjectId parsing ── */

function toObjectId(id) {
  if (!ObjectId.isValid(id)) {
    return null;
  }
  return ObjectId.createFromHexString(id);
}

/* ══════════════════════════════════════════════════════
   INGREDIENT ROUTES
   ══════════════════════════════════════════════════════ */

// GET all ingredients
router.get("/ingredients", async (_req, res) => {
  try {
    const db = getDB();
    const ingredients = await db
      .collection(INGREDIENTS_COL)
      .find()
      .sort({ name: 1 })
      .toArray();
    logger.debug(`[MongoDB] Fetched ${ingredients.length} ingredients`);
    res.json(ingredients);
  } catch (error) {
    logger.error("[MongoDB] Failed to fetch ingredients", error.message);
    res.status(500).json({ error: "Failed to fetch ingredients." });
  }
});

// POST create ingredient
router.post("/ingredients", async (req, res) => {
  try {
    const { name, required_amount, unit } = req.body;
    if (!name || required_amount === undefined || !unit) {
      return res
        .status(400)
        .json({ error: "Name, required_amount, and unit are required." });
    }
    const db = getDB();

    // Check for duplicate name
    const existing = await db
      .collection(INGREDIENTS_COL)
      .findOne({ name: { $regex: new RegExp(`^${name}$`, "i") } });
    if (existing) {
      logger.warn(`[MongoDB] Duplicate ingredient name rejected: "${name}"`);
      return res
        .status(409)
        .json({ error: "An ingredient with this name already exists." });
    }

    const ingredient = {
      name: name.trim(),
      required_amount: parseFloat(required_amount),
      unit: unit.trim(),
      date_created: new Date(),
      date_modified: new Date(),
    };
    const result = await db.collection(INGREDIENTS_COL).insertOne(ingredient);
    logger.info(
      `[MongoDB] Ingredient created: "${name}" (${result.insertedId})`,
    );
    res.status(201).json({ ...ingredient, _id: result.insertedId });
  } catch (error) {
    logger.error("[MongoDB] Failed to create ingredient", error.message);
    res.status(500).json({ error: "Failed to create ingredient." });
  }
});

// PUT update ingredient
router.put("/ingredients/:id", async (req, res) => {
  try {
    const oid = toObjectId(req.params.id);
    if (!oid) {
      return res.status(400).json({ error: "Invalid ID." });
    }
    const db = getDB();
    const updates = { ...req.body, date_modified: new Date() };
    logger.debug("[MongoDB] Ingredient update payload", updates);
    if (updates.required_amount !== undefined) {
      updates.required_amount = parseFloat(updates.required_amount);
    }
    if (updates.name) {
      updates.name = updates.name.trim();
    }
    if (updates.unit) {
      updates.unit = updates.unit.trim();
    }

    const result = await db
      .collection(INGREDIENTS_COL)
      .findOneAndUpdate(
        { _id: oid },
        { $set: updates },
        { returnDocument: "after" },
      );
    if (!result) {
      return res.status(404).json({ error: "Ingredient not found." });
    }
    logger.info(
      `[MongoDB] Ingredient updated: ${req.params.id} -  ${result.name}`,
    );
    res.json(result);
  } catch (error) {
    logger.error(
      `[MongoDB] Failed to update ingredient ${req.params.id}`,
      error.message,
    );
    res.status(500).json({ error: "Failed to update ingredient." });
  }
});

// DELETE ingredient and all its inventory batches
router.delete("/ingredients/:id", async (req, res) => {
  try {
    const oid = toObjectId(req.params.id);
    if (!oid) {
      return res.status(400).json({ error: "Invalid ID." });
    }
    logger.debug("[MongoDB] Deleting ingredient id", req.body);
    const db = getDB();
    const result = await db.collection(INGREDIENTS_COL).deleteOne({ _id: oid });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Ingredient not found." });
    }
    // Also delete all inventory batches for this ingredient
    const batchResult = await db
      .collection(INVENTORY_COL)
      .deleteMany({ ingredient_id: oid });
    logger.info(
      `[MongoDB] Ingredient deleted: ${req.params.id} (${batchResult.deletedCount} batches removed)`,
    );
    res.json({ message: "Ingredient and its inventory records deleted." });
  } catch (error) {
    logger.error(
      `[MongoDB] Failed to delete ingredient ${req.params.id}`,
      error.message,
    );
    res.status(500).json({ error: "Failed to delete ingredient." });
  }
});

/* ══════════════════════════════════════════════════════
   INVENTORY (BATCH) ROUTES
   ══════════════════════════════════════════════════════ */

// GET all inventory batches with ingredient info joined
router.get("/", async (_req, res) => {
  try {
    const db = getDB();
    const pipeline = [
      {
        $lookup: {
          from: INGREDIENTS_COL,
          localField: "ingredient_id",
          foreignField: "_id",
          as: "ingredient",
        },
      },
      { $unwind: "$ingredient" },
      { $sort: { date_created: -1 } },
    ];
    const batches = await db
      .collection(INVENTORY_COL)
      .aggregate(pipeline)
      .toArray();
    logger.debug(`[MongoDB] Fetched ${batches.length} inventory batches`);
    res.json(batches);
  } catch (error) {
    logger.error("[MongoDB] Failed to fetch inventory", error.message);
    res.status(500).json({ error: "Failed to fetch inventory." });
  }
});

// POST add a new inventory batch
router.post("/", async (req, res) => {
  try {
    const { ingredient_id, initial_amount, expiration_date, total_cost } =
      req.body;
    if (
      !ingredient_id ||
      initial_amount === undefined ||
      !expiration_date ||
      total_cost === undefined
    ) {
      return res.status(400).json({
        error:
          "ingredient_id, initial_amount, expiration_date, and total_cost are required.",
      });
    }

    const oid = toObjectId(ingredient_id);
    if (!oid) {
      return res.status(400).json({ error: "Invalid ingredient_id." });
    }

    // Verify ingredient exists
    const db = getDB();
    const ingredient = await db
      .collection(INGREDIENTS_COL)
      .findOne({ _id: oid });
    if (!ingredient) {
      return res.status(404).json({ error: "Ingredient not found." });
    }

    const batch = {
      ingredient_id: oid,
      initial_amount: parseFloat(initial_amount),
      current_amount: parseFloat(initial_amount),
      expiration_date: new Date(expiration_date),
      total_cost: parseFloat(total_cost),
      date_created: new Date(),
      date_modified: new Date(),
      date_finished: null,
    };
    const result = await db.collection(INVENTORY_COL).insertOne(batch);
    logger.info(
      `[MongoDB] Inventory batch added for "${ingredient.name}" — ${initial_amount} ${ingredient.unit}, ${total_cost} (${result.insertedId})`,
    );
    res.status(201).json({ ...batch, _id: result.insertedId, ingredient });
  } catch (error) {
    logger.error("[MongoDB] Failed to add inventory batch", error.message);
    res.status(500).json({ error: "Failed to add inventory batch." });
  }
});

// PUT update an inventory batch
router.put("/:id", async (req, res) => {
  try {
    const oid = toObjectId(req.params.id);
    if (!oid) {
      return res.status(400).json({ error: "Invalid ID." });
    }

    const db = getDB();
    const updates = { date_modified: new Date() };
    if (req.body.initial_amount !== undefined) {
      updates.initial_amount = parseFloat(req.body.initial_amount);
    }
    if (req.body.current_amount !== undefined) {
      updates.current_amount = parseFloat(req.body.current_amount);
    }
    if (req.body.expiration_date !== undefined) {
      updates.expiration_date = new Date(req.body.expiration_date);
    }
    if (req.body.total_cost !== undefined) {
      updates.total_cost = parseFloat(req.body.total_cost);
    }
    logger.debug("[MongoDB] Inventory batch update payload", updates);

    const result = await db
      .collection(INVENTORY_COL)
      .findOneAndUpdate(
        { _id: oid },
        { $set: updates },
        { returnDocument: "after" },
      );
    if (!result) {
      return res.status(404).json({ error: "Inventory batch not found." });
    }
    logger.info(`[MongoDB] Inventory batch updated: ${req.params.id}`);
    res.json(result);
  } catch (error) {
    logger.error(
      `[MongoDB] Failed to update inventory batch ${req.params.id}`,
      error.message,
    );
    res.status(500).json({ error: "Failed to update inventory batch." });
  }
});

// PATCH decrease quantity (staff use)
router.patch("/:id/use", async (req, res) => {
  try {
    const oid = toObjectId(req.params.id);
    if (!oid) {
      return res.status(400).json({ error: "Invalid ID." });
    }

    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "A positive amount is required." });
    }

    const db = getDB();
    const batch = await db.collection(INVENTORY_COL).findOne({ _id: oid });
    if (!batch) {
      return res.status(404).json({ error: "Inventory batch not found." });
    }
    if (batch.current_amount <= 0) {
      return res.status(400).json({ error: "This batch is already depleted." });
    }

    const newAmount = Math.max(0, batch.current_amount - parseFloat(amount));
    const updateFields = {
      current_amount: newAmount,
      date_modified: new Date(),
    };
    if (newAmount === 0) {
      updateFields.date_finished = new Date();
    }
    logger.debug("[MongoDB] Inventory use payload", updateFields);

    const result = await db
      .collection(INVENTORY_COL)
      .findOneAndUpdate(
        { _id: oid },
        { $set: updateFields },
        { returnDocument: "after" },
      );
    logger.info(
      `[MongoDB] Inventory used: batch ${req.params.id} — ${amount} used, ${newAmount} remaining`,
    );
    res.json(result);
  } catch (error) {
    logger.error(
      `[MongoDB] Failed to update usage for batch ${req.params.id}`,
      error.message,
    );
    res.status(500).json({ error: "Failed to update usage." });
  }
});

// DELETE an inventory batch
router.delete("/:id", async (req, res) => {
  try {
    const oid = toObjectId(req.params.id);
    if (!oid) {
      return res.status(400).json({ error: "Invalid ID." });
    }

    const db = getDB();
    const result = await db.collection(INVENTORY_COL).deleteOne({ _id: oid });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Inventory batch not found." });
    }
    logger.info(`[MongoDB] Inventory batch deleted: ${req.params.id}`);
    res.json({ message: "Inventory batch deleted." });
  } catch (error) {
    logger.error(
      `[MongoDB] Failed to delete inventory batch ${req.params.id}`,
      error.message,
    );
    res.status(500).json({ error: "Failed to delete inventory batch." });
  }
});

export default router;
