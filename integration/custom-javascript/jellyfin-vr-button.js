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

    function openVrPage(itemId) {
        const url = `${window.location.origin}/VR/Video/${itemId}/Play`;
        window.open(url, "_blank", "noopener,noreferrer");
    }

    function createButton(itemId) {
        const btn = document.createElement("button");
        btn.id = BUTTON_ID;
        btn.type = "button";
        btn.className = "button-flat raised";
        btn.style.marginLeft = "8px";
        btn.style.padding = "8px 12px";
        btn.textContent = "VR 播放";
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

