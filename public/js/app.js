import { renderMenuPage } from "./modules/menuPage.js";
import { renderArchivePage } from "./modules/archivePage.js";

const main = document.getElementById("main-content");
const navBtns = document.querySelectorAll("#main-nav .nav-link");
let current = "menu";

async function navigateTo(page) {
    current = page;
    navBtns.forEach((b) => {
        b.classList.toggle("active", b.dataset.page === page);
    });

    switch (page) {
        case "menu":
            await renderMenuPage(main);
            break;
        case "archive":
            await renderArchivePage(main);
            break;
        default:
            await renderMenuPage(main);
    }
}

navBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
        if (btn.dataset.page !== current) {
            navigateTo(btn.dataset.page);
        }
    });
});

navigateTo("menu");