import { pipeline } from '@xenova/transformers';

class Reranker {
  static instance = null;

  static async getInstance() {
    if (this.instance === null) {
      this.instance = pipeline('zero-shot-classification', 'Xenova/nli-deberta-v3-base');
    }
    return this.instance;
  }

  async rerank(query, documents) {
    const classifier = await Reranker.getInstance();
    const results = await classifier(documents, { hypothesis_template: 'This document is about {}', multi_label: true, hypothesis_template_string: query });
    
    const sortedResults = results.sort((a, b) => b.scores[0] - a.scores[0]);
    return sortedResults.map(result => result.sequence);
  }
}

export default Reranker;
