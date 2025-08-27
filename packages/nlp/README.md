# @tpa/nlp

This package contains the natural language processing logic for The Planner's Assistant.

## Embedder

The `Embedder` class is used to generate embeddings for text.

## Reranker

The `Reranker` class is used to rerank documents based on a query.

## Usage

```javascript
import Embedder from '@tpa/nlp/src/index.js';
import Reranker from '@tpa/nlp/src/reranker.js';

const embedder = new Embedder();
const embedding = await embedder.embed(text);

const reranker = new Reranker();
const rerankedDocuments = await reranker.rerank(query, documents);
```
