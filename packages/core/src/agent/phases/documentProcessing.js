export async function processDocumentsPhase(agent, documentFiles, assessment) {
  const isStructured = !Array.isArray(documentFiles) && typeof documentFiles === 'object';
  const flatList = isStructured ? [...(documentFiles.application||[]).map(f=>({file:f, role:'application'})), ...(documentFiles.policy||[]).map(f=>({file:f, role:'policy'}))] : (documentFiles||[]).map(f=>({file:f, role:'unknown'}));
  const results = {
    processed: [],
    totalDocuments: flatList.length,
    extractedData: {},
    images: [],
    chunks: [],
    addresses: [],
    planningRefs: [],
    roleSummary: { application: 0, policy: 0, unknown: 0 }
  };
  for (let i = 0; i < flatList.length; i++) {
    const { file, role } = flatList[i];
    try {
      agent.addTimelineEvent(assessment, 'document_processing', `Processing document: ${file.name}`);
      let dataBuffer = null;
      if (file instanceof ArrayBuffer) dataBuffer = file; else if (file.buffer instanceof ArrayBuffer) dataBuffer = file.buffer; else if (file.data instanceof ArrayBuffer) dataBuffer = file.data; else if (typeof file.arrayBuffer === 'function') dataBuffer = await file.arrayBuffer(); else throw new Error('Unsupported document input format');
      let parseResult;
      try {
  parseResult = await agent.parser.parse(dataBuffer, { enableOCR: !!(assessment?.options?.enableOCR) });
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
      // --- Normalise extractedData so downstream phases always have fullText & addresses ---
      if (!parseResult.extractedData) parseResult.extractedData = {};
      // Populate fullText (expected by address resolution phase) if absent
      if (!parseResult.extractedData.fullText && parseResult.text) {
        parseResult.extractedData.fullText = parseResult.text;
      }
      // Ensure addresses array available inside extractedData for consistency
      if (!parseResult.extractedData.addresses && Array.isArray(parseResult.addresses)) {
        parseResult.extractedData.addresses = parseResult.addresses;
      }
      // Embed chunks once (avoid duplicate push) - PARALLEL PROCESSING
  if (parseResult.chunks && parseResult.chunks.length && !parseResult.__embedded) {
        const embeddingPromises = parseResult.chunks.map(async (chunk, index) => {
          try {
            if (!chunk.embedding) {
              chunk.embedding = await agent.embedder.embed(chunk.content.slice(0, 5000));
            }
    return { content: chunk.content, embedding: chunk.embedding, metadata: { ...(chunk.metadata||{}), role: role } };
          } catch (embErr) {
            console.warn(`Embedding failed for chunk ${chunk.id || index}:`, embErr.message);
    return { content: chunk.content, embedding: null, metadata: { ...(chunk.metadata||{}), role: role } };
          }
        });
        
        // Process all embeddings in parallel
        const embeddedChunks = await Promise.all(embeddingPromises);
        const good = embeddedChunks.filter(chunk => chunk.embedding !== null);
        results.chunks.push(...good);
        // Populate role-specific vector stores (in-memory + persistent dual DB tables)
        if (!agent.vectorStore) agent.vectorStore = [];
        agent.vectorStore.push(...good.map(c=>({ text: c.content, embedding: c.embedding, metadata: c.metadata })));
        if (role === 'application') {
          agent.vectorStoreApplication.push(...good.map(c=>({ text: c.content, embedding: c.embedding, metadata: c.metadata })));
          // Persist to applicant vector table if available
          if (agent.database && typeof agent.database.addApplicantVectors === 'function') {
            agent.database.addApplicantVectors(good).catch(e=>console.warn('Persist applicant vectors failed', e.message));
          }
        } else if (role === 'policy') {
          agent.vectorStorePolicy.push(...good.map(c=>({ text: c.content, embedding: c.embedding, metadata: c.metadata })));
          if (agent.database && typeof agent.database.addGovernmentVectors === 'function') {
            agent.database.addGovernmentVectors(good).catch(e=>console.warn('Persist government vectors failed', e.message));
          }
        }
        parseResult.__embedded = true;
      }
      results.processed.push({ filename: file.name, role, type: parseResult.documentType, status: 'success', extractedData: parseResult.extractedData, imageCount: parseResult.images?.length || 0, chunkCount: parseResult.chunks?.length || 0 });
      results.roleSummary[role] = (results.roleSummary[role]||0)+1;
      if (parseResult.extractedData) results.extractedData = agent.mergeExtractedData(results.extractedData, parseResult.extractedData);
      if (parseResult.images) results.images.push(...parseResult.images);
      // (Avoid pushing parseResult.chunks again — already added above with embeddings)
      if (parseResult.addresses) results.addresses.push(...parseResult.addresses);
      if (parseResult.planningApplicationRefs) results.planningRefs.push(...parseResult.planningApplicationRefs);
    } catch (error) {
      console.error(`Failed to process document ${file.name}:`, error);
      results.processed.push({ filename: file.name, role, status: 'error', error: error.message });
    }
  }
  return results;
}
