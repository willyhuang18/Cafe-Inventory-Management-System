const API = "/api/inventory";
const mainContainer = document.getElementById("inventory-main");
const ingredientsList = document.getElementById("ingredients-list");

let batches = [];
let ingredients = [];
let selectedIngredientId = null;
let filterFreshness = "All";
let searchText = "";
let ingredientSearch = "";
let ingredientStockFilter = "All";
let currentPage = 1;
const PAGE_SIZE = 10;

/* ── Thresholds ── */
const LOW_STOCK_THRESHOLD = 0.2; // < 20% of required_amount
const EXPIRING_SOON_DAYS = 5;

/* ══════════════════════════════════════════════════════
   UTILITIES
   ══════════════════════════════════════════════════════ */

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
  const bsToast = new window.bootstrap.Toast(el, { delay: 2500 });
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
  const modal = new window.bootstrap.Modal(el);
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

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysUntil(dateStr) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

/* ══════════════════════════════════════════════════════
   STATUS CALCULATIONS
   ══════════════════════════════════════════════════════ */

function getIngredientStockStatus(ingredientId) {
  const ingredient = ingredients.find(
    (i) => i._id === ingredientId || i._id.toString() === ingredientId,
  );
  if (!ingredient) return "unknown";

  const totalCurrent = batches
    .filter(
      (b) =>
        (b.ingredient_id === ingredientId ||
          b.ingredient_id?.toString() === ingredientId) &&
        b.current_amount > 0,
    )
    .reduce((sum, b) => sum + b.current_amount, 0);

  if (totalCurrent === 0) return "out-of-stock";
  if (totalCurrent < ingredient.required_amount * LOW_STOCK_THRESHOLD)
    return "low-stock";
  return "in-stock";
}

function getBatchFreshness(batch) {
  const days = daysUntil(batch.expiration_date);
  if (days < 0) return "expired";
  if (days <= EXPIRING_SOON_DAYS) return "expiring-soon";
  return "fresh";
}

function stockBadge(status) {
  const map = {
    "in-stock":
      '<span class="badge bg-success-subtle text-success">In Stock</span>',
    "low-stock":
      '<span class="badge bg-warning-subtle text-warning">Low Stock</span>',
    "out-of-stock":
      '<span class="badge bg-danger-subtle text-danger">Out of Stock</span>',
    unknown: '<span class="badge bg-secondary-subtle text-secondary">—</span>',
  };
  return map[status] || map.unknown;
}

function freshnessBadge(status) {
  const map = {
    fresh: '<span class="badge bg-success-subtle text-success">Fresh</span>',
    "expiring-soon":
      '<span class="badge bg-warning-subtle text-warning">Expiring Soon</span>',
    expired: '<span class="badge bg-danger-subtle text-danger">Expired</span>',
  };
  return map[status] || "";
}

/* ══════════════════════════════════════════════════════
   INGREDIENTS PANEL
   ══════════════════════════════════════════════════════ */

function showIngredientForm(editItem) {
  const isEdit = !!editItem;
  const { el, close } = createModal(
    isEdit ? "Edit Ingredient" : "Add Ingredient",
    `<div class="mb-3">
       <label for="ig-name" class="form-label">Ingredient Name</label>
       <input type="text" class="form-control" id="ig-name" placeholder="e.g. Whole Milk" value="${isEdit ? esc(editItem.name) : ""}" required />
     </div>
     <div class="row mb-3">
       <div class="col">
         <label for="ig-required" class="form-label">Required Amount</label>
         <input type="number" class="form-control" id="ig-required" step="0.01" min="0" placeholder="20" value="${isEdit ? editItem.required_amount : ""}" required />
       </div>
       <div class="col">
         <label for="ig-unit" class="form-label">Unit</label>
         <input type="text" class="form-control" id="ig-unit" placeholder="e.g. liters, kg, bags" value="${isEdit ? esc(editItem.unit) : ""}" required />
       </div>
     </div>
     <div class="d-flex justify-content-end gap-2">
       <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
       <button type="button" class="btn btn-primary" id="ig-submit">${isEdit ? "Save" : "Add"}</button>
     </div>`,
  );

  el.querySelector("#ig-submit").addEventListener("click", async () => {
    const name = el.querySelector("#ig-name").value.trim();
    const required_amount = el.querySelector("#ig-required").value;
    const unit = el.querySelector("#ig-unit").value.trim();
    if (!name || !required_amount || !unit) {
      return showToast("All fields are required.", "warning");
    }
    try {
      const body = JSON.stringify({
        name,
        required_amount: parseFloat(required_amount),
        unit,
      });
      if (isEdit) {
        await request(`${API}/ingredients/${editItem._id}`, {
          method: "PUT",
          body,
        });
        showToast("Ingredient updated.");
      } else {
        await request(`${API}/ingredients`, { method: "POST", body });
        showToast("Ingredient added.");
      }
      close();
      await loadData();
    } catch (err) {
      showToast(err.message, "danger");
    }
  });
}

