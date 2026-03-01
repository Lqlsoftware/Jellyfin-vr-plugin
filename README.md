# Jellyfin VR Plugin

Jellyfin 插件，支持 VR 视频检测与播放。

## 功能

- **VR 视频检测**：通过文件名、分辨率、Genre/Tags 自动识别 VR 视频
- **VR 播放页面**：独立 VR 播放器，支持 180°/360°、Mono/SBS/TB 格式

## 安装

1. 从 [Releases](https://github.com/your-repo/jellyfin-vr-plugin/releases) 下载 `Jellyfin.Plugin.VR.dll`
2. 将 DLL 复制到 Jellyfin 插件目录：
   - **Windows**: `%LOCALAPPDATA%\jellyfin\plugins\Jellyfin.Plugin.VR\`
   - **Linux 原生**: `~/.local/share/jellyfin/plugins/Jellyfin.Plugin.VR/`
   - **Linux Docker**: 宿主机上映射到容器 `/config` 的目录下的 `plugins/Jellyfin.Plugin.VR/`
     - 例如宿主机 `./jellyfin/config` 映射到 `/config` 时，插件路径为：`./jellyfin/config/plugins/Jellyfin.Plugin.VR/`
     - 创建目录并复制：`mkdir -p ./jellyfin/config/plugins/Jellyfin.Plugin.VR && cp Jellyfin.Plugin.VR.dll ./jellyfin/config/plugins/Jellyfin.Plugin.VR/`
3. 重启 Jellyfin 服务（Docker 用户执行 `docker restart <容器名>`）

### Docker 用户注意

- 确保 `docker-compose.yml` 或 `docker run` 中已挂载 `/config` 卷，例如：
  ```yaml
  volumes:
    - /path/on/host/config:/config
  ```
- 插件需放在宿主机上对应 `config` 目录下的 `plugins/Jellyfin.Plugin.VR/` 中

## 构建

```bash
dotnet build Jellyfin.Plugin.VR.sln
```

输出位于 `Jellyfin.Plugin.VR/bin/Debug/net6.0/` 或 `Release` 目录。

## 发布（GitHub Release Action）

项目已内置工作流：`.github/workflows/release-plugin.yml`。

### 方式 1：打 tag 自动发布

```bash
git tag v1.0.0.0
git push origin v1.0.0.0
```

### 方式 2：手动触发

在 GitHub Actions 页面运行 `Release Jellyfin VR Plugin`，并填写 `release_tag`（例如 `v1.0.0.0`）。

### 发布产物

- `Jellyfin.Plugin.VR_<version>.zip`
- `Jellyfin.Plugin.VR_<version>.zip.md5`
- `manifest.json`（用于 Jellyfin 插件仓库）

## 作为 Jellyfin 自定义仓库使用

在 Jellyfin 后台：

`Dashboard -> Plugins -> Repositories`

添加仓库 URL：

```text
https://github.com/<你的GitHub用户名>/<你的仓库名>/releases/latest/download/manifest.json
```

然后重启 Jellyfin，即可在插件目录中看到该插件。

说明：
- `manifest.json` 中 `targetAbi` 已配置为 `10.8.3.0`。
- 仓库必须是公开可访问，且 Jellyfin 所在网络能够访问 GitHub。

## 使用

### API

- `GET /VR/Video/{itemId}/Info` - 获取 VR 视频检测结果
- `GET /VR/Video/{itemId}/Play` - 打开 VR 播放页面（需登录）

### VR 播放

在视频详情页，手动访问以下 URL 打开 VR 播放：

```
http://your-jellyfin-server/VR/Video/{itemId}/Play
```

需先登录 Jellyfin Web 客户端，再在新标签页打开上述链接。

## VR 检测规则

1. **Genre/Tags**：若视频的 Genre 或 Tag 包含 "VR"、"360"、"180" 等关键词
2. **文件名**：若文件名包含 360、180、sbs、tb、vr、panorama 等关键词
3. **分辨率**：若宽高比符合 VR 视频典型比例（如 2:1、4:1、32:9 等）

## 参考

- [VRPlayer](VRPlayer/) - 本插件的 VR 检测与播放逻辑参考自该项目
