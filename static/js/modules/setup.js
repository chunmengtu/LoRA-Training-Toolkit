import {postJSON} from "../core/api.js";
import {dom} from "../core/dom.js";
import {getText, registerTranslationHook} from "../core/i18n.js";
import {showModal} from "../core/modal.js";
import {state} from "../core/state.js";
import {showToast} from "../core/toast.js";

export function updateSwitchState(button, currentState) {
    if (!button) return;
    const label = button.querySelector(".switch-label");
    if (currentState === "on") {
        button.classList.add("active");
        button.dataset.state = "on";
        if (label) label.textContent = getText("environment.acceleratorOn");
    } else {
        button.classList.remove("active");
        button.dataset.state = "off";
        if (label) label.textContent = getText("environment.acceleratorOff");
    }
}

async function handleAcceleratorAction(action) {
    try {
        const response = await postJSON("/api/network/accelerator", {action});
        state.features.autodlAccelerator = action === "enable" ? "on" : "off";
        updateSwitchState(dom.autodlSwitch, state.features.autodlAccelerator);
        showToast(response.message || getText("environment.acceleratorSuccess"));
    } catch (error) {
        showModal(getText("modal.title"), error.message || getText("environment.acceleratorFail"));
        updateSwitchState(dom.autodlSwitch, state.features.autodlAccelerator);
    }
}

export function initSetupModule() {
    dom.setupBtn?.addEventListener("click", async () => {
        dom.setupBtn.disabled = true;
        try {
            const response = await postJSON("/api/run-setup", {
                github_accelerator: state.features.githubAccelerator === "on",
            });
            showModal(getText("modal.title"), response.message);
        } catch (error) {
            showModal(getText("modal.title"), error.message);
        } finally {
            dom.setupBtn.disabled = false;
        }
    });

    dom.startBtn?.addEventListener("click", async () => {
        dom.startBtn.disabled = true;
        try {
            const response = await postJSON("/api/run-start");
            showToast(response.message);
        } catch (error) {
            showModal(getText("modal.title"), error.message);
        } finally {
            dom.startBtn.disabled = false;
        }
    });

    dom.autodlSwitch?.addEventListener("click", () => {
        if (state.features.autodlAccelerator === "off" && state.features.githubAccelerator === "on") {
            showModal(getText("modal.title"), getText("environment.acceleratorConflict"));
            return;
        }
        handleAcceleratorAction(state.features.autodlAccelerator === "on" ? "disable" : "enable");
    });

    dom.githubSwitch?.addEventListener("click", () => {
        const newState = state.features.githubAccelerator === "on" ? "off" : "on";
        if (newState === "on" && state.features.autodlAccelerator === "on") {
            handleAcceleratorAction("disable");
            state.features.githubAccelerator = "on";
            updateSwitchState(dom.githubSwitch, "on");
            showModal(getText("modal.title"), getText("environment.githubAutoDisabledAutodl"));
            return;
        }
        state.features.githubAccelerator = newState;
        updateSwitchState(dom.githubSwitch, newState);
    });

    registerTranslationHook(() => {
        updateSwitchState(dom.autodlSwitch, state.features.autodlAccelerator);
        updateSwitchState(dom.githubSwitch, state.features.githubAccelerator);
    });
}
