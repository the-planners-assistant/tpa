import React, { useState } from 'react';
import jsPDF from 'jspdf';

const ExportButton = ({ content, fileName, onExport }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(null);

  const handleExport = async (type) => {
    setIsExporting(true);
    setExportSuccess(null);
    
    try {
      if (type === 'markdown') {
        const element = document.createElement("a");
        const file = new Blob([content], {type: 'text/plain'});
        element.href = URL.createObjectURL(file);
        element.download = `${fileName}.md`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        URL.revokeObjectURL(element.href);
      } else if (type === 'pdf') {
        const doc = new jsPDF();
        // Better text wrapping for PDF
        const splitText = doc.splitTextToSize(content, 180);
        doc.text(splitText, 15, 15);
        doc.save(`${fileName}.pdf`);
      }
      
      setExportSuccess(type);
      onExport?.(type);
      
      // Clear success message after 3 seconds
      setTimeout(() => setExportSuccess(null), 3000);
    } catch (error) {
      console.error('Export failed:', error);
      setExportSuccess('error');
      setTimeout(() => setExportSuccess(null), 3000);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <button 
          onClick={() => handleExport('markdown')}
          disabled={isExporting || !content}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
        >
          {isExporting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Exporting...</span>
            </>
          ) : (
            <>
              <span>📄</span>
              <span>Export Markdown</span>
            </>
          )}
        </button>
        
        <button 
          onClick={() => handleExport('pdf')}
          disabled={isExporting || !content}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
        >
          {isExporting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Exporting...</span>
            </>
          ) : (
            <>
              <span>📑</span>
              <span>Export PDF</span>
            </>
          )}
        </button>
      </div>
      
      {/* Success/Error Messages */}
      {exportSuccess && (
        <div className={`text-sm px-3 py-2 rounded-lg ${
          exportSuccess === 'error' 
            ? 'bg-red-100 text-red-700 border border-red-200'
            : 'bg-green-100 text-green-700 border border-green-200'
        }`}>
          {exportSuccess === 'error' 
            ? 'Export failed. Please try again.'
            : `Successfully exported as ${exportSuccess.toUpperCase()}`
          }
        </div>
      )}
    </div>
  );
};

export default ExportButton;