export function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
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
        <i class="bi ${icon}"></i> ${escapeHtml(message)}
      </div>
      <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  `;
    container.appendChild(el);

    const bsToast = new bootstrap.Toast(el, { delay: 2500 });
    bsToast.show();
    el.addEventListener("hidden.bs.toast", () => el.remove());
}

function escapeHtml(t) {
    const d = document.createElement("div");
    d.textContent = t;
    return d.innerHTML;
}