import React from 'react';
import jsPDF from 'jspdf';

const ExportButton = ({ content, fileName }) => {
  const downloadTxtFile = () => {
    const element = document.createElement("a");
    const file = new Blob([content], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `${fileName}.md`;
    document.body.appendChild(element); // Required for this to work in FireFox
    element.click();
  }

  const downloadPdfFile = () => {
    const doc = new jsPDF();
    doc.text(content, 10, 10);
    doc.save(`${fileName}.pdf`);
  }

  return (
    <div className="flex space-x-4">
      <button onClick={downloadTxtFile} className="bg-accent text-white font-bold py-2 px-4 rounded">
        Export as Markdown
      </button>
      <button onClick={downloadPdfFile} className="bg-accent text-white font-bold py-2 px-4 rounded">
        Export as PDF
      </button>
    </div>
  );
};

export default ExportButton;