
import fs from 'fs';
import path from 'path';

/**
 * Single-file test script for HitFM API connectivity (YunWu AI)
 * Updated to use specific TEXT and TTS models from .env
 */

async function runTest() {
    console.log('--- HitFM 2.0 API Test (YunWu Provider) ---');

    // 1. Parse .env
    const envPath = path.resolve(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) {
        console.error('❌ .env file not found!');
        return;
    }

    const envContent = fs.readFileSync(envPath, 'utf-8');
    const env = {};
    envContent.split('\n').forEach(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#')) return;
        const [key, ...value] = trimmedLine.split('=');
        if (key && value) env[key.trim()] = value.join('=').trim();
    });

    const API_KEY = env.GEMINI_API_KEY;
    const BASE_URL = env.GEMINI_BASE_URL || 'https://yunwu.ai';
    const TEXT_MODEL = env.GEMINI_MODEL || 'gemini-2.0-flash-exp';
    const TTS_MODEL = env.GEMINI_TTS_MODEL || 'gemini-2.0-flash-exp';

    if (!API_KEY) {
        console.error('❌ GEMINI_API_KEY missing in .env');
        return;
    }

    console.log(`- Base URL: ${BASE_URL}`);
    console.log(`- Text Model: ${TEXT_MODEL}`);
    console.log(`- TTS Model : ${TTS_MODEL}`);
    console.log(`- API Key   : ${API_KEY.substring(0, 8)}...`);

    // --- TEST 1: Text Generation (using TEXT_MODEL) ---
    console.log(`\n[Test 1] Testing Text Generation (${TEXT_MODEL})...`);
    try {
        const textUrl = `${BASE_URL}/v1beta/models/${TEXT_MODEL}:generateContent?key=${API_KEY}`;
        const textRes = await fetch(textUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Write one short line of DJ hype for HitFM." }] }]
            })
        });

        if (!textRes.ok) {
            const err = await textRes.text();
            console.error(`❌ Text Test Failed (${textRes.status}):`, err);
        } else {
            const data = await textRes.json();
            const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (responseText) {
                console.log('✅ Text Generation Successful!');
                console.log(`- Output: "${responseText.trim()}"`);
            } else {
                console.error('❌ Success status but no text content in response.');
                console.log('Full Response:', JSON.stringify(data, null, 2));
            }
        }
    } catch (e) {
        console.error('❌ Text Test Error:', e.message);
    }

    // --- TEST 2: Audio Modality / TTS (using TTS_MODEL) ---
    console.log(`\n[Test 2] Testing TTS Audio Modality (${TTS_MODEL})...`);
    try {
        const audioUrl = `${BASE_URL}/v1beta/models/${TTS_MODEL}:generateContent?key=${API_KEY}`;
        const audioRes = await fetch(audioUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Keep it 100 on HitFM." }] }],
                generationConfig: {
                    responseModalities: ["AUDIO"],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: "Puck" }
                        }
                    }
                }
            })
        });

        if (!audioRes.ok) {
            const err = await audioRes.text();
            console.error(`❌ TTS Test Failed (${audioRes.status}):`, err);
        } else {
            const data = await audioRes.json();
            const parts = data.candidates?.[0]?.content?.parts;

            // Look for the part that has inlineData (audio)
            const audioPart = parts?.find(p => p.inlineData && p.inlineData.data);

            if (audioPart) {
                console.log('✅ TTS Audio Modality Successful!');
                console.log(`- Received Audio Buffer (Base64 Size: ${audioPart.inlineData.data.length} chars)`);
            } else {
                console.warn('⚠️  Response received but no Audio Data found.');
                console.log('This usually means the provider supports the model but not the "AUDIO" modality yet.');
                console.log('Response Content:', JSON.stringify(data, null, 2));
            }
        }
    } catch (e) {
        console.error('❌ TTS Test Error:', e.message);
    }

    console.log('\n--- Test Complete ---');
}

runTest();
