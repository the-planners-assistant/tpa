# @tpa/ingest

This package contains the logic for ingesting and parsing documents.

## Parser

The `Parser` class is used to parse PDF files.

## Usage

```javascript
import Parser from '@tpa/ingest/src/index.js';

const parser = new Parser();
const text = await parser.parse(filePath);
const chunks = parser.chunk(text);
```