function filteredIngredients() {
  return ingredients.filter((ig) => {
    if (
      ingredientSearch &&
      !ig.name.toLowerCase().includes(ingredientSearch.toLowerCase())
    )
      return false;
    if (ingredientStockFilter !== "All") {
      const status = getIngredientStockStatus(ig._id);
      if (status !== ingredientStockFilter) return false;
    }
    return true;
  });
}

function renderIngredients() {
  const list = filteredIngredients();

  if (ingredients.length === 0) {
    ingredientsList.innerHTML =
      '<p class="text-muted text-center small py-3">No ingredients yet. Add one to get started.</p>';
    return;
  }

  if (list.length === 0) {
    ingredientsList.innerHTML =
      '<p class="text-muted text-center small py-3">No ingredients match your search.</p>';
    return;
  }

  ingredientsList.innerHTML = `<div class="card"><div class="card-body p-0">
    ${list
      .map((ig) => {
        const status = getIngredientStockStatus(ig._id);
        return `
      <div class="ingredient-item${selectedIngredientId === ig._id ? " ingredient-selected" : ""}" data-select-ig="${ig._id}">
        <div class="ingredient-info">
          <span class="fw-semibold">${esc(ig.name)}</span>
          <small>Req: ${ig.required_amount} ${esc(ig.unit)} ${stockBadge(status)}</small>
        </div>
        <div class="ingredient-actions">
          <button class="btn btn-outline-secondary btn-sm" data-edit-ig="${ig._id}" title="Edit"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-outline-danger btn-sm" data-del-ig="${ig._id}" data-name="${esc(ig.name)}" title="Delete"><i class="bi bi-trash"></i></button>
        </div>
      </div>`;
      })
      .join("")}
  </div></div>`;

  ingredientsList.querySelectorAll("[data-select-ig]").forEach((row) => {
    row.addEventListener("click", (e) => {
      if (
        e.target.closest("[data-edit-ig]") ||
        e.target.closest("[data-del-ig]")
      )
        return;
      const id = row.dataset.selectIg;
      selectedIngredientId = selectedIngredientId === id ? null : id;
      currentPage = 1;
      renderIngredients();
      renderInventory();
    });
  });

  ingredientsList.querySelectorAll("[data-edit-ig]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ig = ingredients.find((i) => i._id === btn.dataset.editIg);
      if (ig) showIngredientForm(ig);
    });
  });

  ingredientsList.querySelectorAll("[data-del-ig]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const ok = await showConfirm(
        "Delete Ingredient?",
        `"${btn.dataset.name}" and all its inventory batches will be permanently deleted.`,
        true,
      );
      if (ok) {
        try {
          await request(`${API}/ingredients/${btn.dataset.delIg}`, {
            method: "DELETE",
          });
          showToast(`"${btn.dataset.name}" deleted.`);
          await loadData();
        } catch (err) {
          showToast(err.message, "danger");
        }
      }
    });
  });
}

/* ══════════════════════════════════════════════════════
   INVENTORY BATCH LIST
   ══════════════════════════════════════════════════════ */

function filteredBatches() {
  return batches.filter((b) => {
    const name = b.ingredient?.name || "";
    if (searchText && !name.toLowerCase().includes(searchText.toLowerCase()))
      return false;
    if (selectedIngredientId && b.ingredient_id !== selectedIngredientId)
      return false;
    if (filterFreshness !== "All") {
      const freshness = getBatchFreshness(b);
      if (freshness !== filterFreshness) return false;
    }
    return true;
  });
}

