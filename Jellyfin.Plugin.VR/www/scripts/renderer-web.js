(function () {
    "use strict";

    const SETTINGS_KEY = "vrPlayerSettingsWeb";

    class VRPlayerWeb {
        constructor() {
            this.video = document.getElementById("video-element");
            this.playPauseBtn = document.getElementById("play-pause-btn");
            this.stopBtn = document.getElementById("stop-btn");
            this.progressBar = document.getElementById("progress-bar");
            this.currentTimeEl = document.getElementById("current-time");
            this.totalTimeEl = document.getElementById("total-time");
            this.volumeBtn = document.getElementById("volume-btn");
            this.vrBtn = document.getElementById("vr-btn");
            this.exitVrBtn = document.getElementById("exit-vr-btn");
            this.fullscreenBtn = document.getElementById("fullscreen-btn");
            this.settingsBtn = document.getElementById("settings-btn");
            this.playlistBtn = document.getElementById("playlist-btn");

            this.fileList = document.getElementById("file-list");
            this.fileListContent = document.getElementById("file-list-content");
            this.clearListBtn = document.getElementById("clear-list-btn");
            this.settingsPanel = document.getElementById("settings-panel");
            this.closeSettingsBtn = document.getElementById("close-settings-btn");

            this.videoContainer = document.getElementById("video-container");
            this.vrScene = document.getElementById("vr-scene");
            this.videosphere = document.querySelector("a-videosphere");
            this.vrCamera = document.getElementById("vr-camera");
            this.vrModeText = document.getElementById("vr-mode-text");

            this.themeSelect = document.getElementById("theme-select");
            this.languageSelect = document.getElementById("language-select");
            this.loopInput = document.getElementById("loop");
            this.mouseSensitivityInput = document.getElementById("mouse-sensitivity");
            this.sensitivityValue = document.getElementById("sensitivity-value");
            this.zoomInput = document.getElementById("vr-zoom-sensitivity");
            this.zoomValue = document.getElementById("vr-zoom-value");
            this.vrFovSelect = document.getElementById("vr-fov-select");
            this.vrFormatSelect = document.getElementById("vr-format-select");

            const body = document.body;
            this.currentVideo = body.dataset.streamUrl || this.video?.getAttribute("src") || "";
            this.currentTitle = document.title.replace(/^VR Player\s*-\s*/i, "").trim() || "VR Video";
            this.vrFov = "180";
            this.vrFormat = "mono";

            this.isVRMode = false;
            this.isPlaying = false;
            this.isMuted = false;
            this.lastMouseX = 0;
            this.lastMouseY = 0;
            this.firstMouseMove = true;
            this.mouseDown = false;

            this.videoList = [{
                name: this.currentTitle,
                src: this.currentVideo
            }];

            this.settings = {
                loop: false,
                theme: "system",
                language: "zh-CN",
                mouseTracking: true,
                vrViewSensitivity: 40,
                vrZoomLevel: 100
            };
            this.currentVRScale = 1;
        }

        init() {
            if (!this.video) return;
            this.loadSettings();
            this.bindEvents();
            this.applySettings();
            this.updatePlayButton();
            this.updateVRModeSelection();
            this.updateVRModeStatus();
            this.renderPlaylist();
            this.initLanguage();
            this.initVideo();
            this.setupSceneEvents();
            this.setupMouseControls();
        }

        initLanguage() {
            if (window.i18n) {
                window.i18n.switchLanguage(this.settings.language);
            }
        }

        initVideo() {
            this.video.src = this.currentVideo;
            this.video.loop = this.settings.loop;

            this.video.addEventListener("loadedmetadata", () => {
                this.updateProgress();
                this.updateVRVideoSource();
            });
            this.video.addEventListener("timeupdate", () => this.updateProgress());
            this.video.addEventListener("play", () => {
                this.isPlaying = true;
                this.updatePlayButton();
            });
            this.video.addEventListener("pause", () => {
                this.isPlaying = false;
                this.updatePlayButton();
            });
            this.video.addEventListener("ended", () => {
                this.isPlaying = false;
                this.updatePlayButton();
            });
            this.video.addEventListener("error", () => {
                this.showNotification(window.i18n ? window.i18n.t("messages.video_error") : "Video error");
            });
        }

        setupSceneEvents() {
            const scene = document.querySelector("a-scene");
            if (scene) {
                scene.addEventListener("loaded", () => {
                    this.updateVRModeGeometry();
                });
            }

            if (this.videosphere) {
                this.videosphere.addEventListener("materialtextureloaded", () => this.applyVRFormat());
            }
        }

        bindEvents() {
            this.playPauseBtn?.addEventListener("click", () => this.togglePlayPause());
            this.stopBtn?.addEventListener("click", () => this.stop());
            this.volumeBtn?.addEventListener("click", () => this.toggleMute());
            this.vrBtn?.addEventListener("click", () => this.enterVRMode());
            this.exitVrBtn?.addEventListener("click", () => this.exitVRMode());
            this.fullscreenBtn?.addEventListener("click", () => this.toggleFullscreen());
            this.settingsBtn?.addEventListener("click", () => this.toggleSettings());
            this.closeSettingsBtn?.addEventListener("click", () => this.hideSettings());
            this.playlistBtn?.addEventListener("click", () => this.togglePlaylist());
            this.clearListBtn?.addEventListener("click", () => this.clearPlaylist());

            this.progressBar?.addEventListener("input", (e) => this.seekPercent(e.target.value));

            this.themeSelect?.addEventListener("change", (e) => {
                this.settings.theme = e.target.value;
                this.applyTheme(this.settings.theme);
                this.saveSettings();
            });
            this.languageSelect?.addEventListener("change", (e) => {
                this.settings.language = e.target.value;
                if (window.i18n) window.i18n.switchLanguage(this.settings.language);
                this.saveSettings();
            });
            this.loopInput?.addEventListener("change", (e) => {
                this.settings.loop = e.target.checked;
                this.video.loop = this.settings.loop;
                this.saveSettings();
            });
            this.mouseSensitivityInput?.addEventListener("input", (e) => {
                this.settings.vrViewSensitivity = parseInt(e.target.value, 10) || 40;
                this.sensitivityValue.textContent = String(this.settings.vrViewSensitivity);
                this.saveSettings();
            });
            this.zoomInput?.addEventListener("input", (e) => {
                this.settings.vrZoomLevel = parseInt(e.target.value, 10) || 100;
                this.currentVRScale = this.settings.vrZoomLevel / 100;
                this.updateVRScale(this.currentVRScale);
                this.zoomValue.textContent = `${this.currentVRScale.toFixed(1)}x`;
                this.saveSettings();
            });
            this.vrFovSelect?.addEventListener("change", (e) => {
                this.vrFov = e.target.value === "360" ? "360" : "180";
                this.updateVRModeGeometry();
            });
            this.vrFormatSelect?.addEventListener("change", (e) => {
                this.vrFormat = ["mono", "sbs", "tb"].includes(e.target.value) ? e.target.value : "mono";
                this.updateVRModeGeometry();
            });

            document.addEventListener("keydown", (e) => this.handleKeyPress(e));
            document.addEventListener("fullscreenchange", () => this.syncFullscreenUI());
            document.addEventListener("click", (e) => this.handleOutsideClick(e));
        }

        setupMouseControls() {
            document.addEventListener("mousemove", (e) => {
                if (!this.isVRMode) return;
                if (this.isControlArea(e.target)) return;
                if (!this.settings.mouseTracking && !this.mouseDown) return;

                let deltaX = 0;
                let deltaY = 0;
                if (document.pointerLockElement) {
                    deltaX = e.movementX || 0;
                    deltaY = e.movementY || 0;
                } else {
                    if (this.firstMouseMove) {
                        this.lastMouseX = e.clientX;
                        this.lastMouseY = e.clientY;
                        this.firstMouseMove = false;
                        return;
                    }
                    deltaX = e.clientX - this.lastMouseX;
                    deltaY = e.clientY - this.lastMouseY;
                    this.lastMouseX = e.clientX;
                    this.lastMouseY = e.clientY;
                }

                const sensitivity = (this.settings.vrViewSensitivity / 100) * 0.5;
                const rotation = this.vrCamera.getAttribute("rotation");
                const yaw = rotation.y - deltaX * sensitivity;
                const pitch = Math.max(-90, Math.min(90, rotation.x - deltaY * sensitivity));
                this.vrCamera.setAttribute("rotation", `${pitch} ${yaw} 0`);
            });

            document.addEventListener("mousedown", (e) => {
                if (!this.isVRMode || this.isControlArea(e.target)) return;
                if (!this.settings.mouseTracking && e.button === 0) {
                    this.mouseDown = true;
                    const canvas = document.querySelector("a-scene canvas");
                    if (canvas?.requestPointerLock) canvas.requestPointerLock();
                }
            });

            document.addEventListener("mouseup", () => {
                if (!this.isVRMode) return;
                this.mouseDown = false;
                if (document.pointerLockElement && document.exitPointerLock) {
                    document.exitPointerLock();
                }
            });
        }

        isControlArea(target) {
            if (!(target instanceof Element)) return false;
            return Boolean(
                target.closest("#video-controls") ||
                target.closest("#settings-panel") ||
                target.closest("#file-list") ||
                target.closest(".toolbar")
            );
        }

        handleOutsideClick(e) {
            const target = e.target;
            if (!(target instanceof Element)) return;

            if (this.settingsPanel?.style.display !== "none" &&
                !target.closest("#settings-panel") &&
                !target.closest("#settings-btn")) {
                this.hideSettings();
            }
            if (this.fileList?.style.display !== "none" &&
                !target.closest("#file-list") &&
                !target.closest("#playlist-btn")) {
                this.hidePlaylist();
            }
        }

        handleKeyPress(e) {
            if (e.code === "Space") {
                e.preventDefault();
                this.togglePlayPause();
                return;
            }

            if (e.code === "Enter") {
                e.preventDefault();
                this.toggleFullscreen();
                return;
            }

            if (e.code === "Escape") {
                if (this.isVRMode) this.exitVRMode();
                if (document.fullscreenElement) document.exitFullscreen();
                this.hideSettings();
                this.hidePlaylist();
                return;
            }

            if (e.code === "ArrowRight") this.seekBy(10);
            if (e.code === "ArrowLeft") this.seekBy(-10);

            if (e.ctrlKey || e.metaKey) {
                if (e.code === "ArrowUp") this.adjustZoom(0.1);
                if (e.code === "ArrowDown") this.adjustZoom(-0.1);
                return;
            }

            if (e.code === "ArrowUp") this.adjustVolume(0.05);
            if (e.code === "ArrowDown") this.adjustVolume(-0.05);

            if (e.code === "KeyB") {
                this.vrFov = this.vrFov === "180" ? "360" : "180";
                this.updateVRModeSelection();
                this.updateVRModeGeometry();
            }

            if (e.code === "KeyV") {
                const formats = ["mono", "sbs", "tb"];
                const idx = formats.indexOf(this.vrFormat);
                this.vrFormat = formats[(idx + 1) % formats.length];
                this.updateVRModeSelection();
                this.updateVRModeGeometry();
            }

            if (e.code === "KeyR") {
                this.resetVRView();
                this.currentVRScale = this.settings.vrZoomLevel / 100;
                this.updateVRScale(this.currentVRScale);
            }

            if (e.code === "KeyK") {
                this.settings.mouseTracking = !this.settings.mouseTracking;
                this.saveSettings();
                const key = this.settings.mouseTracking ? "messages.mouse_tracking_enabled" : "messages.mouse_tracking_disabled";
                this.showNotification(window.i18n ? window.i18n.t(key) : "Mouse tracking toggled");
            }

            if (e.code === "KeyM") this.toggleMute();
        }

        togglePlayPause() {
            if (this.video.paused) this.play();
            else this.pause();
        }

        play() {
            this.video.play().catch(() => { });
        }

        pause() {
            this.video.pause();
        }

        stop() {
            this.video.pause();
            this.video.currentTime = 0;
            this.updateProgress();
        }

        seekBy(seconds) {
            if (!this.video.duration) return;
            const next = Math.max(0, Math.min(this.video.duration, this.video.currentTime + seconds));
            this.video.currentTime = next;
        }

        seekPercent(percent) {
            if (!this.video.duration) return;
            this.video.currentTime = (Number(percent) / 100) * this.video.duration;
        }

        adjustVolume(delta) {
            const v = Math.max(0, Math.min(1, this.video.volume + delta));
            this.video.volume = v;
            if (v > 0) {
                this.video.muted = false;
                this.isMuted = false;
            }
            this.updateVolumeDisplay();
        }

        toggleMute() {
            this.video.muted = !this.video.muted;
            this.isMuted = this.video.muted;
            this.updateVolumeDisplay();
        }

        updateVolumeDisplay() {
            if (!this.volumeBtn) return;
            this.volumeBtn.innerHTML = this.video.muted || this.video.volume === 0 ? "<span class=\"icon\">🔇</span>" : "<span class=\"icon\">🔊</span>";
        }

        toggleFullscreen() {
            const el = document.documentElement;
            if (!document.fullscreenElement) {
                el.requestFullscreen?.();
            } else {
                document.exitFullscreen?.();
            }
        }

        syncFullscreenUI() {
            if (!this.fullscreenBtn) return;
            this.fullscreenBtn.innerHTML = document.fullscreenElement ? "<span class=\"icon\">🡼</span>" : "<span class=\"icon\">⛶</span>";
        }

        enterVRMode() {
            if (this.isVRMode) return;
            this.isVRMode = true;
            this.videoContainer.style.display = "none";
            this.vrScene.style.display = "block";
            if (this.exitVrBtn) this.exitVrBtn.style.display = "grid";
            this.updateVRVideoSource();
            this.updateVRModeGeometry();
            this.updateVRScale(this.currentVRScale);
            this.updateButtonStates();
            this.showNotification(window.i18n ? window.i18n.t("messages.vr_mode_enabled") : "VR mode enabled");
        }

        exitVRMode() {
            if (!this.isVRMode) return;
            this.isVRMode = false;
            this.vrScene.style.display = "none";
            this.videoContainer.style.display = "block";
            if (this.exitVrBtn) this.exitVrBtn.style.display = "none";
            if (document.pointerLockElement && document.exitPointerLock) {
                document.exitPointerLock();
            }
            this.updateButtonStates();
            this.showNotification(window.i18n ? window.i18n.t("messages.vr_mode_disabled") : "VR mode disabled");
        }

        updateVRVideoSource() {
            if (!this.videosphere) return;
            this.videosphere.setAttribute("src", "#video-element");
        }

        updateVRModeGeometry() {
            if (!this.videosphere) return;
            const geometry = this.vrFov === "180"
                ? { radius: 500, phiLength: 180, phiStart: -90, thetaLength: 180, thetaStart: 0 }
                : { radius: 500, phiLength: 360, phiStart: 0, thetaLength: 180, thetaStart: 0 };
            this.videosphere.setAttribute("geometry", geometry);
            this.videosphere.setAttribute("material", { shader: "flat" });
            this.applyVRFormat();
            this.updateVRModeStatus();
        }

        applyVRFormat() {
            if (!this.videosphere) return;
            const mesh = this.videosphere.getObject3D("mesh");
            if (!mesh?.material?.map) return;

            switch (this.vrFormat) {
                case "sbs":
                    mesh.material.map.repeat.set(0.5, 1);
                    mesh.material.map.offset.set(0, 0);
                    break;
                case "tb":
                    mesh.material.map.repeat.set(1, 0.5);
                    mesh.material.map.offset.set(0, 0);
                    break;
                default:
                    mesh.material.map.repeat.set(1, 1);
                    mesh.material.map.offset.set(0, 0);
                    break;
            }
            mesh.material.map.needsUpdate = true;
        }

        updateVRScale(scale) {
            const s = Math.max(0.5, Math.min(4, scale));
            this.currentVRScale = s;
            if (this.zoomInput) this.zoomInput.value = String(Math.round(s * 100));
            if (this.zoomValue) this.zoomValue.textContent = `${s.toFixed(1)}x`;

            if (this.vrCamera) {
                const targetFov = Math.max(35, Math.min(120, 80 / s));
                this.vrCamera.setAttribute("camera", `fov: ${targetFov}`);
            }
        }

        adjustZoom(step) {
            this.currentVRScale = Math.max(0.5, Math.min(4, this.currentVRScale + step));
            this.settings.vrZoomLevel = Math.round(this.currentVRScale * 100);
            this.updateVRScale(this.currentVRScale);
            this.saveSettings();
        }

        resetVRView() {
            this.vrCamera?.setAttribute("rotation", "0 -90 0");
        }

        updateProgress() {
            if (!this.video.duration) {
                this.currentTimeEl.textContent = "00:00";
                this.totalTimeEl.textContent = "00:00";
                this.progressBar.value = 0;
                return;
            }

            const current = this.video.currentTime || 0;
            const duration = this.video.duration || 0;
            this.progressBar.value = (current / duration) * 100;
            this.currentTimeEl.textContent = this.formatTime(current);
            this.totalTimeEl.textContent = this.formatTime(duration);
        }

        formatTime(seconds) {
            if (!Number.isFinite(seconds)) return "00:00";
            const s = Math.floor(seconds % 60);
            const m = Math.floor((seconds / 60) % 60);
            const h = Math.floor(seconds / 3600);
            if (h > 0) {
                return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
            }
            return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
        }

        updatePlayButton() {
            if (!this.playPauseBtn) return;
            this.playPauseBtn.innerHTML = this.isPlaying ? "<span class=\"icon\">❚❚</span>" : "<span class=\"icon\">▶</span>";
        }

        updateVRModeStatus() {
            if (!this.vrModeText) return;
            const formatKey = `settings.vr_format_${this.vrFormat}`;
            const formatLabel = window.i18n ? window.i18n.t(formatKey) : this.vrFormat.toUpperCase();
            this.vrModeText.textContent = `${this.vrFov}° ${formatLabel}`;
        }

        updateVRModeSelection() {
            if (this.vrFovSelect) this.vrFovSelect.value = this.vrFov;
            if (this.vrFormatSelect) this.vrFormatSelect.value = this.vrFormat;
            this.updateVRModeStatus();
        }

        updateButtonStates() {
            this.vrBtn?.classList.toggle("vr-active", this.isVRMode);
            this.exitVrBtn?.classList.toggle("vr-active", this.isVRMode);
            this.playlistBtn?.classList.toggle("playlist-active", this.fileList?.style.display !== "none");
        }

        togglePlaylist() {
            if (!this.fileList) return;
            const visible = this.fileList.style.display !== "none";
            this.fileList.style.display = visible ? "none" : "block";
            this.updateButtonStates();
        }

        hidePlaylist() {
            if (!this.fileList) return;
            this.fileList.style.display = "none";
            this.updateButtonStates();
        }

        clearPlaylist() {
            this.videoList = [{
                name: this.currentTitle,
                src: this.currentVideo
            }];
            this.renderPlaylist();
            this.hidePlaylist();
        }

        renderPlaylist() {
            if (!this.fileListContent) return;
            this.fileListContent.innerHTML = "";
            this.videoList.forEach((item) => {
                const row = document.createElement("div");
                row.className = "file-item current";
                row.textContent = item.name || "VR Video";
                this.fileListContent.appendChild(row);
            });
        }

        toggleSettings() {
            if (!this.settingsPanel) return;
            const visible = this.settingsPanel.style.display !== "none";
            this.settingsPanel.style.display = visible ? "none" : "block";
        }

        hideSettings() {
            if (this.settingsPanel) this.settingsPanel.style.display = "none";
        }

        loadSettings() {
            try {
                const raw = localStorage.getItem(SETTINGS_KEY);
                if (raw) {
                    const saved = JSON.parse(raw);
                    this.settings = { ...this.settings, ...saved };
                }
            } catch (_) {
                // Ignore invalid local settings.
            }

            this.currentVRScale = (this.settings.vrZoomLevel || 100) / 100;

            if (this.loopInput) this.loopInput.checked = this.settings.loop;
            if (this.themeSelect) this.themeSelect.value = this.settings.theme;
            if (this.languageSelect) this.languageSelect.value = this.settings.language;
            if (this.mouseSensitivityInput) this.mouseSensitivityInput.value = String(this.settings.vrViewSensitivity);
            if (this.sensitivityValue) this.sensitivityValue.textContent = String(this.settings.vrViewSensitivity);
            if (this.zoomInput) this.zoomInput.value = String(this.settings.vrZoomLevel);
            if (this.zoomValue) this.zoomValue.textContent = `${this.currentVRScale.toFixed(1)}x`;
        }

        saveSettings() {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
        }

        applySettings() {
            this.video.loop = this.settings.loop;
            this.applyTheme(this.settings.theme);
            this.updateVRScale(this.currentVRScale);
            this.updateVolumeDisplay();
        }

        applyTheme(theme) {
            const body = document.body;
            body.classList.remove("dark-theme", "light-theme");

            if (theme === "light") {
                body.classList.add("light-theme");
                return;
            }
            if (theme === "dark") {
                body.classList.add("dark-theme");
                return;
            }

            if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
                body.classList.add("dark-theme");
            }
        }

        showNotification(message) {
            if (!message) return;
            const old = document.querySelector(".notification");
            if (old) old.remove();

            const toast = document.createElement("div");
            toast.className = "notification";
            toast.textContent = message;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2200);
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        const player = new VRPlayerWeb();
        player.init();
    });
})();
