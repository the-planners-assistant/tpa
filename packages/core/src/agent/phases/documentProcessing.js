export async function processDocumentsPhase(agent, documentFiles, assessment) {
  const results = {
    processed: [],
    totalDocuments: documentFiles.length,
    extractedData: {},
    images: [],
    chunks: [],
    addresses: [],
    planningRefs: []
  };
  for (let i = 0; i < documentFiles.length; i++) {
    const file = documentFiles[i];
    try {
      agent.addTimelineEvent(assessment, 'document_processing', `Processing document: ${file.name}`);
      let dataBuffer = null;
      if (file instanceof ArrayBuffer) dataBuffer = file; else if (file.buffer instanceof ArrayBuffer) dataBuffer = file.buffer; else if (file.data instanceof ArrayBuffer) dataBuffer = file.data; else if (typeof file.arrayBuffer === 'function') dataBuffer = await file.arrayBuffer(); else throw new Error('Unsupported document input format');
      let parseResult;
      try {
        parseResult = await agent.parser.parse(dataBuffer);
      } catch (parseErr) {
        const msg = String(parseErr && parseErr.message || parseErr);
        if (/Invalid PDF structure/i.test(msg)) {
          console.warn(`Invalid PDF structure for ${file.name}; using plain text fallback`);
          try {
            const text = agent.parser.decodeAsText(new Uint8Array(dataBuffer));
            parseResult = agent.parser.buildPlainTextResult(text, { pseudo: true });
          } catch (fallbackErr) {
            throw parseErr; // rethrow original if fallback fails
          }
        } else {
          throw parseErr;
        }
      }
      // Derive chunks if parser did not emit them
      if ((!parseResult.chunks || !parseResult.chunks.length) && parseResult.text) {
        const rawChunks = agent.parser.chunk(parseResult.text, 1800, 250);
        parseResult.chunks = rawChunks.map((c, idx) => ({ id: `${file.name}-chunk-${idx}`, content: c, metadata: { source: file.name, index: idx } }));
      }
      // Embed chunks once (avoid duplicate push) - PARALLEL PROCESSING
      if (parseResult.chunks && parseResult.chunks.length && !parseResult.__embedded) {
        const embeddingPromises = parseResult.chunks.map(async (chunk, index) => {
          try {
            if (!chunk.embedding) {
              chunk.embedding = await agent.embedder.embed(chunk.content.slice(0, 5000));
            }
            return { content: chunk.content, embedding: chunk.embedding, metadata: chunk.metadata };
          } catch (embErr) {
            console.warn(`Embedding failed for chunk ${chunk.id || index}:`, embErr.message);
            return { content: chunk.content, embedding: null, metadata: chunk.metadata };
          }
        });
        
        // Process all embeddings in parallel
        const embeddedChunks = await Promise.all(embeddingPromises);
        results.chunks.push(...embeddedChunks.filter(chunk => chunk.embedding !== null));
        parseResult.__embedded = true;
      }
      results.processed.push({ filename: file.name, type: parseResult.documentType, status: 'success', extractedData: parseResult.extractedData, imageCount: parseResult.images?.length || 0, chunkCount: parseResult.chunks?.length || 0 });
      if (parseResult.extractedData) results.extractedData = agent.mergeExtractedData(results.extractedData, parseResult.extractedData);
      if (parseResult.images) results.images.push(...parseResult.images);
      // (Avoid pushing parseResult.chunks again — already added above with embeddings)
      if (parseResult.addresses) results.addresses.push(...parseResult.addresses);
      if (parseResult.planningApplicationRefs) results.planningRefs.push(...parseResult.planningApplicationRefs);
    } catch (error) {
      console.error(`Failed to process document ${file.name}:`, error);
      results.processed.push({ filename: file.name, status: 'error', error: error.message });
    }
  }
  return results;
}
