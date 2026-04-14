const mongoose = require("mongoose");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');
const Chat = require('../models/Chat');
const { searchTherapyContext } = require('./ragService');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Helper function to analyze sentiment
async function analyzeSentiment(text) {
    try {
        const sentimentPort = process.env.SENTIMENT_SERVICE_PORT || 5000;
        const response = await axios.post(`http://localhost:${sentimentPort}/analyze`, { text });
        return response.data;
    } catch (error) {
        console.error('Sentiment analysis error:', error.message);
        return { emotion: 'neutral', confidence: 0, needs_immediate_help: false };
    }
}

// Helper function to get Gemini response
async function getGeminiResponse(userMessage, emotion, confidence, ragContext = '') {
    try {

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // Customize prompt based on emotion and confidence
        let emotionContext = "";
        if (confidence > 0.8) {
            switch(emotion) {
                case "anxiety":
                    emotionContext = "They are showing strong signs of anxiety. Focus on calming techniques and reassurance.";
                    break;
                case "depression":
                    emotionContext = "They are showing significant signs of depression. Emphasize hope and gentle encouragement.";
                    break;
                case "stress":
                    emotionContext = "They are under considerable stress. Focus on stress management and self-care.";
                    break;
                case "suicidal":
                    emotionContext = "CRITICAL: They are showing concerning signs. Prioritize safety and immediate professional help.";
                    break;
                default:
                    emotionContext = `They are expressing ${emotion}.`;
            }
        }

        // Build RAG-enhanced prompt
        let ragSection = '';
        if (ragContext) {
            ragSection = `
--- VERIFIED THERAPY TECHNIQUES (from clinical guidelines) ---
${ragContext}
--- END OF VERIFIED TECHNIQUES ---

IMPORTANT: Base your therapeutic suggestions on the verified techniques provided above. Do NOT invent or fabricate clinical advice. Summarize the relevant technique in a warm, supportive way.
`;
        }

        const prompt = `You are a compassionate mental health assistant. ${emotionContext}
${ragSection}
Patient message: "${userMessage}"

Guidelines:
- Be warm, empathetic, and validating
- Keep responses concise (2-3 sentences)
- For anxiety: suggest grounding techniques from the verified sources above
- For depression: focus on small steps and hope using verified techniques
- For stress: recommend specific relaxation methods from verified sources
- For suicidal thoughts: emphasize immediate help and safety planning
- Always maintain a supportive, non-judgmental tone
- Include one practical, actionable suggestion based on the therapy techniques provided
- Mention professional help if needed
- Keep it concise but caring
- If the user asks anything other than related to mental health turn them down saying you are only a mental health assisstant.
- If suicidal, provide Indian suicide prevention helpline resources (Sneha: 044-24640050, iCall: 9152987821)

Response:`;


        const result = await model.generateContent(prompt);
        const response = await result.response;

        return response.text();
    } catch (error) {
        console.error('Gemini API error:', error.message);
        if (error.message.includes('API key')) {
            return "I apologize, but there seems to be an issue with the API configuration. Please contact support.";
        }
        return "I apologize, but I'm having trouble formulating a response. Please know that your feelings are valid and important. If you're in immediate distress, please reach out to a mental health professional or call the Sneha India Suicide Prevention Helpline at 044-24640050 (available 24/7, confidential, and free).";
    }
}

// ── Pipeline Configuration ───────────────────────────────────────────────
const PIPELINE_DELAY_MS = parseInt(process.env.PIPELINE_DELAY_MS) || 500;

