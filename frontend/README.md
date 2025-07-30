# Revolt Voice Assistant

A real-time conversational voice assistant powered by Gemini Live API (e.g., `gemini-live-2.5-flash-preview`) to provide AI-driven voice interactions related to Revolt Motors.

## 🔧 Project Setup

### 1. Clone the Repository

git clone https://github.com/your-username/revolt-voice-assistant.git
cd revolt-voice-assistant
2. Install Dependencies
npm install
3. Create .env File
Create a .env file in the root directory and add the following:

.env

GOOGLE_API_KEY=your_google_api_key
GEMINI_MODEL=gemini-live-2.5-flash-preview
PORT=3000
⚠️ Replace your_google_api_key with your actual API key from Google Cloud Vertex AI.

4. Start the Server

node server.js
This will start the backend server on http://localhost:3000.

5. Test the Application
Make sure your frontend connects to the WebSocket server (ws://localhost:3000) and streams audio to Gemini.