function showBatchForm(editBatch) {
  const isEdit = !!editBatch;
  const igOpts = ingredients
    .map(
      (ig) =>
        `<option value="${ig._id}" ${editBatch && editBatch.ingredient_id === ig._id ? "selected" : ""}>${esc(ig.name)} (${esc(ig.unit)})</option>`,
    )
    .join("");

  if (ingredients.length === 0) {
    return showToast("Add an ingredient first.", "warning");
  }

  const { el, close } = createModal(
    isEdit ? "Edit Inventory Batch" : "Add Inventory",
    `<div class="mb-3">
       <label for="b-ingredient" class="form-label">Ingredient</label>
       <select class="form-select" id="b-ingredient" ${isEdit ? "disabled" : ""}>${igOpts}</select>
     </div>
     <div class="row mb-3">
       <div class="col">
         <label for="b-amount" class="form-label">${isEdit ? "Current Amount" : "Amount"}</label>
         <input type="number" class="form-control" id="b-amount" step="0.01" min="0" placeholder="12"
           value="${isEdit ? editBatch.current_amount : ""}" required />
       </div>
       <div class="col">
         <label for="b-cost" class="form-label">Total Cost ($)</label>
         <input type="number" class="form-control" id="b-cost" step="0.01" min="0" placeholder="48.00"
           value="${isEdit ? editBatch.total_cost : ""}" required />
       </div>
     </div>
     <div class="mb-3">
       <label for="b-exp" class="form-label">Expiration Date</label>
       <input type="date" class="form-control" id="b-exp"
         value="${isEdit ? new Date(editBatch.expiration_date).toISOString().split("T")[0] : ""}" required />
     </div>
     ${
       isEdit
         ? `<div class="mb-3">
         <label for="b-initial" class="form-label">Initial Amount</label>
         <input type="number" class="form-control" id="b-initial" step="0.01" min="0"
           value="${editBatch.initial_amount}" required />
       </div>`
         : ""
     }
     <div class="d-flex justify-content-end gap-2">
       <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
       <button type="button" class="btn btn-primary" id="b-submit">${isEdit ? "Save" : "Add"}</button>
     </div>`,
  );

  el.querySelector("#b-submit").addEventListener("click", async () => {
    const amount = parseFloat(el.querySelector("#b-amount").value);
    const cost = parseFloat(el.querySelector("#b-cost").value);
    const exp = el.querySelector("#b-exp").value;

    if (!amount || !cost || !exp) {
      return showToast("All fields are required.", "warning");
    }

    try {
      if (isEdit) {
        const initial = parseFloat(el.querySelector("#b-initial").value);
        await request(`${API}/${editBatch._id}`, {
          method: "PUT",
          body: JSON.stringify({
            current_amount: amount,
            initial_amount: initial,
            total_cost: cost,
            expiration_date: exp,
          }),
        });
        showToast("Batch updated.");
      } else {
        const ingredient_id = el.querySelector("#b-ingredient").value;
        await request(API, {
          method: "POST",
          body: JSON.stringify({
            ingredient_id,
            initial_amount: amount,
            total_cost: cost,
            expiration_date: exp,
          }),
        });
        showToast("Inventory added.");
      }
      close();
      await loadData();
    } catch (err) {
      showToast(err.message, "danger");
    }
  });
}

function showUseForm(batch) {
  const ig = batch.ingredient;
  const { el, close } = createModal(
    "Use Ingredient",
    `<p>Deduct from: <strong>${esc(ig?.name || "")}</strong></p>
     <p class="text-muted small mb-2">Batch added ${formatDate(batch.date_created)} &middot; Expires ${formatDate(batch.expiration_date)}</p>
     <p class="mb-3">Current amount: <strong>${batch.current_amount} ${esc(ig?.unit || "")}</strong></p>
     <div class="mb-3">
       <label for="use-amt" class="form-label">Amount to use</label>
       <input type="number" class="form-control" id="use-amt" step="0.01" min="0.01" max="${batch.current_amount}" placeholder="e.g. 2" required />
     </div>
     <div class="d-flex justify-content-end gap-2">
       <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
       <button type="button" class="btn btn-primary" id="use-submit">Use</button>
     </div>`,
  );

  el.querySelector("#use-submit").addEventListener("click", async () => {
    const amount = parseFloat(el.querySelector("#use-amt").value);
    if (!amount || amount <= 0) {
      return showToast("Enter a valid amount.", "warning");
    }
    if (amount > batch.current_amount) {
      return showToast("Amount exceeds what is available.", "warning");
    }
    try {
      await request(`${API}/${batch._id}/use`, {
        method: "PATCH",
        body: JSON.stringify({ amount }),
      });
      showToast(
        `Used ${amount} ${ig?.unit || ""} of ${ig?.name || "ingredient"}.`,
      );
      close();
      await loadData();
    } catch (err) {
      showToast(err.message, "danger");
    }
  });
}

