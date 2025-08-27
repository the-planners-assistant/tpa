import { GoogleGenerativeAI } from '@google/genai';
import Embedder from '@tpa/nlp/src/index.js';
import Reranker from '@tpa/nlp/src/reranker.js';
import Parser from '@tpa/ingest/src/index.js';

class Agent {
  constructor(apiKey) {
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    } else {
      this.genAI = null;
    }
    this.embedder = new Embedder();
    this.reranker = new Reranker();
    this.parser = new Parser();
    this.vectorStore = []; // In-memory vector store
  }

  async run(query) {
    // 1. Break down the query into sub-tasks (for now, we'll just use the whole query)
    const subTask = query;

    // 2. Use tools to answer the sub-task
    // For now, we'll just search the vector store
    const searchResults = await this.searchVectorStore(subTask);

    // 3. Use Gemini API to generate a response or fallback to local model
    if (this.genAI) {
      const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash"});
      const prompt = `Based on the following information, answer the query: "${query}"\n\nInformation:\n${searchResults.join('\n')}`;
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } else {
      return `This is a locally generated response to the query: "${query}".\n\nI found the following relevant information:\n${searchResults.join('\n')}`;
    }
  }

  async searchVectorStore(query) {
    if (this.vectorStore.length === 0) {
      return [];
    }

    const queryEmbedding = await this.embedder.embed(query);

    const results = this.vectorStore.map(item => {
      const similarity = this.cosineSimilarity(queryEmbedding, item.embedding);
      return { ...item, similarity };
    });

    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, 5).map(item => item.text);
  }

  cosineSimilarity(vecA, vecB) {
    let dotProduct = 0.0;
    let normA = 0.0;
    let normB = 0.0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async loadPdf(file) {
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataBuffer = event.target.result;
      const text = await this.parser.parse(dataBuffer);
      const chunks = this.parser.chunk(text);
      for (const chunk of chunks) {
        const embedding = await this.embedder.embed(chunk);
        this.vectorStore.push({ text: chunk, embedding });
      }
    };
    reader.readAsArrayBuffer(file);
  }
}

export default Agent;
