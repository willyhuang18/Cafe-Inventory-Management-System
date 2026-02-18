const API = "/api/menu";
const container = document.getElementById("main-content");
const isArchivePage = window.location.pathname.includes("archive");

const CATEGORIES = ["Coffee", "Tea", "Pastry", "Smoothie", "Seasonal", "Other"];
let items = [];
let search = "";
let catFilter = "All";

/* ── Utility ── */

function esc(t) {
    const d = document.createElement("div");
    d.textContent = t;
    return d.innerHTML;
}

async function request(url, options = {}) {
    const res = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...options,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Request failed: ${res.status}`);
    }
    return res.json();
}

function showToast(message, type = "success") {
    const tc = document.getElementById("toast-container");
    const iconMap = {
        success: "bi-check-circle-fill text-success",
        danger: "bi-exclamation-triangle-fill text-danger",
        warning: "bi-exclamation-circle-fill text-warning",
    };
    const icon = iconMap[type] || iconMap.success;
    const el = document.createElement("div");
    el.className = "toast align-items-center border-0 show";
    el.setAttribute("role", "alert");
    el.innerHTML = `
    <div class="d-flex">
      <div class="toast-body d-flex align-items-center gap-2">
        <i class="bi ${icon}"></i> ${esc(message)}
      </div>
      <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>`;
    tc.appendChild(el);
    const bsToast = new bootstrap.Toast(el, { delay: 2500 });
    bsToast.show();
    el.addEventListener("hidden.bs.toast", () => el.remove());
}

function createModal(title, bodyHtml) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
    <div class="modal fade" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${esc(title)}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">${bodyHtml}</div>
        </div>
      </div>
    </div>`;
    const el = wrapper.firstElementChild;
    document.body.appendChild(el);
    const modal = new bootstrap.Modal(el);
    modal.show();
    el.addEventListener("hidden.bs.modal", () => {
        modal.dispose();
        el.remove();
    });
    return { el, modal, close: () => modal.hide() };
}

function showConfirm(title, message, danger = false) {
    return new Promise((resolve) => {
        const btnClass = danger ? "btn-danger" : "btn-primary";
        const btnLabel = danger ? "Delete" : "Confirm";
        const { el, close } = createModal(
            title,
            `<p>${esc(message)}</p>
       <div class="d-flex justify-content-end gap-2 mt-3">
         <button type="button" class="btn btn-secondary" data-action="cancel">Cancel</button>
         <button type="button" class="btn ${btnClass}" data-action="ok">${btnLabel}</button>
       </div>`,
        );
        el.querySelector('[data-action="cancel"]').addEventListener("click", () => {
            close();
            resolve(false);
        });
        el.querySelector('[data-action="ok"]').addEventListener("click", () => {
            close();
            resolve(true);
        });
        el.addEventListener("hidden.bs.modal", () => resolve(false), {
            once: true,
        });
    });
}

/* ══════════════════════════════════════════════════════
   LIVE MENU PAGE
   ══════════════════════════════════════════════════════ */

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
        ? '<span class="badge bg-success-subtle text-success clickable">In Stock</span>'
        : '<span class="badge bg-danger-subtle text-danger clickable">Out of Stock</span>';
}

function showMenuForm(editItem) {
    const isEdit = !!editItem;
    const catOpts = CATEGORIES.map(
        (c) =>
            `<option value="${c}" ${editItem?.category === c ? "selected" : ""}>${c}</option>`,
    ).join("");

    const { el, close } = createModal(
        isEdit ? "Edit Menu Item" : "Add Menu Item",
        `<div class="mb-3">
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
     </div>`,
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
            const body = JSON.stringify({
                name,
                price: parseFloat(price),
                category,
                instructions,
            });
            if (isEdit) {
                await request(`${API}/${editItem._id}`, { method: "PUT", body });
                showToast("Menu item updated.");
            } else {
                await request(API, { method: "POST", body });
                showToast("New item added to menu.");
            }
            close();
            await loadMenuPage();
        } catch (err) {
            showToast(err.message, "danger");
        }
    });
}

