
import fs from 'fs';
import path from 'path';

/**
 * HitFM TTS Diagnostic Tool
 * Specifically designed to catch Scenario 1-5 regarding empty responses.
 */
async function diagnoseTTS() {
    console.log('--- HitFM TTS Diagnostic Tool (Scenario Diagnosis) ---');

    // 1. Load config from .env
    const envPath = path.resolve(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) {
        console.error('❌ .env file not found!');
        return;
    }

    const env = fs.readFileSync(envPath, 'utf-8').split('\n').reduce((acc, line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return acc;
        const [key, ...val] = trimmed.split('=');
        if (key && val) acc[key.trim()] = val.join('=').trim();
        return acc;
    }, {});

    const API_KEY = env.GEMINI_API_KEY;
    const BASE_URL = env.GEMINI_BASE_URL || 'https://yunwu.ai';
    const TTS_MODEL = env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';

    if (!API_KEY) {
        console.error('❌ GEMINI_API_KEY missing in .env');
        return;
    }

    // 2. Define Test Cases representing Scenarios 1-4
    const testCases = [
        {
            name: "Scenario 1 (Normal / Chinglish)",
            text: "Yo it's Andy. 这里的氛围真不错, let's keep the vibe alive on HitFM! [Laughs]",
            desc: "Standard app behavior - check if persona/mixed language causes refusal."
        },
        {
            name: "Scenario 1 (Safety Trigger - Toxicity)",
            text: "You are a complete idiot and I hate you so much, shut up!",
            desc: "Tests if 'BLOCK_NONE' actually works or if safety filters block the audio part."
        },
        {
            name: "Scenario 2 (Copyright - Song Lyrics)",
            text: "I'm the problem, it's me. At tea time, everybody agrees. I'll stare directly at the sun but never in the mirror.",
            desc: "Tests if RECITATION check blocks known lyrics from Taylor Swift."
        },
        {
            name: "Scenario 3 (Empty / Malformed)",
            text: "",
            desc: "Tests behavior when input is empty."
        },
        {
            name: "Scenario 4 (Model Persona Control)",
            text: "I am absolutely FURIOUS! Why would you do this! UNACCEPTABLE!",
            desc: "Tests if extreme tone/emotion causes refusal."
        }
    ];

    for (const test of testCases) {
        console.log(`\n==================================================`);
        console.log(`[TEST CASE] ${test.name}`);
        console.log(`Description: ${test.desc}`);
        console.log(`Text: "${test.text}"`);
        console.log(`==================================================`);

        try {
            const url = `${BASE_URL}/v1beta/models/${TTS_MODEL}:generateContent?key=${API_KEY}`;
            const startTime = Date.now();

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: "user", parts: [{ text: test.text }] }],
                    generationConfig: {
                        responseModalities: ["AUDIO"],
                        speechConfig: {
                            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } }
                        },
                        temperature: 1.0, // High enough to test stability
                        maxOutputTokens: 1024
                    },
                    safetySettings: [
                        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                    ]
                })
            });

            const latency = Date.now() - startTime;
            console.log(`HTTP Status: ${res.status} (${latency}ms)`);

            if (!res.ok) {
                const errText = await res.text();
                console.error(`❌ HTTP Error: ${errText}`);
                continue;
            }

            const data = await res.json();

            // Critical Diagnostic Info
            if (data.promptFeedback) {
                console.log(`\n[Prompt Feedback]:`, JSON.stringify(data.promptFeedback, null, 2));
            }

            if (data.candidates && data.candidates.length > 0) {
                const candidate = data.candidates[0];
                console.log(`Finish Reason: ${candidate.finishReason}`);

                if (candidate.safetyRatings) {
                    console.log(`Safety Ratings:`, JSON.stringify(candidate.safetyRatings, null, 2));
                }

                const audioPart = candidate.content?.parts?.find(p => p.inlineData);
                if (audioPart) {
                    console.log(`✅ SUCCESS: Received audio data (${audioPart.inlineData.data.length} bytes base64)`);
                } else {
                    console.log(`❌ FAILURE: Candidate found but NO audio/inlineData part.`);
                    console.log(`Parts available:`, candidate.content?.parts?.map(p => Object.keys(p)));
                }
            } else {
                console.log(`❌ FAILURE: Empty Candidates Array.`);
                console.log(`Full API Response Body:`, JSON.stringify(data, null, 2));
            }
        } catch (e) {
            console.error(`❌ Diagnostic Error: ${e.message}`);
        }
    }
    console.log(`\n--- Diagnosis Complete ---`);
}

diagnoseTTS().catch(console.error);
