/**
 * RAG Service — Retrieves relevant therapy techniques from Pinecone
 * using Gemini embedding model for query vectorization.
 * Includes timeout protection and retry logic for resilience.
 */
const { Pinecone } = require('@pinecone-database/pinecone');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const INDEX_NAME = 'mental-health-rag';
const EMBEDDING_MODEL = 'gemini-embedding-001';
const QUERY_TIMEOUT_MS = 10000; // 10 second timeout for Pinecone queries
const RETRY_DELAY_MS = 300;     // wait before retry
const MAX_RETRIES = 1;          // one retry attempt

let pcIndex = null;

function getPineconeIndex() {
  if (!pcIndex) {
    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    pcIndex = pc.Index(INDEX_NAME);
  }
  return pcIndex;
}

/**
 * Embed a text query using Gemini embedding model.
 */
async function embedQuery(text) {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

/**
 * Promise that rejects after a timeout.
 */
function withTimeout(promise, ms, label = 'Operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * Small delay utility for retry backoff.
 */
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Search the Pinecone vector store for therapy techniques
 * relevant to the user's message and detected emotion.
 *
 * @param {string} userMessage - The user's chat message
 * @param {string} emotion     - Detected emotion from BERT sentiment model
 * @returns {string}           - Concatenated relevant therapy text snippets
 */
async function searchTherapyContext(userMessage, emotion = '') {
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[RAG] Retry attempt ${attempt} after ${RETRY_DELAY_MS}ms...`);
        await wait(RETRY_DELAY_MS);
      }

      // Combine user message with emotion for a richer semantic query
      const queryText = emotion
        ? `${userMessage}. The user is experiencing ${emotion}.`
        : userMessage;

      const queryVector = await withTimeout(
        embedQuery(queryText),
        QUERY_TIMEOUT_MS,
        'Embedding'
      );

      const index = getPineconeIndex();

      const response = await withTimeout(
        index.query({
          vector: queryVector,
          topK: 3,
          includeMetadata: true,
        }),
        QUERY_TIMEOUT_MS,
        'Pinecone query'
      );

      if (response.matches && response.matches.length > 0) {
        const relevantChunks = response.matches
          .filter(m => m.score > 0.45) // include moderately similar results
          .map(m => m.metadata.text);

        if (relevantChunks.length > 0) {
          return relevantChunks.join('\n\n---\n\n');
        }
      }

      return '';
    } catch (err) {
      lastError = err;
      console.error(`[RAG] Attempt ${attempt + 1} failed:`, err.message);
    }
  }

  console.error('[RAG] All attempts exhausted:', lastError?.message);
  return '';
}

module.exports = { searchTherapyContext };
