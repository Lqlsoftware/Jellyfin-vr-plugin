using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.VR.Configuration;

/// <summary>
/// Plugin configuration for VR video support.
/// </summary>
public class PluginConfiguration : BasePluginConfiguration
{
    /// <summary>
    /// Initializes a new instance of the <see cref="PluginConfiguration"/> class.
    /// </summary>
    public PluginConfiguration()
    {
        DefaultFov = "180";
        DefaultFormat = "mono";
    }

    /// <summary>
    /// Gets or sets the default VR field of view (180 or 360).
    /// </summary>
    public string DefaultFov { get; set; }

    /// <summary>
    /// Gets or sets the default VR format (mono, sbs, tb).
    /// </summary>
    public string DefaultFormat { get; set; }
}
