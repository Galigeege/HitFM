/**
 * SUNO API Integration
 * Generates original AI music via SUNO's chirp-v4 model.
 * Returns direct audio URLs for playback.
 */

const getBaseUrl = () => process.env.GEMINI_BASE_URL || "https://yunwu.ai";
const getApiKey = () => process.env.GEMINI_API_KEY || "";

export interface SunoTask {
    id: string;
    status: 'pending' | 'running' | 'succeeded' | 'error';
    audio_url?: string;
    image_url?: string;
    title?: string;
    tags?: string;
    prompt?: string;
    error_message?: string;
}

export interface SunoGenerationParams {
    prompt: string;      // Lyrics with [Verse], [Chorus], etc.
    title: string;
    tags: string;        // Genre/style tags like "pop, upbeat, energetic"
    mv?: string;         // Model version, default chirp-v4
}

/**
 * Submit a music generation task to SUNO
 * @returns task_id for polling
 */
export const submitMusicGeneration = async (params: SunoGenerationParams): Promise<string> => {
    const baseUrl = getBaseUrl();
    const apiKey = getApiKey();

    console.log(`[SUNO] Submitting music generation: "${params.title}"`);

    const response = await fetch(`${baseUrl}/suno/submit/music`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            prompt: params.prompt,
            title: params.title,
            tags: params.tags,
            mv: params.mv || 'chirp-v4',
            continue_at: 0,
            continue_clip_id: '',
            task: ''
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[SUNO] Submit failed:', errorText);
        throw new Error(`SUNO_SUBMIT_ERROR: ${response.status}`);
    }

    const result = await response.json();

    if (result.code !== 'success') {
        throw new Error(`SUNO_SUBMIT_ERROR: ${result.message || 'Unknown error'}`);
    }

    console.log(`[SUNO] Task created: ${result.data}`);
    return result.data; // task_id
};

/**
 * Fetch the status and result of a SUNO task
 */
export const fetchTaskResult = async (taskId: string): Promise<SunoTask> => {
    const baseUrl = getBaseUrl();
    const apiKey = getApiKey();

    const response = await fetch(`${baseUrl}/suno/fetch/${taskId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error(`SUNO_FETCH_ERROR: ${response.status}`);
    }

    const result = await response.json();

    // Handle different response formats
    const data = result.data || result;

    return {
        id: taskId,
        status: data.status || 'pending',
        audio_url: data.audio_url,
        image_url: data.image_url,
        title: data.title,
        tags: data.tags,
        prompt: data.prompt,
        error_message: data.error_message
    };
};

/**
 * Poll for task completion with exponential backoff
 * @param taskId - The SUNO task ID
 * @param maxAttempts - Maximum polling attempts (default 60 = ~5 minutes)
 * @param initialInterval - Starting interval in ms (default 5000 = 5s)
 * @returns The completed task with audio_url
 */
export const waitForCompletion = async (
    taskId: string,
    maxAttempts: number = 60,
    initialInterval: number = 5000
): Promise<SunoTask> => {
    let attempts = 0;
    let interval = initialInterval;

    while (attempts < maxAttempts) {
        attempts++;

        console.log(`[SUNO] Polling attempt ${attempts}/${maxAttempts}...`);

        const task = await fetchTaskResult(taskId);

        if (task.status === 'succeeded') {
            console.log(`[SUNO] Generation complete! Audio: ${task.audio_url}`);
            return task;
        }

        if (task.status === 'error') {
            console.error('[SUNO] Generation failed:', task.error_message);
            throw new Error(`SUNO_GENERATION_ERROR: ${task.error_message || 'Unknown'}`);
        }

        console.log(`[SUNO] Status: ${task.status}. Waiting ${interval}ms...`);

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, interval));

        // Slight backoff, cap at 10s
        interval = Math.min(interval * 1.1, 10000);
    }

    throw new Error('SUNO_TIMEOUT: Max polling attempts reached');
};
