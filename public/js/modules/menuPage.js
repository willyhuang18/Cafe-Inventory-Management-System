import {
    fetchActiveMenu,
    createMenuItem,
    updateMenuItem,
    archiveMenuItem,
} from "./api.js";
import { showToast } from "./toast.js";
import { createModal, showConfirm } from "./modal.js";

const CATEGORIES = ["Coffee", "Tea", "Pastry", "Smoothie", "Seasonal", "Other"];
let items = [];
let search = "";
let catFilter = "All";

function esc(t) {
    const d = document.createElement("div");
    d.textContent = t;
    return d.innerHTML;
}

function filtered() {
    return items
        .filter(
            (i) =>
                (!search || i.name.toLowerCase().includes(search.toLowerCase())) &&
                (catFilter === "All" || i.category === catFilter),
        )
        .sort((a, b) => a.name.localeCompare(b.name));
}

function stockBadge(inStock) {
    return inStock
        ? `<span class="badge bg-success-subtle text-success clickable">In Stock</span>`
        : `<span class="badge bg-danger-subtle text-danger clickable">Out of Stock</span>`;
}

function showForm(editItem, container) {
    const isEdit = !!editItem;
    const catOpts = CATEGORIES.map(
        (c) =>
            `<option value="${c}" ${editItem?.category === c ? "selected" : ""}>${c}</option>`,
    ).join("");

    const { el, close } = createModal(
        isEdit ? "Edit Menu Item" : "Add Menu Item",
        `
      <div class="mb-3">
        <label for="m-name" class="form-label">Item Name</label>
        <input type="text" class="form-control" id="m-name" placeholder="e.g. Cappuccino" value="${isEdit ? esc(editItem.name) : ""}" required />
      </div>
      <div class="row mb-3">
        <div class="col">
          <label for="m-price" class="form-label">Price ($)</label>
          <input type="number" class="form-control" id="m-price" step="0.01" min="0" placeholder="4.50" value="${isEdit ? editItem.price : ""}" required />
        </div>
        <div class="col">
          <label for="m-cat" class="form-label">Category</label>
          <select class="form-select" id="m-cat">${catOpts}</select>
        </div>
      </div>
      <div class="mb-3">
        <label for="m-inst" class="form-label">Instructions</label>
        <textarea class="form-control" id="m-inst" rows="3" placeholder="How to prepare...">${isEdit ? esc(editItem.instructions || "") : ""}</textarea>
      </div>
      <div class="d-flex justify-content-end gap-2">
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
        <button type="button" class="btn btn-primary" id="m-submit">${isEdit ? "Save Changes" : "Add Item"}</button>
      </div>
    `,
    );

    el.querySelector("#m-submit").addEventListener("click", async () => {
        const name = el.querySelector("#m-name").value.trim();
        const price = el.querySelector("#m-price").value;
        const category = el.querySelector("#m-cat").value;
        const instructions = el.querySelector("#m-inst").value.trim();
        if (!name || !price) {
            return showToast("Please fill in name and price.", "warning");
        }
        try {
            if (isEdit) {
                await updateMenuItem(editItem._id, {
                    name,
                    price: parseFloat(price),
                    category,
                    instructions,
                });
                showToast("Menu item updated.");
            } else {
                await createMenuItem({
                    name,
                    price: parseFloat(price),
                    category,
                    instructions,
                });
                showToast("New item added to menu.");
            }
            close();
            await load(container);
        } catch (err) {
            showToast(err.message, "danger");
        }
    });
}

function bindTable(container) {
    container.querySelectorAll("[data-toggle-stock]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.toggleStock;
            const item = items.find((i) => i._id === id);
            if (!item) {
                return;
            }
            try {
                await updateMenuItem(id, { in_stock: !item.in_stock });
                showToast(
                    `"${item.name}" marked as ${item.in_stock ? "out of stock" : "in stock"}.`,
                );
                await load(container);
            } catch (err) {
                showToast(err.message, "danger");
            }
        });
    });

    container.querySelectorAll("[data-edit-menu]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const item = items.find((i) => i._id === btn.dataset.editMenu);
            if (item) {
                showForm(item, container);
            }
        });
    });

    container.querySelectorAll("[data-archive-menu]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.archiveMenu;
            const name = btn.dataset.name;
            const ok = await showConfirm(
                "Archive Item?",
                `"${name}" will be removed from the live menu and moved to the archive.`,
            );
            if (ok) {
                try {
                    await archiveMenuItem(id);
                    showToast(`"${name}" moved to archive.`);
                    await load(container);
                } catch (err) {
                    showToast(err.message, "danger");
                }
            }
        });
    });
}

