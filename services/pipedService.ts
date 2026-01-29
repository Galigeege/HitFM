/**
 * Piped API Integation
 * Fetches direct audio streams from YouTube videos via Piped instances.
 * This bypasses YouTube's geo-restrictions, ads, and signature algorithms.
 */

// A mix of known public instances
const PIPED_INSTANCES = [
    "https://api.piped.private.coffee",
    "https://pipedapi.kavin.rocks",
    "https://api.piped.privacy.com.de",
    "https://piped-api.lunar.icu",
    "https://pipedapi.tokhmi.xyz",
    "https://api.piped.projectsegfau.lt"
];

export const getAudioStreamUrl = async (videoId: string): Promise<string | null> => {
    // Try instances one by one until success
    for (const baseUrl of PIPED_INSTANCES) {
        let timeoutId;
        try {
            console.log(`[Piped] Trying instance: ${baseUrl}...`);

            const controller = new AbortController();
            // Set a strict 3s timeout for fast failover
            timeoutId = setTimeout(() => controller.abort(), 3000);

            const response = await fetch(`${baseUrl}/streams/${videoId}`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                console.warn(`[Piped] Instance ${baseUrl} failed with status: ${response.status}`);
                continue;
            }

            const data = await response.json();

            // Find the best audio stream
            const audioStreams = data.audioStreams || [];

            if (audioStreams.length === 0) {
                console.warn(`[Piped] Instance ${baseUrl} returned no audio streams.`);
                continue;
            }

            // Sort by bitrate descending to get high quality
            audioStreams.sort((a: any, b: any) => b.bitrate - a.bitrate);

            // Prefer m4a for native HTML5 audio compatibility
            const bestStream = audioStreams.find((s: any) => s.mimeType.includes("mp4") || s.mimeType.includes("m4a")) || audioStreams[0];

            if (bestStream && bestStream.url) {
                console.log(`[Piped] Success via ${baseUrl}`);
                return bestStream.url;
            }
        } catch (error: any) {
            if (timeoutId) clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                console.warn(`[Piped] Timeout on instance ${baseUrl}`);
            } else {
                console.warn(`[Piped] Connection error with ${baseUrl}:`, error);
            }
        }
    }

    console.error("[Piped] All instances failed to resolve video ID:", videoId);
    return null;
};

export const extractYTId = (url: string) => {
    const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};
