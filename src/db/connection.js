import { MongoClient } from "mongodb";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

let client = null;
let db = null;

async function connectDB() {
  if (db) {
    return db;
  }

  if (!config.mongoUri) {
    throw new Error(
      "MONGODB_URI is not defined. Please set it in your .env file.",
    );
  }

  client = new MongoClient(config.mongoUri);
  await client.connect();
  db = client.db(config.dbName);
  logger.info(`[MongoDB] Connected — database: ${db.databaseName}`);
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
    logger.info("[MongoDB] Connection closed.");
  }
}

export { connectDB, getDB, closeDB };
