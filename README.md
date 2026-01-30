# HitFM - AI-Powered Infinite Radio 📻🤖🎵

HitFM is a next-generation web radio station powered by **Google Gemini 2.0**. It features an autonomous AI DJ that curates music, generates context-aware commentary, and mixes tracks seamlessly with a visualizer.

<div align="center">
  <img src="https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=1000&auto=format&fit=crop" width="800" alt="HitFM Visualizer" />
</div>

## ✨ Key Features

-   **🤖 Context-Aware AI DJ**: 
    -   Powered by `gemini-2.5-flash` for script generation.
    -   Utilizes **Gemini 2.5 Flash TTS** for realistic voice synthesis.
    -   Dynamic personas (e.g., "Gali" the energetic host).
    -   Reacts to time of day, song mood, and listener requests.
-   **🎧 Hybrid Audio Engine**:
    -   **Piped API Integration**: Scrapes high-quality audio streams from YouTube to enable real-time **Web Audio API** processing.
    -   **Reliable Fallback**: Automatically downgrades to YouTube IFrame Embed if direct streaming fails, ensuring the music never stops.
    -   **Smart Ducking**: Automatically lowers music volume when the DJ speaks and restores it afterwards.
-   **📊 Real-Time Visualizer**:
    -   Live FFT spectrum analysis enabled by the native audio pipeline.
    -   Reacts to the beat and frequency of the music.
-   **🛡️ Robust Architecture**:
    -   Multi-instance failover for audio streaming.
    -   Advanced sanitization preventing AI hallucinations or "thinking" output from leaking into the broadcast.

## 🛠️ Tech Stack

-   **Frontend**: React 18, TypeScript, Vite
-   **AI Core**: Google Gemini 2.5 (Scripting + TTS)
-   **Audio**: Web Audio API, Piped API, YouTube IFrame API
-   **Styling**: Vanilla CSS / Tailwind (System dependent)

## 🚀 Getting Started

### Prerequisites

-   Node.js (v18+)
-   A Google Gemini API Key

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/Galigeege/HitFM.git
    cd HitFM
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Configure Environment**:
    Copy the example environment file and add your API keys.
    ```bash
    cp .env.example .env
    ```
    Edit `.env` and populate:
    ```env
    GEMINI_API_KEY=your_gemini_key_here
    GEMINI_BASE_URL=https://yunwu.ai  # Or your preferred gateway
    GEMINI_MODEL=gemini-2.5-flash
    GEMINI_TTS_MODEL=gemini-2.5-flash-preview-tts
    ```

4.  **Run Locally**:
    ```bash
    npm run dev
    ```

## 🧠 How It Works

1.  **Selection**: The system selects the next trending song (via Gemini search or predefined playlist).
2.  **Scripting**: Gemini generates a short, engaging intro/outro based on the song metadata and current time.
3.  **Synthesis**: The script is converted to audio using Gemini's TTS model.
4.  **Mixing**:
    -   The audio engine attempts to fetch a direct audio stream via **Piped**.
    -   If successful, it plays via `AudioContext`, driving the visualizer.
    -   If failed (403/Timeout), it seamlessly switches to the YouTube Embed player.
    -   The DJ audio is overlaid with auto-ducking logic.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT

---
*Built with ❤️ by the HitFM Team*
