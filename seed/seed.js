import { MongoClient } from "mongodb";
import { readFile } from "fs/promises";
import config from "../src/config/index.js";
import "dotenv/config";

const client = new MongoClient(config.mongoUri);

async function seed() {
  await client.connect();
  const db = client.db(config.dbName);

  const menuData = JSON.parse(
    await readFile("./seed/menu-items.json", "utf-8"),
  );
  const inventoryData = JSON.parse(
    await readFile("./seed/inventory.json", "utf-8"),
  );

  await db.collection("menu_items").deleteMany({});

  await db.collection("menu_items").insertMany(menuData);

  console.log(`Seeded ${menuData.length} menu items.`);

  await db.collection("inventory").deleteMany({});
  await db.collection("inventory").insertMany(inventoryData);

  console.log(`Seeded ${inventoryData.length} inventory records.`);
  await client.close();
}

seed().catch(console.error);
