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
      const parseResult = await agent.parser.parse(dataBuffer);
      results.processed.push({ filename: file.name, type: parseResult.documentType, status: 'success', extractedData: parseResult.extractedData, imageCount: parseResult.images?.length || 0, chunkCount: parseResult.chunks?.length || 0 });
      if (parseResult.extractedData) results.extractedData = agent.mergeExtractedData(results.extractedData, parseResult.extractedData);
      if (parseResult.images) results.images.push(...parseResult.images);
      if (parseResult.chunks) results.chunks.push(...parseResult.chunks);
      if (parseResult.addresses) results.addresses.push(...parseResult.addresses);
      if (parseResult.planningApplicationRefs) results.planningRefs.push(...parseResult.planningApplicationRefs);
    } catch (error) {
      console.error(`Failed to process document ${file.name}:`, error);
      results.processed.push({ filename: file.name, status: 'error', error: error.message });
    }
  }
  return results;
}
