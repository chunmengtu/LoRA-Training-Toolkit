import {state} from "./state.js";

export function applyTheme(theme) {
    state.currentTheme = theme === "light" ? "light" : "dark";
    document.body.classList.remove("theme-light", "theme-dark");
    document.body.classList.add(`theme-${state.currentTheme}`);
    localStorage.setItem("aitoolkit-theme", state.currentTheme);
}

export function toggleTheme() {
    applyTheme(state.currentTheme === "dark" ? "light" : "dark");
}
