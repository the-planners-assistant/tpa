import { pipeline } from '@xenova/transformers';

class Embedder {
  static instance = null;

  static async getInstance() {
    if (this.instance === null) {
      this.instance = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    return this.instance;
  }

  async embed(text) {
    const extractor = await Embedder.getInstance();
    const result = await extractor(text, { pooling: 'mean', normalize: true });
    return result.data;
  }
}

export default Embedder;
