import { fetchArchivedMenu, restoreMenuItem, deleteMenuItem } from "./api.js";
import { showToast } from "./toast.js";
import { showConfirm } from "./modal.js";

let items = [];

function esc(t) {
    const d = document.createElement("div");
    d.textContent = t;
    return d.innerHTML;
}

function bind(container) {
    container.querySelectorAll("[data-restore]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.restore;
            const name = btn.dataset.name;
            try {
                await restoreMenuItem(id);
                showToast(`"${name}" restored to live menu.`);
                await load(container);
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
                    await deleteMenuItem(id);
                    showToast(`"${name}" permanently deleted.`);
                    await load(container);
                } catch (err) {
                    showToast(err.message, "danger");
                }
            }
        });
    });
}

function render(container) {
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
            <button class="btn btn-sm btn-outline-success me-1" type="button" data-restore="${i._id}" data-name="${esc(i.name)}" title="Restore"><i class="bi bi-arrow-counterclockwise me-1"></i>Restore</button>
            <button class="btn btn-sm btn-outline-danger" type="button" data-hard-delete="${i._id}" data-name="${esc(i.name)}" title="Delete permanently"><i class="bi bi-trash"></i></button>
          </td>
        </tr>`,
            )
            .join("")
        : `<tr><td colspan="5" class="text-center text-muted py-5"><i class="bi bi-archive fs-1 d-block mb-2 opacity-25"></i>Archive is empty</td></tr>`;

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
    </div>
  `;
    bind(container);
}

async function load(container) {
    try {
        items = await fetchArchivedMenu();
    } catch (err) {
        items = [];
        showToast("Failed to load archive.", "danger");
    }
    render(container);
}

export async function renderArchivePage(container) {
    container.innerHTML =
        '<div class="text-center text-muted py-5"><div class="spinner-border spinner-border-sm me-2"></div>Loading archive...</div>';
    await load(container);
}