/* ── Pagination helper ── */

function renderPagination(totalItems) {
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);
  if (totalPages <= 1) return "";

  const maxVisible = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage = startPage + maxVisible - 1;
  if (endPage > totalPages) {
    endPage = totalPages;
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  let pages = "";
  if (startPage > 1) {
    pages += `<li class="page-item"><a class="page-link" data-page="1">1</a></li>`;
    if (startPage > 2)
      pages += `<li class="page-item disabled"><span class="page-link">&hellip;</span></li>`;
  }
  for (let i = startPage; i <= endPage; i++) {
    pages += `<li class="page-item ${i === currentPage ? "active" : ""}"><a class="page-link" data-page="${i}">${i}</a></li>`;
  }
  if (endPage < totalPages) {
    if (endPage < totalPages - 1)
      pages += `<li class="page-item disabled"><span class="page-link">&hellip;</span></li>`;
    pages += `<li class="page-item"><a class="page-link" data-page="${totalPages}">${totalPages}</a></li>`;
  }

  return `
    <nav aria-label="Inventory pagination" class="mt-3 d-flex justify-content-between align-items-center">
      <small class="text-muted">Showing ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, totalItems)} of ${totalItems}</small>
      <ul class="pagination pagination-sm mb-0">
        <li class="page-item ${currentPage === 1 ? "disabled" : ""}">
          <a class="page-link" data-page="${currentPage - 1}">&lsaquo; Prev</a>
        </li>
        ${pages}
        <li class="page-item ${currentPage === totalPages ? "disabled" : ""}">
          <a class="page-link" data-page="${currentPage + 1}">Next &rsaquo;</a>
        </li>
      </ul>
    </nav>`;
}

function bindPagination() {
  mainContainer.querySelectorAll("[data-page]").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const page = parseInt(link.dataset.page);
      const totalItems = filteredBatches().length;
      const totalPages = Math.ceil(totalItems / PAGE_SIZE);
      if (page >= 1 && page <= totalPages) {
        currentPage = page;
        renderInventory();
      }
    });
  });
}

