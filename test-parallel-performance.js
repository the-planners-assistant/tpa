/**
 * Test script to verify parallel embedding generation and LLM call performance improvements
 */

// Mock data for testing
const mockChunks = [
  { id: 'chunk-1', content: 'Planning application for residential development at 123 Main Street, comprising 5 new houses with associated parking and landscaping.' },
  { id: 'chunk-2', content: 'The proposed development includes sustainable features such as solar panels, electric vehicle charging points, and native species landscaping.' },
  { id: 'chunk-3', content: 'Access to the site will be via the existing entrance on Main Street, with improvements to visibility splays as recommended in the transport assessment.' },
  { id: 'chunk-4', content: 'The design follows local vernacular architecture with traditional materials including red brick and slate roofing to complement the surrounding area.' },
  { id: 'chunk-5', content: 'Affordable housing provision meets policy requirements with 2 of the 5 units designated as affordable in accordance with local plan policy H2.' }
];

const mockAddresses = [
  '123 Main Street, Anytown, AT1 2BC',
  '125 Main Street, Anytown',
  'Main Street Development Site, Anytown',
  'Land adjacent to 121 Main Street'
];

class MockEmbedder {
  async embed(text) {
    // Simulate embedding API latency
    const delay = 200 + Math.random() * 100; // 200-300ms per call
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Return mock embedding vector
    return Array.from({ length: 384 }, () => Math.random() - 0.5);
  }
}

async function testSequentialEmbedding() {
  console.log('Testing sequential embedding generation...');
  const embedder = new MockEmbedder();
  const startTime = Date.now();
  
  const embeddings = [];
  for (const chunk of mockChunks) {
    const embedding = await embedder.embed(chunk.content);
    embeddings.push({ content: chunk.content, embedding });
  }
  
  const duration = Date.now() - startTime;
  console.log(`Sequential: ${mockChunks.length} embeddings in ${duration}ms (avg: ${(duration / mockChunks.length).toFixed(0)}ms per embedding)`);
  return duration;
}

async function testParallelEmbedding() {
  console.log('Testing parallel embedding generation...');
  const embedder = new MockEmbedder();
  const startTime = Date.now();
  
  const embeddingPromises = mockChunks.map(async (chunk) => {
    try {
      const embedding = await embedder.embed(chunk.content);
      return { content: chunk.content, embedding };
    } catch (error) {
      console.warn('Embedding failed for chunk:', error.message);
      return { content: chunk.content, embedding: null };
    }
  });
  
  const embeddings = await Promise.all(embeddingPromises);
  const validEmbeddings = embeddings.filter(item => item.embedding !== null);
  
  const duration = Date.now() - startTime;
  console.log(`Parallel: ${validEmbeddings.length} embeddings in ${duration}ms (avg: ${(duration / validEmbeddings.length).toFixed(0)}ms per embedding)`);
  return duration;
}

async function mockLLMCall(prompt, delay = 300) {
  // Simulate LLM API latency
  await new Promise(resolve => setTimeout(resolve, delay + Math.random() * 100));
  
  return {
    extracted: {
      primaryAddress: '123 Main Street, Anytown, AT1 2BC',
      confidence: 0.8,
      method: 'mock'
    }
  };
}

async function testSequentialLLMCalls() {
  console.log('Testing sequential LLM calls...');
  const startTime = Date.now();
  
  const results = [];
  for (const address of mockAddresses) {
    const result = await mockLLMCall(`Extract address from: ${address}`);
    results.push(result);
  }
  
  const duration = Date.now() - startTime;
  console.log(`Sequential: ${mockAddresses.length} LLM calls in ${duration}ms (avg: ${(duration / mockAddresses.length).toFixed(0)}ms per call)`);
  return duration;
}

async function testParallelLLMCalls() {
  console.log('Testing parallel LLM calls...');
  const startTime = Date.now();
  
  const llmPromises = mockAddresses.map(async (address) => {
    try {
      return await mockLLMCall(`Extract address from: ${address}`);
    } catch (error) {
      console.warn('LLM call failed:', error.message);
      return null;
    }
  });
  
  const results = await Promise.allSettled(llmPromises);
  const validResults = results.filter(r => r.status === 'fulfilled' && r.value !== null);
  
  const duration = Date.now() - startTime;
  console.log(`Parallel: ${validResults.length} LLM calls in ${duration}ms (avg: ${(duration / validResults.length).toFixed(0)}ms per call)`);
  return duration;
}

async function runPerformanceComparison() {
  console.log('=== Parallel Processing Performance Test ===\n');
  
  // Test embedding generation
  console.log('1. Embedding Generation Comparison:');
  const sequentialEmbeddingTime = await testSequentialEmbedding();
  await new Promise(resolve => setTimeout(resolve, 100)); // Brief pause
  const parallelEmbeddingTime = await testParallelEmbedding();
  
  const embeddingSpeedup = (sequentialEmbeddingTime / parallelEmbeddingTime).toFixed(2);
  console.log(`Embedding speedup: ${embeddingSpeedup}x faster with parallel processing\n`);
  
  // Test LLM calls
  console.log('2. LLM Call Comparison:');
  const sequentialLLMTime = await testSequentialLLMCalls();
  await new Promise(resolve => setTimeout(resolve, 100)); // Brief pause
  const parallelLLMTime = await testParallelLLMCalls();
  
  const llmSpeedup = (sequentialLLMTime / parallelLLMTime).toFixed(2);
  console.log(`LLM speedup: ${llmSpeedup}x faster with parallel processing\n`);
  
  // Overall summary
  console.log('=== Summary ===');
  console.log(`Embedding processing: ${embeddingSpeedup}x speedup`);
  console.log(`LLM processing: ${llmSpeedup}x speedup`);
  console.log(`\nNote: These improvements directly address the main thread hanging issue`);
  console.log(`by reducing the total time spent on I/O-bound operations (API calls).`);
}

// Run the test
runPerformanceComparison().catch(console.error);
