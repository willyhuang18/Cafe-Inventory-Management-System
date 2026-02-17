function escapeHtml(t) {
    const d = document.createElement("div");
    d.textContent = t;
    return d.innerHTML;
}

export function createModal(title, bodyHtml, size = "") {
    const sizeClass = size ? `modal-${size}` : "";
    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
    <div class="modal fade" tabindex="-1">
      <div class="modal-dialog ${sizeClass} modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${escapeHtml(title)}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">${bodyHtml}</div>
        </div>
      </div>
    </div>
  `;
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

export function showConfirm(title, message, danger = false) {
    return new Promise((resolve) => {
        const btnClass = danger ? "btn-danger" : "btn-primary";
        const btnLabel = danger ? "Delete" : "Confirm";
        const { el, close } = createModal(
            title,
            `
        <p>${escapeHtml(message)}</p>
        <div class="d-flex justify-content-end gap-2 mt-3">
          <button type="button" class="btn btn-secondary" data-action="cancel">Cancel</button>
          <button type="button" class="btn ${btnClass}" data-action="ok">${btnLabel}</button>
        </div>
      `,
        );

        el.querySelector('[data-action="cancel"]').addEventListener(
            "click",
            () => {
                close();
                resolve(false);
            },
        );
        el.querySelector('[data-action="ok"]').addEventListener("click", () => {
            close();
            resolve(true);
        });
        el.addEventListener("hidden.bs.modal", () => resolve(false), {
            once: true,
        });
    });
}