// Utility to pause execution
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Chat controller functions
const sendMessage = async (req, res) => {
    try {
        const { message, sessionId } = req.body;
        const userId = req.user._id;

        if (!message || message.trim() === '') {
            return res.status(400).json({ error: 'Message cannot be empty' });
        }

        const pipelineStart = Date.now();

        // ── Step 1: BERT Sentiment Analysis ──────────────────────────────
        let sentimentResult = { emotion: 'neutral', confidence: 0, needs_immediate_help: false };
        const step1Start = Date.now();
        try {
            sentimentResult = await analyzeSentiment(message);
            console.log(`[PIPELINE] Step 1: BERT Sentiment → ${sentimentResult.emotion} (conf: ${sentimentResult.confidence.toFixed(2)})  (${Date.now() - step1Start}ms)`);
        } catch (sentErr) {
            console.error(`[PIPELINE] Step 1: BERT Sentiment FAILED (${Date.now() - step1Start}ms):`, sentErr.message);
            // Continue with neutral defaults
        }

        // ── Delay — breathing room between BERT model and RAG ────────────
        console.log(`[PIPELINE] Waiting ${PIPELINE_DELAY_MS}ms before RAG search...`);
        await delay(PIPELINE_DELAY_MS);

        // ── Step 2: RAG — Pinecone vector search for therapy context ─────
        let ragContext = '';
        const step2Start = Date.now();
        try {
            ragContext = await searchTherapyContext(message, sentimentResult.emotion);
            if (ragContext) {
                console.log(`[PIPELINE] Step 2: RAG search → Found relevant therapy context  (${Date.now() - step2Start}ms)`);
            } else {
                console.log(`[PIPELINE] Step 2: RAG search → No relevant context found  (${Date.now() - step2Start}ms)`);
            }
        } catch (ragErr) {
            console.error(`[PIPELINE] Step 2: RAG search FAILED (${Date.now() - step2Start}ms):`, ragErr.message);
            // Continue without RAG context
        }

        // ── Step 3: LLM Response Generation (Gemini) ─────────────────────
        const step3Start = Date.now();
        const aiResponse = await getGeminiResponse(
            message, 
            sentimentResult.emotion, 
            sentimentResult.confidence,
            ragContext
        );
        console.log(`[PIPELINE] Step 3: Gemini response generated  (${Date.now() - step3Start}ms)`);
        console.log(`[PIPELINE] Total pipeline time: ${Date.now() - pipelineStart}ms`);


        // Save to database
        const chatData = {
            user: userId,
            message: message,
            response: aiResponse,
            sentiment: sentimentResult.emotion,
            confidence: sentimentResult.confidence,
            needs_immediate_help: sentimentResult.needs_immediate_help
        };
        
        // Use provided sessionId or generate a new one
        if (sessionId) {
            chatData.sessionId = sessionId;
        }

        const chat = await Chat.create(chatData);

        res.status(200).json({
            message: chat.message,
            response: chat.response,
            sentiment: chat.sentiment,
            confidence: chat.confidence,
            needs_immediate_help: chat.needs_immediate_help,
            sessionId: chat.sessionId,
            timestamp: chat.createdAt
        });

    } catch (error) {
        console.error('Error in sendMessage:', error.message);
        console.error('Stack trace:', error.stack);
        res.status(500).json({ error: 'Failed to process message', details: error.message });
    }
};

const getChatHistory = async (req, res) => {
    try {
        const userId = req.user._id;
        const sessionId = req.query.sessionId;

        if (!sessionId) {
            return res.status(400).json({ error: 'sessionId is required to fetch history' });
        }

        const history = await Chat.find({ user: userId, sessionId: sessionId })
            .sort({ createdAt: 1 })
            .select('-__v');
        res.status(200).json(history);
    } catch (error) {
        console.error('Error in getChatHistory:', error);
        res.status(500).json({ error: 'Failed to get chat history' });
    }
};

const getChatSessions = async (req, res) => {
    try {
        const userId = req.user._id;

        // Aggregate unique sessionIds for this user, getting the earliest (first) message as the title
        const sessions = await Chat.aggregate([
            { $match: { user: new mongoose.Types.ObjectId(userId) } },
            { $sort: { createdAt: 1 } },
            { 
                $group: { 
                    _id: "$sessionId", 
                    firstMessage: { $first: "$message" },
                    createdAt: { $first: "$createdAt" },
                    updatedAt: { $last: "$createdAt" }
                } 
            },
            { $sort: { updatedAt: -1 } } // Sort sessions by most recently active
        ]);

        res.status(200).json(sessions);
    } catch (error) {
        console.error('Error in getChatSessions:', error);
        res.status(500).json({ error: 'Failed to get chat sessions' });
    }
};

module.exports = { connectDB, sendMessage, getChatHistory, getChatSessions };