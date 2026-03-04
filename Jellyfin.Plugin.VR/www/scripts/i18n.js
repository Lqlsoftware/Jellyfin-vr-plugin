class I18n {
    constructor() {
        this.currentLanguage = "zh-CN";
        this.translations = {};
        this.fallbackLanguage = "en-US";
        this.supportedLanguages = ["zh-CN", "en-US"];
        this.assetBase = this.resolveAssetBase();
        this.init();
    }

    resolveAssetBase() {
        const dataBase = document.body?.dataset?.assetBase;
        if (dataBase) return dataBase.replace(/\/+$/, "");

        const script = document.currentScript;
        if (script instanceof HTMLScriptElement && script.src) {
            try {
                const url = new URL(script.src, window.location.href);
                return url.href.replace(/\/scripts\/i18n\.js(?:\?.*)?$/i, "");
            } catch (_) {
                // Fallback handled below.
            }
        }

        return "/VR/Assets";
    }

    async init() {
        const savedLanguage = localStorage.getItem("vrplayer-language");
        if (savedLanguage && this.supportedLanguages.includes(savedLanguage)) {
            this.currentLanguage = savedLanguage;
        }

        await this.loadTranslations();
        this.applyTranslations();
    }

    async loadTranslations() {
        for (const lang of this.supportedLanguages) {
            try {
                const response = await fetch(`${this.assetBase}/locales/${lang}.json`, { cache: "no-store" });
                if (response.ok) {
                    this.translations[lang] = await response.json();
                }
            } catch (error) {
                console.warn("Failed to load locale:", lang, error);
            }
        }
    }

    t(key, params = {}) {
        const resolveValue = (lang) => {
            const keys = key.split(".");
            let value = this.translations[lang];
            for (const k of keys) {
                if (value && typeof value === "object" && k in value) {
                    value = value[k];
                } else {
                    return null;
                }
            }
            return typeof value === "string" ? value : null;
        };

        const text = resolveValue(this.currentLanguage) ?? resolveValue(this.fallbackLanguage) ?? key;
        return text.replace(/\{\{(\w+)\}\}/g, (_, name) => (params[name] ?? `{{${name}}}`));
    }

    async switchLanguage(language) {
        if (!this.supportedLanguages.includes(language)) return;
        this.currentLanguage = language;
        localStorage.setItem("vrplayer-language", language);
        this.applyTranslations();
        document.documentElement.lang = language;
        window.dispatchEvent(new CustomEvent("languageChanged", { detail: { language } }));
    }

    applyTranslations() {
        const textEls = document.querySelectorAll("[data-i18n]");
        textEls.forEach((element) => {
            const key = element.getAttribute("data-i18n");
            if (key) element.textContent = this.t(key);
        });

        const titleEls = document.querySelectorAll("[data-i18n-title]");
        titleEls.forEach((element) => {
            const key = element.getAttribute("data-i18n-title");
            if (key) element.setAttribute("title", this.t(key));
        });
    }
}

window.i18n = new I18n();
