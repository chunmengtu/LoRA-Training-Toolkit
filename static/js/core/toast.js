import {dom} from "./dom.js";

export function showToast(message, duration = 2800) {
    if (!dom.toast || !message) return;
    dom.toast.textContent = message;
    dom.toast.classList.remove("hidden");
    setTimeout(() => dom.toast.classList.add("hidden"), duration);
}
