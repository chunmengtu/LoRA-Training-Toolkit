import {dom} from "./dom.js";
import {getText} from "./i18n.js";

export function showModal(title, body, actions = [], options = {}) {
    dom.modalTitle.textContent = title || getText("modal.title");
    if (options.html) {
        dom.modalBody.innerHTML = options.html;
    } else {
        dom.modalBody.textContent = body || "";
    }

    if (options.force) {
        dom.modal.classList.add("modal-force");
        dom.modalClose?.classList.add("hidden");
    } else {
        dom.modal.classList.remove("modal-force");
        dom.modalClose?.classList.remove("hidden");
    }

    dom.modalActions.innerHTML = "";
    if (Array.isArray(actions) && actions.length) {
        dom.modalActions.classList.remove("hidden");
        actions.forEach((actionConfig) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = `btn-modal${actionConfig?.variant === "primary" ? "" : " secondary"}`;
            btn.textContent = actionConfig?.label || getText("modal.title");
            btn.addEventListener("click", () => actionConfig?.handler?.());
            dom.modalActions.appendChild(btn);
        });
        dom.modalClose?.classList.add("hidden");
    } else {
        dom.modalActions.classList.add("hidden");
        if (!options.force) dom.modalClose?.classList.remove("hidden");
    }

    dom.modal.classList.remove("hidden");
}

export function hideModal() {
    dom.modal.classList.add("hidden");
    dom.modalActions.classList.add("hidden");
    dom.modalActions.innerHTML = "";
}
