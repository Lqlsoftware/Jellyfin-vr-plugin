using System.IO;
using System.Reflection;
using System.Text;
using Jellyfin.Plugin.VR.Models;
using Jellyfin.Plugin.VR.Services;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Library;
using MediaBrowser.Controller.Net;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.VR.Api;

/// <summary>
/// API controller for VR video detection and playback.
/// </summary>
[ApiController]
[Route("VR")]
[Authorize]
public class VRController : ControllerBase
{
    private static readonly HashSet<string> AllowedAssetRoots = new(StringComparer.OrdinalIgnoreCase)
    {
        "styles",
        "scripts",
        "locales"
    };

    private readonly ILibraryManager _libraryManager;
    private readonly IMediaSourceManager _mediaSourceManager;
    private readonly IAuthorizationContext _authContext;
    private readonly ILogger<VRController> _logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="VRController"/> class.
    /// </summary>
    public VRController(
        ILibraryManager libraryManager,
        IMediaSourceManager mediaSourceManager,
        IAuthorizationContext authContext,
        ILogger<VRController> logger)
    {
        _libraryManager = libraryManager;
        _mediaSourceManager = mediaSourceManager;
        _authContext = authContext;
        _logger = logger;
    }

    /// <summary>
    /// Gets VR video info for the specified item.
    /// </summary>
    /// <param name="itemId">The item ID.</param>
    /// <returns>VR video detection result.</returns>
    [HttpGet("Video/{itemId}/Info")]
    [ProducesResponseType(typeof(VRVideoInfo), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public ActionResult<VRVideoInfo> GetVideoInfo([FromRoute] Guid itemId)
    {
        try
        {
            _logger.LogInformation(
                "VR info request start. ItemId={ItemId}, Path={Path}, PathBase={PathBase}",
                itemId,
                Request.Path,
                Request.PathBase);

            var item = _libraryManager.GetItemById(itemId);
            if (item == null)
            {
                _logger.LogWarning("VR info request item not found. ItemId={ItemId}", itemId);
                return NotFound();
            }

            if (item is not MediaBrowser.Controller.Entities.Video)
            {
                _logger.LogWarning("VR info request item is not video. ItemId={ItemId}, ItemType={ItemType}", itemId, item.GetType().FullName);
                return NotFound();
            }

            var info = VRDetectionService.DetectVRVideo(item, _mediaSourceManager, _logger);
            _logger.LogInformation("VR info request done. ItemId={ItemId}, IsVR={IsVR}, Fov={Fov}, Format={Format}", itemId, info.IsVR, info.Fov, info.Format);
            return Ok(info);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "VR info request failed. ItemId={ItemId}", itemId);
            return Problem("VR 信息获取失败，请查看 Jellyfin 日志。");
        }
    }

    /// <summary>
    /// Gets the VR player page for the specified item.
    /// </summary>
    /// <param name="itemId">The item ID.</param>
    /// <returns>HTML page for VR playback.</returns>
    [HttpGet("Video/{itemId}/Play")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPlayPage([FromRoute] Guid itemId)
    {
        try
        {
            _logger.LogInformation(
                "VR play request start. ItemId={ItemId}, Path={Path}, PathBase={PathBase}, Host={Host}",
                itemId,
                Request.Path,
                Request.PathBase,
                Request.Host);

            var item = _libraryManager.GetItemById(itemId);
            if (item == null)
            {
                _logger.LogWarning("VR play item not found. ItemId={ItemId}", itemId);
                return NotFound();
            }

            if (item is not MediaBrowser.Controller.Entities.Video)
            {
                _logger.LogWarning("VR play item is not video. ItemId={ItemId}, ItemType={ItemType}", itemId, item.GetType().FullName);
                return NotFound();
            }

            var authInfo = await _authContext.GetAuthorizationInfo(Request).ConfigureAwait(false);
            var token = authInfo?.Token;
            if (string.IsNullOrEmpty(token))
            {
                _logger.LogWarning("VR play unauthorized (empty token). ItemId={ItemId}", itemId);
                return Unauthorized();
            }

            var baseUrl = $"{Request.Scheme}://{Request.Host}{Request.PathBase}";
            var streamUrl = $"{baseUrl}/Videos/{itemId}/stream?Static=true&api_key={token}";

            var title = string.IsNullOrWhiteSpace(item.Name) ? "VR Video" : item.Name;
            const string defaultFov = "180";
            const string defaultFormat = "mono";
            const string phiStart = "-90";
            var html = await GetVRPlayerHtml(streamUrl, defaultFov, defaultFormat, phiStart, title, _logger).ConfigureAwait(false);
            _logger.LogInformation(
                "VR play request done. ItemId={ItemId}, Fov={Fov}, Format={Format}, StreamUrlBase={Base}",
                itemId,
                defaultFov,
                defaultFormat,
                $"{Request.Scheme}://{Request.Host}{Request.PathBase}");
            return Content(html, "text/html; charset=utf-8");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to render VR play page for item {ItemId}", itemId);
            return Problem("VR 播放页面生成失败，请查看 Jellyfin 日志。");
        }
    }

    /// <summary>
    /// Gets embedded web assets for VR player page.
    /// </summary>
    /// <param name="assetPath">Relative path under www.</param>
    /// <returns>Embedded static file content.</returns>
    [HttpGet("Assets/{*assetPath}")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetAsset([FromRoute] string? assetPath)
    {
        if (string.IsNullOrWhiteSpace(assetPath))
        {
            return NotFound();
        }

        var normalized = assetPath.Replace('\\', '/').TrimStart('/');
        if (normalized.Contains("..", StringComparison.Ordinal))
        {
            return NotFound();
        }

        var firstSlash = normalized.IndexOf('/');
        if (firstSlash <= 0)
        {
            return NotFound();
        }

        var root = normalized[..firstSlash];
        if (!AllowedAssetRoots.Contains(root))
        {
            return NotFound();
        }

        var resourceName = $"Jellyfin.Plugin.VR.www.{normalized.Replace('/', '.')}";
        var assembly = Assembly.GetExecutingAssembly();
        await using var stream = assembly.GetManifestResourceStream(resourceName);
        if (stream == null)
        {
            return NotFound();
        }

        await using var ms = new MemoryStream();
        await stream.CopyToAsync(ms).ConfigureAwait(false);
        return File(ms.ToArray(), GetContentType(normalized));
    }

    private static async Task<string> GetVRPlayerHtml(string streamUrl, string fov, string format, string phiStart, string title, ILogger logger)
    {
        var assembly = Assembly.GetExecutingAssembly();
        var resourceName = "Jellyfin.Plugin.VR.www.vr-player.html";
        await using var stream = assembly.GetManifestResourceStream(resourceName);
        if (stream == null)
        {
            logger.LogWarning("Embedded VR template not found, using fallback html. Resource={ResourceName}", resourceName);
            return CreateFallbackHtml(streamUrl, fov, format, phiStart, title);
        }

        using var reader = new StreamReader(stream, Encoding.UTF8);
        var template = await reader.ReadToEndAsync().ConfigureAwait(false);
        logger.LogDebug("Loaded embedded VR template. Size={Size}", template.Length);
        return template
            .Replace("{{STREAM_URL}}", streamUrl)
            .Replace("{{FOV}}", fov)
            .Replace("{{FORMAT}}", format)
            .Replace("{{PHI_START}}", phiStart)
            .Replace("{{PHI_LENGTH}}", fov == "180" ? "180" : "360")
            .Replace("{{TITLE}}", title);
    }

    private static string CreateFallbackHtml(string streamUrl, string fov, string format, string phiStart, string title)
    {
        return $"""
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VR Player - {title}</title>
    <script src="https://aframe.io/releases/1.4.2/aframe.min.js"></script>
</head>
<body>
    <a-scene embedded vr-mode-ui="enabled: false">
        <a-videosphere src="{streamUrl}" geometry="radius: 500; phiLength: {fov}; phiStart: {phiStart}" material="shader: flat"></a-videosphere>
        <a-camera position="0 1.6 0" rotation="0 -90 0"></a-camera>
    </a-scene>
</body>
</html>
""";
    }

    private static string GetContentType(string assetPath)
    {
        return Path.GetExtension(assetPath).ToLowerInvariant() switch
        {
            ".css" => "text/css; charset=utf-8",
            ".js" => "application/javascript; charset=utf-8",
            ".json" => "application/json; charset=utf-8",
            _ => "application/octet-stream"
        };
    }
}
