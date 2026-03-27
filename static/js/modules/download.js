import {postJSON} from "../core/api.js";
import {dom} from "../core/dom.js";
import {getText} from "../core/i18n.js";
import {showModal} from "../core/modal.js";

export function initDownloadModule() {
    dom.downloadForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        dom.downloadBtn.disabled = true;
        try {
            const formData = new FormData(dom.downloadForm);
            const response = await postJSON("/api/download", {
                model: formData.get("model"),
                source: formData.get("source"),
            });
            showModal(getText("modal.title"), response.message);
        } catch (error) {
            showModal(getText("modal.title"), error.message);
        } finally {
            dom.downloadBtn.disabled = false;
        }
    });
}
