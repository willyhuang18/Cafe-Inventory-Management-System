import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

const COLLECTION = "menuItems";

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

async function archiveItem(id) {
    return await updateItem(id, { is_active: false, in_stock: false });
}

async function restoreItem(id) {
    return await updateItem(id, { is_active: true, in_stock: true });
}

async function deleteItem(id) {
    const db = getDB();
    const result = await db
        .collection(COLLECTION)
        .deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
}

export {
    getActiveItems,
    getArchivedItems,
    getItemById,
    createItem,
    updateItem,
    archiveItem,
    restoreItem,
    deleteItem,
};