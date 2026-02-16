import { MongoClient } from "mongodb";

let client = null;
let db = null;

async function connectDB() {
    if (db) {
        return db;
    }

    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error(
            "MONGODB_URI is not defined. Please set it in your .env file.",
        );
    }

    client = new MongoClient(uri);
    await client.connect();
    db = client.db("cafe_inventory");
    console.log("Connected to MongoDB successfully.");
    return db;
}

function getDB() {
    if (!db) {
        throw new Error("Database not initialized. Call connectDB() first.");
    }
    return db;
}

async function closeDB() {
    if (client) {
        await client.close();
        client = null;
        db = null;
        console.log("MongoDB connection closed.");
    }
}

export { connectDB, getDB, closeDB };