function render(container) {
    const list = filtered();
    const total = items.length;
    const inStock = items.filter((i) => i.in_stock).length;
    const oos = items.filter((i) => !i.in_stock).length;
    const cats = new Set(items.map((i) => i.category)).size;

    const catOpts = CATEGORIES.map(
        (c) =>
            `<option value="${c}" ${catFilter === c ? "selected" : ""}>${c}</option>`,
    ).join("");

    const rows = list.length
        ? list
            .map(
                (i) => `
        <tr>
          <td class="fw-semibold">${esc(i.name)}</td>
          <td><span class="badge bg-secondary-subtle text-secondary">${esc(i.category)}</span></td>
          <td class="fw-semibold">$${i.price.toFixed(2)}</td>
          <td><span data-toggle-stock="${i._id}" style="cursor:pointer">${stockBadge(i.in_stock)}</span></td>
          <td class="text-muted text-truncate" style="max-width:200px" title="${esc(i.instructions || "")}">${esc(i.instructions || "\u2014")}</td>
          <td>
            <button class="btn btn-sm btn-outline-secondary me-1" type="button" data-edit-menu="${i._id}" title="Edit"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-outline-secondary" type="button" data-archive-menu="${i._id}" data-name="${esc(i.name)}" title="Archive"><i class="bi bi-archive"></i></button>
          </td>
        </tr>`,
            )
            .join("")
        : `<tr><td colspan="6" class="text-center text-muted py-5">No items found.</td></tr>`;

    container.innerHTML = `
    <div class="d-flex flex-wrap justify-content-between align-items-start mb-4 gap-3">
      <div>
        <h2 class="fw-bold mb-1">Live Menu</h2>
        <p class="text-muted mb-0">Currently available items for customers</p>
      </div>
      <div class="d-flex flex-wrap gap-2 align-items-center">
        <div class="input-group input-group-sm" style="max-width:220px">
          <span class="input-group-text"><i class="bi bi-search"></i></span>
          <input type="text" class="form-control" id="menu-search" placeholder="Search menu..." value="${esc(search)}" />
        </div>
        <select class="form-select form-select-sm" id="menu-cat-filter" style="max-width:150px">
          <option value="All" ${catFilter === "All" ? "selected" : ""}>All</option>
          ${catOpts}
        </select>
        <button class="btn btn-sm btn-primary" type="button" id="add-menu-btn"><i class="bi bi-plus-lg me-1"></i>Add Item</button>
      </div>
    </div>

    <div class="row g-3 mb-4">
      <div class="col-6 col-md-3"><div class="card"><div class="card-body d-flex align-items-center gap-3"><div class="rounded-3 bg-primary-subtle text-primary d-flex align-items-center justify-content-center" style="width:44px;height:44px"><i class="bi bi-cup-straw fs-5"></i></div><div><div class="stat-number text-primary">${total}</div><small class="text-muted">Active Items</small></div></div></div></div>
      <div class="col-6 col-md-3"><div class="card"><div class="card-body d-flex align-items-center gap-3"><div class="rounded-3 bg-success-subtle text-success d-flex align-items-center justify-content-center" style="width:44px;height:44px"><i class="bi bi-check-lg fs-5"></i></div><div><div class="stat-number text-success">${inStock}</div><small class="text-muted">In Stock</small></div></div></div></div>
      <div class="col-6 col-md-3"><div class="card"><div class="card-body d-flex align-items-center gap-3"><div class="rounded-3 bg-danger-subtle text-danger d-flex align-items-center justify-content-center" style="width:44px;height:44px"><i class="bi bi-exclamation-triangle fs-5"></i></div><div><div class="stat-number text-danger">${oos}</div><small class="text-muted">Out of Stock</small></div></div></div></div>
      <div class="col-6 col-md-3"><div class="card"><div class="card-body d-flex align-items-center gap-3"><div class="rounded-3 bg-warning-subtle text-warning d-flex align-items-center justify-content-center" style="width:44px;height:44px"><i class="bi bi-grid fs-5"></i></div><div><div class="stat-number text-warning">${cats}</div><small class="text-muted">Categories</small></div></div></div></div>
    </div>

    <div class="card">
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead class="table-light"><tr><th>Item</th><th>Category</th><th>Price</th><th>Status</th><th>Instructions</th><th style="width:120px">Actions</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;

    container.querySelector("#menu-search").addEventListener("input", (e) => {
        search = e.target.value;
        render(container);
        const el = container.querySelector("#menu-search");
        el.focus();
        el.setSelectionRange(search.length, search.length);
    });
    container
        .querySelector("#menu-cat-filter")
        .addEventListener("change", (e) => {
            catFilter = e.target.value;
            render(container);
        });
    container
        .querySelector("#add-menu-btn")
        .addEventListener("click", () => showForm(null, container));
    bindTable(container);
}

async function load(container) {
    try {
        items = await fetchActiveMenu();
    } catch (err) {
        items = [];
        showToast("Failed to load menu.", "danger");
    }
    render(container);
}

export async function renderMenuPage(container) {
    container.innerHTML =
        '<div class="text-center text-muted py-5"><div class="spinner-border spinner-border-sm me-2"></div>Loading menu...</div>';
    await load(container);
}