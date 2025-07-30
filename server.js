const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const http = require('http');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());
// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('./frontend'));

// Root route fallback
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// WebSocket server for handling real-time communication
const wss = new WebSocket.Server({ server });

// Store active connections
const clients = new Map();

// Gemini Live API integration
class GeminiLiveSession {
  constructor(clientId) {
    this.clientId = clientId;
    this.sessionId = null;
    this.websocket = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      // Verify API key exists
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY not found in environment variables');
      }
      
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${process.env.GEMINI_API_KEY}`;
      
      console.log('Connecting to Gemini with API key:', process.env.GEMINI_API_KEY.substring(0, 10) + '...');
      
      this.websocket = new WebSocket(wsUrl);
      
      this.websocket.on('open', () => {
        console.log('Connected to Gemini Live API');
        this.isConnected = true;
        this.initializeSession();
      });

      this.websocket.on('message', (data) => {
        console.log('Received from Gemini:', data.toString().substring(0, 200) + '...');
        this.handleGeminiResponse(data);
      });

      this.websocket.on('error', (error) => {
        console.error('Gemini WebSocket error:', error.message);
        this.handleError(error);
      });

      this.websocket.on('close', (code, reason) => {
        console.log(`Gemini WebSocket closed. Code: ${code}, Reason: ${reason}`);
        this.isConnected = false;
        
        // Send close reason to client
        const client = clients.get(this.clientId);
        if (client && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'gemini_disconnected',
            code: code,
            reason: reason.toString()
          }));
        }
      });

    } catch (error) {
      console.error('Failed to connect to Gemini:', error);
      throw error;
    }
  }

  initializeSession() {
    const setupMessage = {
      setup: {
        model: "models/gemini-2.0-flash-live-001", // Using model with higher rate limits for testing
        generation_config: {
          response_modalities: ["AUDIO"],
          speech_config: {
            voice_config: {
              prebuilt_voice_config: {
                voice_name: "Aoede"
              }
            }
          }
        },
        system_instruction: {
          parts: [{
            text: `You are Rev, the voice assistant for Revolt Motors. Revolt Motors is India's #1 electric motorcycle company. 

Key information about Revolt Motors:
- Leading electric motorcycle manufacturer in India
- Offers premium electric bikes with impressive range and performance
- Focus on eco-friendly transportation solutions
- Models include RV400 and RV300 series
- Features like swappable batteries, mobile app connectivity
- Available across major Indian cities

Your personality:
- Enthusiastic about electric vehicles and sustainability
- Knowledgeable about Revolt Motors products
- Professional yet friendly tone
- Quick and concise responses
- Always redirect conversations back to Revolt Motors when appropriate

Guidelines:
- Only discuss topics related to Revolt Motors, electric vehicles, or sustainable transportation
- If asked about unrelated topics, politely redirect to Revolt Motors
- Provide accurate information about products, features, and availability
- Encourage potential customers to book test rides or visit showrooms
- Keep responses conversational and under 30 seconds when spoken`
          }]
        }
      }
    };

    this.websocket.send(JSON.stringify(setupMessage));
  }

  sendAudioData(audioData) {
    if (!this.isConnected) return;

    const message = {
      realtime_input: {
        media_chunks: [{
          mime_type: "audio/pcm",
          data: audioData
        }]
      }
    };

    this.websocket.send(JSON.stringify(message));
  }

  handleGeminiResponse(data) {
    try {
      const response = JSON.parse(data);
      
      // Forward audio response to client
      const client = clients.get(this.clientId);
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'gemini_response',
          data: response
        }));
      }
    } catch (error) {
      console.error('Error parsing Gemini response:', error);
    }
  }

  handleError(error) {
    const client = clients.get(this.clientId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'error',
        message: 'Connection error with AI service'
      }));
    }
  }

  disconnect() {
    if (this.websocket) {
      this.websocket.close();
    }
  }
}

// Handle WebSocket connections from frontend
wss.on('connection', (ws, req) => {
  const clientId = Date.now().toString();
  clients.set(clientId, ws);
  
  console.log(`Client connected: ${clientId}`);

  let geminiSession = null;

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case 'start_session':
          geminiSession = new GeminiLiveSession(clientId);
          await geminiSession.connect();
          ws.send(JSON.stringify({ type: 'session_started' }));
          break;

        case 'audio_data':
          if (geminiSession) {
            geminiSession.sendAudioData(data.audioData);
          }
          break;

        case 'end_session':
          if (geminiSession) {
            geminiSession.disconnect();
            geminiSession = null;
          }
          break;
      }
    } catch (error) {
      console.error('Error handling message:', error);
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Server error processing request' 
      }));
    }
  });

  ws.on('close', () => {
    console.log(`Client disconnected: ${clientId}`);
    clients.delete(clientId);
    
    if (geminiSession) {
      geminiSession.disconnect();
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready`);
});