# Brew.Base — Design Document

## Project Description

Brew.Base is a web-based inventory management platform for small and medium-sized cafes. It digitizes two workflows: menu management (with soft-delete archiving) and inventory tracking (with cost/restock analytics). Built with Node.js, Express, MongoDB, Bootstrap 5, and vanilla JavaScript client-side rendering.

## Design Mockups

### Home Page
![Home Page Mockup](images/mockup-index.png)

### Live Menu
![Live Menu Mockup](images/mockup-menu.png)

### Menu Archive
![Menu Archive Mockup](images/mockup-menu-archive.png)

### Inventory
![Inventory Mockup](images/mockup-inventory.png)

## Database Schema

### `menuItems` Collection

Stores menu items with soft-delete via `is_active` flag.

```json
{
  "_id": "ObjectId",
  "name": "Cappuccino",
  "price": 4.50,
  "category": "Coffee",
  "instructions": "How to prepare...",
  "is_active": true,
  "in_stock": true,
  "created_at": "ISODate",
  "updated_at": "ISODate"
}
```

- `is_active: false` = archived (soft-deleted)
- Categories: Coffee, Tea, Pastry, Smoothie, Seasonal, Other

### `ingredientItems` Collection

```json
{
  "_id": "ObjectId",
  "name": "Whole Milk",
  "required_amount": 20,
  "unit": "liters",
  "date_created": "ISODate",
  "date_modified": "ISODate"
}
```

- `required_amount` — the baseline amount needed; used to compute stock status
- Duplicate names are rejected (case-insensitive)

### `inventoryItems` Collection

Stores individual inventory batches — each restock event creates a new document.

```json
{
  "_id": "ObjectId",
  "ingredient_id": "ObjectId (references ingredientItems._id)",
  "initial_amount": 12,
  "current_amount": 6,
  "expiration_date": "ISODate",
  "total_cost": 48.00,
  "date_created": "ISODate",
  "date_modified": "ISODate",
  "date_finished": null
}
```

- `ingredient_id` — foreign key to `ingredientItems`
- `current_amount` — decreases as staff use the ingredient
- `date_finished` — set automatically when `current_amount` reaches 0
- Deleting an ingredient cascades to delete all its batches
- User needs to first create an ingredient item in order to log the inventory item of that ingredient. 


## Status Calculation Logic

### Stock Status (per ingredient)

Computed client-side by summing `current_amount` across all batches for an ingredient, compared against `required_amount`:

| Status | Condition |
|--------|-----------|
| Out of Stock | total `current_amount` = 0 |
| Low Stock | total `current_amount` < 20% of `required_amount` |
| In Stock | total `current_amount` ≥ 20% of `required_amount` |

### Freshness Status (per batch)

Computed client-side from `expiration_date` relative to today:

| Status | Condition |
|--------|-----------|
| Expired | expiration date is in the past |
| Expiring Soon | expiration date is within 5 days |
| Fresh | expiration date is more than 5 days away |

## Architecture Decisions

- **Singleton DB connection** — `connectDB()` runs once at startup, `getDB()` returns the shared connection. Closed only on `SIGINT`. Avoids per-request connection overhead.
- **Two collections for inventory** — Normalized design (`ingredientItems` + `inventoryItems`) rather than embedded batches. Enables clean `$lookup` joins, straightforward per-batch CRUD, and easy analytics aggregation.
- **Client-side status computation** — Stock status and freshness are calculated in the browser from fetched data rather than stored in the database. Avoids stale computed fields and keeps writes simple.
- **Client-side filtering and pagination** — All batches are fetched once, then filtered/paginated in JavaScript. Acceptable for the expected data volume of an SMB cafe (hundreds to low thousands of records).
- **No authentication** — Designed for single-cafe use on a trusted network. Auth can be added later as middleware.
