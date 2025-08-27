import * as pdfjsLib from 'pdfjs-dist/build/pdf';

// Set the workerSrc to avoid issues with a missing worker.
// This is a common pattern for using pdf.js in a web application.
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

class Parser {
  async parse(dataBuffer) {
    const pdf = await pdfjsLib.getDocument({ data: dataBuffer }).promise;
    const numPages = pdf.numPages;
    let text = '';
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(item => item.str).join(' ');
    }
    return text;
  }

  chunk(text, chunkSize = 1000, overlap = 200) {
    const chunks = [];
    let i = 0;
    while (i < text.length) {
      const end = i + chunkSize;
      chunks.push(text.substring(i, end));
      i += chunkSize - overlap;
    }
    return chunks;
  }
}

export default Parser;
