/* Jellyfin VR Play Button Injector
 * 用于 jellyfin-plugin-custom-javascript:
 * 在媒体详情页注入“VR 播放”按钮，打开插件页面 /VR/Video/{itemId}/Play
 */
(function () {
    "use strict";

    const BUTTON_ID = "jf-vr-play-button";

    function getItemIdFromHash() {
        const hash = window.location.hash || "";
        const m = hash.match(/[?&]id=([0-9a-fA-F-]+)/);
        return m ? m[1] : null;
    }

    function isDetailsPage() {
        const hash = (window.location.hash || "").toLowerCase();
        return hash.includes("/details") || hash.includes("details?id=");
    }

    function getCurrentAccessToken() {
        if (window.ApiClient && typeof window.ApiClient.accessToken === "function") {
            return window.ApiClient.accessToken() || "";
        }

        return "";
    }

    function getServerAddress() {
        if (window.ApiClient && typeof window.ApiClient.serverAddress === "function") {
            const addr = window.ApiClient.serverAddress();
            if (addr) return addr.replace(/\/+$/, "");
        }

        return window.location.origin;
    }

    function openVrPage(itemId) {
        const base = getServerAddress();
        const url = new URL(`${base}/VR/Video/${encodeURIComponent(itemId)}/Play`);
        const token = getCurrentAccessToken();
        if (token) {
            // 新标签页是普通导航请求，附加 api_key 以通过 Jellyfin 自定义认证。
            url.searchParams.set("api_key", token);
        }

        window.open(url.toString(), "_blank", "noopener,noreferrer");
    }

    function createButton(itemId) {
        const btn = document.createElement("button");
        btn.id = BUTTON_ID;
        btn.type = "button";
        btn.className = "button-flat";
        btn.style.marginLeft = "8px";
        btn.style.padding = "6px";
        btn.style.background = "transparent";
        btn.style.border = "none";
        btn.style.minWidth = "32px";
        btn.style.minHeight = "32px";
        btn.style.display = "inline-flex";
        btn.style.alignItems = "center";
        btn.style.justifyContent = "center";
        btn.style.cursor = "pointer";
        btn.style.opacity = "0.95";
        btn.innerHTML = `
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false"
                 fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2.5" y="6.5" width="19" height="11" rx="4.5"></rect>
                <circle cx="8.5" cy="12" r="2.1"></circle>
                <circle cx="15.5" cy="12" r="2.1"></circle>
                <path d="M11 12h2"></path>
            </svg>
        `;
        btn.setAttribute("aria-label", "VR 播放");
        btn.title = "使用 Jellyfin VR 插件播放";
        btn.addEventListener("click", function () {
            openVrPage(itemId);
        });
        return btn;
    }

    function findActionContainer() {
        const selectors = [
            ".itemDetailButtons",
            ".detailPagePrimaryContainer .buttons",
            ".detailPagePrimaryContainer .buttonContainer",
            ".mainDetailButtons",
            ".itemViewActions",
            ".detailPageContent .buttons"
        ];

        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) return el;
        }

        return null;
    }

    function injectButton() {
        const old = document.getElementById(BUTTON_ID);
        if (old) old.remove();

        if (!isDetailsPage()) return;

        const itemId = getItemIdFromHash();
        if (!itemId) return;

        const container = findActionContainer();
        if (!container) return;

        container.appendChild(createButton(itemId));
    }

    function scheduleInject() {
        // Jellyfin 是 SPA，页面切换和节点渲染是异步的
        injectButton();
        setTimeout(injectButton, 300);
        setTimeout(injectButton, 800);
        setTimeout(injectButton, 1500);
    }

    window.addEventListener("hashchange", scheduleInject);
    window.addEventListener("load", scheduleInject);

    const observer = new MutationObserver(() => {
        if (isDetailsPage() && !document.getElementById(BUTTON_ID)) {
            injectButton();
        }
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });
})();

