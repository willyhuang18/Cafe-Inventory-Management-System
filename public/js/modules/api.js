const API = "/api";

async function request(url, options = {}) {
    const res = await fetch(`${API}${url}`, {
        headers: { "Content-Type": "application/json" },
        ...options,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Request failed: ${res.status}`);
    }
    return res.json();
}

/* Menu */
export const fetchActiveMenu = () => request("/menu");
export const fetchArchivedMenu = () => request("/menu/archive");
export const createMenuItem = (d) =>
    request("/menu", { method: "POST", body: JSON.stringify(d) });
export const updateMenuItem = (id, d) =>
    request(`/menu/${id}`, { method: "PUT", body: JSON.stringify(d) });
export const archiveMenuItem = (id) =>
    request(`/menu/${id}/archive`, { method: "PUT" });
export const restoreMenuItem = (id) =>
    request(`/menu/${id}/restore`, { method: "PUT" });
export const deleteMenuItem = (id) =>
    request(`/menu/${id}`, { method: "DELETE" });