function renderInventory() {
  const allFiltered = filteredBatches();
  const totalItems = allFiltered.length;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);

  // Clamp current page
  if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const list = allFiltered.slice(pageStart, pageStart + PAGE_SIZE);

  const rows = list.length
    ? list
        .map((b) => {
          const ig = b.ingredient || {};
          const fresh = getBatchFreshness(b);
          const pct =
            b.initial_amount > 0
              ? Math.round((b.current_amount / b.initial_amount) * 100)
              : 0;
          const progressColor =
            pct > 50 ? "bg-success" : pct > 20 ? "bg-warning" : "bg-danger";
          return `
          <tr>
            <td class="fw-semibold text-truncate" style="max-width:180px" title="${esc(ig.name || "")}">${esc(ig.name || "—")}</td>
            <td>
              <span class="batch-amount">${b.current_amount} / ${b.initial_amount}</span>
              <small class="text-muted ms-1">${esc(ig.unit || "")}</small>
              <div class="progress mt-1"><div class="progress-bar ${progressColor}" style="width:${pct}%"></div></div>
            </td>
            <td>${freshnessBadge(fresh)}</td>
            <td>${formatDate(b.expiration_date)}</td>
            <td class="fw-semibold">$${b.total_cost.toFixed(2)}</td>
            <td class="text-muted">${formatDate(b.date_created)}</td>
            <td>
              <button class="btn btn-sm btn-outline-primary me-1" data-use-batch="${b._id}" title="Use" ${b.current_amount <= 0 ? "disabled" : ""}>
                <i class="bi bi-dash-circle"></i>
              </button>
              <button class="btn btn-sm btn-outline-secondary me-1" data-edit-batch="${b._id}" title="Edit">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger" data-del-batch="${b._id}" title="Delete">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="7" class="text-center text-muted py-5"><i class="bi bi-box-seam fs-1 d-block mb-2 opacity-25"></i>No inventory records found.</td></tr>`;

  // Pad with empty rows to keep consistent table height
  const emptyRowsNeeded = list.length > 0 ? PAGE_SIZE - list.length : 0;
  const emptyRows = Array(emptyRowsNeeded)
    .fill('<tr><td colspan="7">&nbsp;</td></tr>')
    .join("");

  mainContainer.innerHTML = `
    <div class="mb-4">
      <h2 class="fw-bold mb-1">Inventory</h2>
      <p class="text-muted mb-0">Track stock batches, freshness, and usage</p>
    </div>

    <div class="d-flex flex-wrap gap-2 mb-3 align-items-center">
      <select class="form-select form-select-sm" id="inv-filter-fresh" style="max-width:160px">
        <option value="All" ${filterFreshness === "All" ? "selected" : ""}>All Freshness</option>
        <option value="fresh" ${filterFreshness === "fresh" ? "selected" : ""}>Fresh</option>
        <option value="expiring-soon" ${filterFreshness === "expiring-soon" ? "selected" : ""}>Expiring Soon</option>
        <option value="expired" ${filterFreshness === "expired" ? "selected" : ""}>Expired</option>
      </select>
      <button class="btn btn-sm btn-primary ms-auto" id="add-batch-btn"><i class="bi bi-plus-lg me-1"></i>Add Inventory</button>
    </div>

    <div class="card">
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0 inventory-table">
          <thead class="table-light">
            <tr>
              <th style="width:180px;max-width:180px">Ingredient</th>
              <th style="width:120px">Amount</th>
              <th style="width:120px">Freshness</th>
              <th style="width:120px">Expires</th>
              <th style="width:90px">Cost</th>
              <th style="width:120px">Added</th>
              <th style="width:130px">Actions</th>
            </tr>
          </thead>
          <tbody>${rows}${emptyRows}</tbody>
        </table>
      </div>
    </div>
    ${renderPagination(totalItems)}`;

  // Bind filters (reset to page 1 on filter change)
  mainContainer
    .querySelector("#inv-filter-fresh")
    .addEventListener("change", (e) => {
      filterFreshness = e.target.value;
      currentPage = 1;
      renderInventory();
    });

  // Bind add button
  mainContainer
    .querySelector("#add-batch-btn")
    .addEventListener("click", () => showBatchForm(null));

  // Bind row actions
  mainContainer.querySelectorAll("[data-use-batch]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const b = batches.find((x) => x._id === btn.dataset.useBatch);
      if (b) showUseForm(b);
    });
  });

  mainContainer.querySelectorAll("[data-edit-batch]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const b = batches.find((x) => x._id === btn.dataset.editBatch);
      if (b) showBatchForm(b);
    });
  });

  mainContainer.querySelectorAll("[data-del-batch]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const ok = await showConfirm(
        "Delete Batch?",
        "This inventory record will be permanently removed.",
        true,
      );
      if (ok) {
        try {
          await request(`${API}/${btn.dataset.delBatch}`, {
            method: "DELETE",
          });
          showToast("Batch deleted.");
          await loadData();
        } catch (err) {
          showToast(err.message, "danger");
        }
      }
    });
  });

  // Bind pagination
  bindPagination();
}

/* ══════════════════════════════════════════════════════
   DATA LOADING
   ══════════════════════════════════════════════════════ */

async function loadData() {
  try {
    [ingredients, batches] = await Promise.all([
      request(`${API}/ingredients`),
      request(API),
    ]);
  } catch (err) {
    ingredients = [];
    batches = [];
    showToast("Failed to load data.", "danger");
    console.log(err);
  }
  renderIngredients();
  renderInventory();
}

/* ══════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════ */

document
  .getElementById("add-ingredient-btn")
  .addEventListener("click", () => showIngredientForm(null));

document.getElementById("ingredient-search").addEventListener("input", (e) => {
  ingredientSearch = e.target.value;
  renderIngredients();
});

document
  .getElementById("ingredient-stock-filter")
  .addEventListener("change", (e) => {
    ingredientStockFilter = e.target.value;
    renderIngredients();
  });

loadData();
