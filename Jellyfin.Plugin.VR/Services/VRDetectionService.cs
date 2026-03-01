using System.Text.RegularExpressions;
using Jellyfin.Plugin.VR.Models;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Library;
using MediaBrowser.Model.Entities;

namespace Jellyfin.Plugin.VR.Services;

/// <summary>
/// Service for detecting VR videos from filename, resolution, and genre/tags.
/// </summary>
public static class VRDetectionService
{
    private static readonly string[] VrKeywords =
    [
        "vr", "360", "180", "sbs", "side-by-side", "sidebyside",
        "tb", "top-bottom", "topbottom", "ou", "over-under",
        "stereo", "3d", "cardboard", "oculus", "gear",
        "pano", "panorama", "spherical", "equirectangular",
        "cubemap", "fisheye", "fulldome", "immersive",
        "monoscopic", "stereoscopic", "dome", "planetarium",
        "quest", "vive", "rift", "pico", "wmr", "valve",
        "varjo", "pimax", "samsung", "daydream", "gopro",
        "4k360", "8k360", "4k180", "8k180", "6k", "8k", "360p", "180p",
        "virtual", "reality", "experience", "immerse",
        "spatial", "volumetric", "ambisonics"
    ];

    private static readonly string[] Keywords360 =
    [
        "360", "360°", "full360", "full-360",
        "4k360", "8k360", "360p", "360vr", "vr360",
        "spherical", "equirectangular", "full-sphere"
    ];

    private static readonly string[] Keywords180 =
    [
        "180", "180°", "half180", "half-180",
        "4k180", "8k180", "180p", "180vr", "vr180",
        "hemisphere", "half-sphere", "front180"
    ];

    private static readonly string[] SbsKeywords = ["sbs", "side-by-side", "sidebyside", "stereo"];
    private static readonly string[] TbKeywords = ["tb", "top-bottom", "topbottom", "ou", "over-under"];

    private static readonly (double Ratio, double Tolerance, string Fov, string Format)[] VrAspectRatios =
    [
        (2.0, 0.12, "360", "mono"),
        (4.0, 0.2, "360", "sbs"),
        (1.0, 0.1, "360", "tb"),
        (1.0, 0.1, "180", "mono"),
        (32.0 / 9, 0.2, "180", "sbs"),
        (8.0 / 3, 0.2, "180", "sbs"),
        (16.0 / 18, 0.1, "180", "tb"),
        (4.0 / 6, 0.1, "180", "tb"),
        (2.35, 0.1, "180", "mono")
    ];

    private static readonly string[] GenreTagVrKeywords = ["vr", "360", "180", "virtual reality", "stereoscopic", "panorama", "spherical"];

    /// <summary>
    /// Detects if the given item is a VR video and returns VR metadata.
    /// </summary>
    /// <param name="item">The base item (video) to analyze.</param>
    /// <param name="mediaSourceManager">The media source manager for resolution detection.</param>
    /// <returns>VR video info with detection results.</returns>
    public static VRVideoInfo DetectVRVideo(BaseItem item, IMediaSourceManager mediaSourceManager)
    {
        var result = new VRVideoInfo { IsVR = false, Fov = "180", Format = "mono" };

        // Priority 1: Check genre/tags
        if (DetectFromGenreAndTags(item, result))
        {
            return result;
        }

        // Priority 2: Check filename
        if (DetectFromFilename(item.Path ?? item.Name, result))
        {
            return result;
        }

        // Priority 3: Check resolution from media streams
        if (DetectFromResolution(item, result, mediaSourceManager))
        {
            return result;
        }

        return result;
    }

    private static bool DetectFromGenreAndTags(BaseItem item, VRVideoInfo result)
    {
        var toCheck = new List<string>();

        if (item.Genres != null)
        {
            toCheck.AddRange(item.Genres.Select(g => g.ToLowerInvariant()));
        }

        if (item.Tags != null)
        {
            toCheck.AddRange(item.Tags.Select(t => t.ToLowerInvariant()));
        }

        foreach (var keyword in GenreTagVrKeywords)
        {
            if (toCheck.Any(s => s.Contains(keyword, StringComparison.Ordinal)))
            {
                result.IsVR = true;
                if (keyword.Contains("360", StringComparison.Ordinal))
                {
                    result.Fov = "360";
                }
                else if (keyword.Contains("180", StringComparison.Ordinal))
                {
                    result.Fov = "180";
                }

                return true;
            }
        }

        return false;
    }

    private static bool DetectFromFilename(string? filePath, VRVideoInfo result)
    {
        if (string.IsNullOrEmpty(filePath))
        {
            return false;
        }

        var fileName = Path.GetFileName(filePath).ToLowerInvariant();
        if (string.IsNullOrEmpty(fileName))
        {
            return false;
        }

        // Check if any VR keyword exists as complete word
        var hasVrKeyword = VrKeywords.Any(keyword => HasCompleteWord(fileName, keyword));
        if (!hasVrKeyword)
        {
            return false;
        }

        result.IsVR = true;

        // Detect FOV
        foreach (var keyword in Keywords180)
        {
            if (HasCompleteWord(fileName, keyword))
            {
                result.Fov = "180";
                break;
            }
        }

        foreach (var keyword in Keywords360)
        {
            if (HasCompleteWord(fileName, keyword))
            {
                result.Fov = "360";
                break;
            }
        }

        // Detect format
        foreach (var keyword in SbsKeywords)
        {
            if (HasCompleteWord(fileName, keyword))
            {
                result.Format = "sbs";
                break;
            }
        }

        foreach (var keyword in TbKeywords)
        {
            if (HasCompleteWord(fileName, keyword))
            {
                result.Format = "tb";
                break;
            }
        }

        return true;
    }

    private static bool DetectFromResolution(BaseItem item, VRVideoInfo result, IMediaSourceManager mediaSourceManager)
    {
        try
        {
            var streams = mediaSourceManager.GetMediaStreams(item.Id);
            var videoStream = streams?.FirstOrDefault(s => s.Type == MediaStreamType.Video);
            if (videoStream == null || videoStream.Width == null || videoStream.Height == null)
            {
                return false;
            }

            var width = videoStream.Width.Value;
            var height = videoStream.Height.Value;
            var aspectRatio = (double)width / height;

            foreach (var (ratio, tolerance, fov, format) in VrAspectRatios)
            {
                if (Math.Abs(aspectRatio - ratio) < tolerance)
                {
                    result.IsVR = true;
                    if (string.IsNullOrEmpty(result.Fov) || result.Fov == "180")
                    {
                        result.Fov = fov;
                    }

                    if (result.Format == "mono")
                    {
                        result.Format = format;
                    }

                    return true;
                }
            }
        }
        catch
        {
            // Ignore errors when reading media streams
        }

        return false;
    }

    private static bool HasCompleteWord(string text, string keyword)
    {
        var escaped = Regex.Escape(keyword);
        var pattern = $@"\b{escaped}\b";
        return Regex.IsMatch(text, pattern, RegexOptions.IgnoreCase);
    }
}
