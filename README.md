# HitFM - AI-Powered Infinite Radio 📻🤖🎵

HitFM is a next-generation web radio station powered by **Google Gemini 2.5** and **SUNO AI**. It generates **original music on-the-fly**, features an autonomous AI DJ with voice synthesis, and mixes tracks seamlessly with a real-time visualizer.

<div align="center">
  <img src="https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=1000&auto=format&fit=crop" width="800" alt="HitFM Visualizer" />
</div>

## ✨ Key Features

-   **🎵 AI-Generated Original Music**:
    -   **SUNO Integration**: Creates unique, copyright-free tracks in seconds.
    -   **Gemini Lyrics**: Uses Gemini to write structured song lyrics ([Verse], [Chorus], [Bridge]).
    -   Supports multiple genres: Pop, Electronic, R&B, Indie, Dance.
-   **🤖 Context-Aware AI DJ**: 
    -   Powered by `gemini-2.5-flash` for script generation.
    -   **Gemini TTS** for realistic voice synthesis.
    -   Dynamic personas and mood-aware commentary.
-   **🎧 Web Audio Engine**:
    -   Real-time visualization via FFT spectrum analysis.
    -   Smart ducking during DJ transitions.
    -   Fallback to YouTube/SoundCloud for demo tracks.
-   **📊 Real-Time Visualizer**:
    -   Live frequency response reacting to the beat.

## 🛠️ Tech Stack

-   **Frontend**: React 18, TypeScript, Vite
-   **AI Core**: Google Gemini 2.5 (Scripting + TTS), SUNO (Music Gen)
-   **Audio**: Web Audio API

## 🚀 Getting Started

### Prerequisites

-   Node.js (v18+)
-   A YunWu AI API Key (or Gemini API Key)

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
    ```bash
    cp .env.example .env
    ```
    Edit `.env` and add your API key:
    ```env
    GEMINI_API_KEY=your_key_here
    GEMINI_BASE_URL=https://yunwu.ai
    GEMINI_MODEL=gemini-2.5-flash
    GEMINI_TTS_MODEL=gemini-2.5-flash-preview-tts
    ```

4.  **Run Locally**:
    ```bash
    npm run dev
    ```

## 🧠 How It Works

1.  **Lyrics**: Gemini writes original song lyrics with genre/mood.
2.  **Music**: SUNO generates a full audio track (~30-90s generation time).
3.  **DJ**: Gemini scripts an introduction, synthesized via TTS.
4.  **Playback**: Audio plays through Web Audio API with visualizer.

## 📝 Notes

-   Each song generation consumes API credits.
-   Generation time is approximately 30-90 seconds per track.
-   The app includes fallback to a static playlist if generation fails.

## 🤝 Contributing

Contributions are welcome! Please open a Pull Request.

## 📄 License

MIT

---
*Built with ❤️ by the HitFM Team*