function bindMenuTable() {
    container.querySelectorAll("[data-toggle-stock]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.toggleStock;
            const item = items.find((i) => i._id === id);
            if (!item) {
                return;
            }
            try {
                await request(`${API}/${id}`, {
                    method: "PUT",
                    body: JSON.stringify({ in_stock: !item.in_stock }),
                });
                showToast(
                    `"${item.name}" marked as ${item.in_stock ? "out of stock" : "in stock"}.`,
                );
                await loadMenuPage();
            } catch (err) {
                showToast(err.message, "danger");
            }
        });
    });

    container.querySelectorAll("[data-edit-menu]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const item = items.find((i) => i._id === btn.dataset.editMenu);
            if (item) {
                showMenuForm(item);
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
                    await request(`${API}/${id}/archive`, { method: "PUT" });
                    showToast(`"${name}" moved to archive.`);
                    await loadMenuPage();
                } catch (err) {
                    showToast(err.message, "danger");
                }
            }
        });
    });
}

function renderMenuPage() {
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
        : '<tr><td colspan="6" class="text-center text-muted py-5">No items found.</td></tr>';

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
    </div>`;

    container.querySelector("#menu-search").addEventListener("input", (e) => {
        search = e.target.value;
        renderMenuPage();
        const searchEl = container.querySelector("#menu-search");
        searchEl.focus();
        searchEl.setSelectionRange(search.length, search.length);
    });
    container
        .querySelector("#menu-cat-filter")
        .addEventListener("change", (e) => {
            catFilter = e.target.value;
            renderMenuPage();
        });
    container
        .querySelector("#add-menu-btn")
        .addEventListener("click", () => showMenuForm(null));
    bindMenuTable();
}

async function loadMenuPage() {
    try {
        items = await request(API);
    } catch (err) {
        items = [];
        showToast("Failed to load menu.", "danger");
    }
    renderMenuPage();
}

/* ══════════════════════════════════════════════════════
   ARCHIVE PAGE
   ══════════════════════════════════════════════════════ */

function bindArchiveTable() {
    container.querySelectorAll("[data-restore]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.restore;
            const name = btn.dataset.name;
            try {
                await request(`${API}/${id}/restore`, { method: "PUT" });
                showToast(`"${name}" restored to live menu.`);
                await loadArchivePage();
            } catch (err) {
                showToast(err.message, "danger");
            }
        });
    });

    container.querySelectorAll("[data-hard-delete]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.hardDelete;
            const name = btn.dataset.name;
            const ok = await showConfirm(
                "Permanently Delete?",
                `"${name}" will be permanently removed. This cannot be undone.`,
                true,
            );
            if (ok) {
                try {
                    await request(`${API}/${id}`, { method: "DELETE" });
                    showToast(`"${name}" permanently deleted.`);
                    await loadArchivePage();
                } catch (err) {
                    showToast(err.message, "danger");
                }
            }
        });
    });
}

function renderArchivePage() {
    const rows = items.length
        ? items
            .map(
                (i) => `
        <tr>
          <td class="fw-semibold">${esc(i.name)}</td>
          <td><span class="badge bg-secondary-subtle text-secondary">${esc(i.category)}</span></td>
          <td class="fw-semibold">$${i.price.toFixed(2)}</td>
          <td class="text-muted text-truncate" style="max-width:200px">${esc(i.instructions || "\u2014")}</td>
          <td>
            <button class="btn btn-sm btn-outline-success me-1" type="button" data-restore="${i._id}" data-name="${esc(i.name)}"><i class="bi bi-arrow-counterclockwise me-1"></i>Restore</button>
            <button class="btn btn-sm btn-outline-danger" type="button" data-hard-delete="${i._id}" data-name="${esc(i.name)}"><i class="bi bi-trash"></i></button>
          </td>
        </tr>`,
            )
            .join("")
        : '<tr><td colspan="5" class="text-center text-muted py-5"><i class="bi bi-archive fs-1 d-block mb-2 opacity-25"></i>Archive is empty</td></tr>';

    container.innerHTML = `
    <div class="mb-4">
      <h2 class="fw-bold mb-1">Menu Archive</h2>
      <p class="text-muted mb-0">Inactive items &mdash; restore or permanently delete</p>
    </div>
    <div class="card">
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead class="table-light"><tr><th>Item</th><th>Category</th><th>Price</th><th>Instructions</th><th style="width:180px">Actions</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
    bindArchiveTable();
}

async function loadArchivePage() {
    try {
        items = await request(`${API}/archive`);
    } catch (err) {
        items = [];
        showToast("Failed to load archive.", "danger");
    }
    renderArchivePage();
}

/* ══════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════ */

if (isArchivePage) {
    loadArchivePage();
} else {
    loadMenuPage();
}