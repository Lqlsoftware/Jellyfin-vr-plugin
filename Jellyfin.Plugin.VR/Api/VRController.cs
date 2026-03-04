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
[Authorize(Policy = "DefaultAuthorization")]
public class VRController : ControllerBase
{
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
        var item = _libraryManager.GetItemById(itemId);
        if (item == null)
        {
            return NotFound();
        }

        if (item is not MediaBrowser.Controller.Entities.Video)
        {
            return NotFound();
        }

        var info = VRDetectionService.DetectVRVideo(item, _mediaSourceManager);
        return Ok(info);
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
            var item = _libraryManager.GetItemById(itemId);
            if (item == null)
            {
                return NotFound();
            }

            if (item is not MediaBrowser.Controller.Entities.Video)
            {
                return NotFound();
            }

            var authInfo = await _authContext.GetAuthorizationInfo(Request).ConfigureAwait(false);
            var token = authInfo?.Token;
            if (string.IsNullOrEmpty(token))
            {
                return Unauthorized();
            }

            var vrInfo = VRDetectionService.DetectVRVideo(item, _mediaSourceManager);

            var baseUrl = $"{Request.Scheme}://{Request.Host}";
            var streamUrl = $"{baseUrl}/Videos/{itemId}/stream?Static=true&api_key={token}";

            var title = string.IsNullOrWhiteSpace(item.Name) ? "VR Video" : item.Name;
            var phiStart = vrInfo.Fov == "180" ? "-90" : "0";
            var html = await GetVRPlayerHtml(streamUrl, vrInfo.Fov, vrInfo.Format, phiStart, title).ConfigureAwait(false);
            return Content(html, "text/html; charset=utf-8");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to render VR play page for item {ItemId}", itemId);
            return Problem("VR 播放页面生成失败，请查看 Jellyfin 日志。");
        }
    }

    private static async Task<string> GetVRPlayerHtml(string streamUrl, string fov, string format, string phiStart, string title)
    {
        var assembly = Assembly.GetExecutingAssembly();
        var resourceName = "Jellyfin.Plugin.VR.www.vr-player.html";
        await using var stream = assembly.GetManifestResourceStream(resourceName);
        if (stream == null)
        {
            return CreateFallbackHtml(streamUrl, fov, format, phiStart, title);
        }

        using var reader = new StreamReader(stream, Encoding.UTF8);
        var template = await reader.ReadToEndAsync().ConfigureAwait(false);
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
}
