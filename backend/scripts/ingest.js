require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pinecone } = require('@pinecone-database/pinecone');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize clients
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

const INDEX_NAME = 'mental-health-rag';
const EMBEDDING_MODEL = 'gemini-embedding-001';
const DATA_DIR = path.join(__dirname, '../data');
const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

// ─── Text Extraction ───────────────────────────────────────────
function extractText(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

// ─── Chunking (splits on ## TECHNIQUE boundaries) ──────────────
function chunkByTechnique(text) {
  const sections = text.split(/(?=## TECHNIQUE:)/);
  const chunks = [];
  for (const section of sections) {
    const trimmed = section.trim();
    if (trimmed.length > 50) {
      chunks.push(trimmed);
    }
  }
  return chunks;
}

// ─── Embedding ──────────────────────────────────────────────────
async function getEmbedding(text) {
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

// ─── Ensure Pinecone Index Exists ───────────────────────────────
async function ensureIndexExists() {
  const existing = (await pc.listIndexes()).indexes || [];
  if (!existing.some(idx => idx.name === INDEX_NAME)) {
    console.log(`Creating Pinecone index "${INDEX_NAME}"...`);
    await pc.createIndex({
      name: INDEX_NAME,
      dimension: 3072,
      metric: 'cosine',
      spec: { serverless: { cloud: 'aws', region: 'us-east-1' } },
    });
    console.log('Waiting 60s for index to initialize...');
    await new Promise(r => setTimeout(r, 60000));
  } else {
    console.log(`Index "${INDEX_NAME}" already exists.`);
  }
}

// ─── Main Ingestion ─────────────────────────────────────────────
async function ingest() {
  console.log('=== RAG Ingestion Started ===\n');

  if (!fs.existsSync(DATA_DIR)) {
    console.error(`Data directory not found: ${DATA_DIR}`);
    return;
  }

  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.txt'));
  if (files.length === 0) {
    console.log('No .txt files found in data/');
    return;
  }

  await ensureIndexExists();
  const index = pc.Index(INDEX_NAME);

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    console.log(`\nProcessing: ${file}`);

    const text = extractText(filePath);
    console.log(`  Extracted ${text.length} characters`);

    const chunks = chunkByTechnique(text);
    console.log(`  Split into ${chunks.length} technique chunks`);

    // Embed and upsert one at a time to avoid rate limits
    for (let i = 0; i < chunks.length; i++) {
      try {
        const embedding = await getEmbedding(chunks[i]);
        const record = {
          id: `${file.replace('.txt', '')}-${i}`,
          values: embedding,
          metadata: {
            text: chunks[i],
            source: file,
            chunkIndex: i,
          },
        };

        // Pinecone SDK v7 expects { records: [...] }
        await index.upsert({ records: [record] });
        console.log(`  ✓ Upserted chunk ${i + 1}/${chunks.length}`);
      } catch (err) {
        console.error(`  ✗ Failed chunk ${i}: ${err.message}`);
      }
    }
  }

  console.log('\n=== Ingestion Complete ===');
}

ingest().catch(console.error);
