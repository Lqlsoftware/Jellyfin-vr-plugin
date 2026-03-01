namespace Jellyfin.Plugin.VR.Models;

/// <summary>
/// VR video detection result.
/// </summary>
public class VRVideoInfo
{
    /// <summary>
    /// Gets or sets a value indicating whether the video is a VR video.
    /// </summary>
    public bool IsVR { get; set; }

    /// <summary>
    /// Gets or sets the VR field of view: "180" or "360".
    /// </summary>
    public string Fov { get; set; } = "180";

    /// <summary>
    /// Gets or sets the VR format: "mono", "sbs", or "tb".
    /// </summary>
    public string Format { get; set; } = "mono";
}
