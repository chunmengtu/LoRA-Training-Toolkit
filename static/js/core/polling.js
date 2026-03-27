import {fetchJSON} from "./api.js";
import {pollingIntervalMs, state} from "./state.js";

export async function fetchStatus(onStatus) {
    const data = await fetchJSON(`/api/status?_=${Date.now()}`);
    onStatus?.(data);
    return data;
}

export function startPolling(onStatus) {
    fetchStatus(onStatus).catch((error) => console.error("status fetch failed", error));
    if (state.pollingHandle) clearInterval(state.pollingHandle);
    state.pollingHandle = setInterval(() => {
        fetchStatus(onStatus).catch((error) => console.error("status fetch failed", error));
    }, pollingIntervalMs);
}
