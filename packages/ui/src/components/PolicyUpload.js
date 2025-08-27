import React, { useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, X, Eye, Download } from 'lucide-react';

const PolicyUpload = ({ 
  planId, 
  onUploadComplete, 
  onError,
  maxFiles = 10,
  maxSizePerFile = 50 * 1024 * 1024 // 50MB
}) => {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [parseResults, setParseResults] = useState({});
  const [dragActive, setDragActive] = useState(false);

  // File upload handlers
  const handleFileSelect = useCallback((selectedFiles) => {
    const newFiles = Array.from(selectedFiles).slice(0, maxFiles - files.length);
    
    // Validate files
    const validFiles = newFiles.filter(file => {
      if (file.size > maxSizePerFile) {
        onError?.(`File ${file.name} is too large (max ${maxSizePerFile / 1024 / 1024}MB)`);
        return false;
      }
      
      // Check file type by extension and MIME type
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      const validExtensions = ['pdf', 'docx', 'txt', 'html'];
      const validMimeTypes = [
        'application/pdf', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
        'text/plain', 
        'text/html'
      ];
      
      const hasValidExtension = validExtensions.includes(fileExtension);
      const hasValidMimeType = validMimeTypes.includes(file.type);
      
      if (!hasValidExtension && !hasValidMimeType) {
        onError?.(`File ${file.name} has unsupported format. Supported formats: PDF, Word (.docx), Text (.txt), HTML`);
        return false;
      }
      
      return true;
    });

    setFiles(prev => [...prev, ...validFiles.map(file => ({
      id: Date.now() + Math.random(),
      file,
      status: 'pending',
      name: file.name,
      size: file.size,
      type: file.type || `application/${file.name.split('.').pop()}`
    }))]);
  }, [files.length, maxFiles, maxSizePerFile, onError]);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files);
    }
  }, [handleFileSelect]);

  // Upload processing
  const processUpload = async () => {
    if (!planId || files.length === 0) return;

    setUploading(true);
    const results = {};

    try {
      // Import required modules
      const PolicyParser = (await import('@tpa/core/src/policy-parser.js')).default;
      const LocalPlanManager = (await import('@tpa/core/src/local-plan-manager.js')).default;
      const PolicyEngine = (await import('@tpa/core/src/policy-engine.js')).default;

      const parser = new PolicyParser();
      const planManager = new LocalPlanManager();
      const policyEngine = new PolicyEngine();

      for (const fileItem of files) {
        if (fileItem.status !== 'pending') continue;

        try {
          // Update progress
          setUploadProgress(prev => ({ ...prev, [fileItem.id]: 0.1 }));
          setFiles(prev => prev.map(f => 
            f.id === fileItem.id ? { ...f, status: 'processing' } : f
          ));

          // Read file
          const buffer = await fileItem.file.arrayBuffer();
          setUploadProgress(prev => ({ ...prev, [fileItem.id]: 0.3 }));

          // Parse document
          console.log(`Parsing ${fileItem.file.name} (${fileItem.file.type})`);
          const parseResult = await parser.parseDocument(
            buffer, 
            fileItem.file.name, 
            fileItem.file.type || `application/${fileItem.file.name.split('.').pop()}`
          );
          setUploadProgress(prev => ({ ...prev, [fileItem.id]: 0.6 }));

          // Validate policies
          const validation = parser.validatePolicies(parseResult.policies);
          parseResult.validation = validation;

          // Check if we got any meaningful content
          if (parseResult.policies.length === 0 && parseResult.metadata.wordCount < 50) {
            throw new Error('No policies found in document. The file may be empty, corrupted, or contain only images.');
          }

          // Add policies to local plan
          const addedPolicies = [];
          for (const policy of validation.valid) {
            try {
              const addedPolicy = await planManager.addPolicy(planId, {
                policyRef: policy.reference,
                title: policy.title,
                category: policy.category,
                content: policy.content,
                evidenceIds: [],
                parentPolicy: null
              });
              addedPolicies.push(addedPolicy);
            } catch (error) {
              console.warn(`Failed to add policy ${policy.reference}:`, error);
            }
          }

          setUploadProgress(prev => ({ ...prev, [fileItem.id]: 0.8 }));

          // Auto-link policies
          if (addedPolicies.length > 0) {
            try {
              await policyEngine.autoLinkPolicies(planId);
            } catch (error) {
              console.warn('Auto-linking failed:', error);
            }
          }

          setUploadProgress(prev => ({ ...prev, [fileItem.id]: 1.0 }));
          setFiles(prev => prev.map(f => 
            f.id === fileItem.id ? { ...f, status: 'complete' } : f
          ));

          results[fileItem.id] = {
            ...parseResult,
            addedPolicies: addedPolicies.length,
            summary: parser.generateSummary(parseResult)
          };

        } catch (error) {
          console.error(`Upload failed for ${fileItem.name}:`, error);
          
          // Provide specific error messages based on error type
          let userMessage = error.message;
          if (error.message.includes('PDF parsing failed')) {
            userMessage = `PDF processing failed for ${fileItem.name}. The file may be password-protected, corrupted, or contain only scanned images. Try converting to a text-based PDF or plain text format.`;
          } else if (error.message.includes('Word document parsing failed')) {
            userMessage = `Word document processing failed for ${fileItem.name}. Please save as PDF or plain text for better results.`;
          } else if (error.message.includes('No policies found')) {
            userMessage = `No policies detected in ${fileItem.name}. The document may not contain structured policy content, or may need manual formatting.`;
          }
          
          setFiles(prev => prev.map(f => 
            f.id === fileItem.id ? { ...f, status: 'error', error: userMessage } : f
          ));
          onError?.(userMessage);
        }
      }

      setParseResults(results);
      onUploadComplete?.(results);

    } catch (error) {
      console.error('Upload processing failed:', error);
      onError?.(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (fileId) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
    setUploadProgress(prev => {
      const { [fileId]: removed, ...rest } = prev;
      return rest;
    });
    setParseResults(prev => {
      const { [fileId]: removed, ...rest } = prev;
      return rest;
    });
  };

  const clearAll = () => {
    setFiles([]);
    setUploadProgress({});
    setParseResults({});
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'complete':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'processing':
        return <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      default:
        return <FileText className="h-5 w-5 text-gray-400" />;
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <div className="space-y-2">
          <p className="text-lg font-medium text-gray-900">
            Upload Policy Documents
          </p>
          <p className="text-sm text-gray-500">
            Drag and drop files here, or click to select
          </p>
          <p className="text-xs text-gray-400">
            Supports PDF, Word, Text, HTML • Max {maxSizePerFile / 1024 / 1024}MB per file
          </p>
        </div>
        
        <input
          type="file"
          multiple
          accept=".pdf,.docx,.txt,.html"
          onChange={(e) => handleFileSelect(e.target.files)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={uploading || files.length >= maxFiles}
        />
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              Selected Files ({files.length})
            </h3>
            <div className="flex gap-2">
              <button
                onClick={clearAll}
                disabled={uploading}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Clear All
              </button>
              <button
                onClick={processUpload}
                disabled={uploading || files.length === 0 || !planId}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? 'Processing...' : 'Upload & Parse'}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {files.map((fileItem) => (
              <div
                key={fileItem.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border"
              >
                <div className="flex items-center space-x-3 flex-1">
                  {getStatusIcon(fileItem.status)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {fileItem.name}
                    </p>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <span>{formatFileSize(fileItem.size)}</span>
                      {fileItem.status === 'processing' && uploadProgress[fileItem.id] && (
                        <span>• {Math.round(uploadProgress[fileItem.id] * 100)}%</span>
                      )}
                      {fileItem.status === 'complete' && parseResults[fileItem.id] && (
                        <span>• {parseResults[fileItem.id].addedPolicies} policies added</span>
                      )}
                      {fileItem.status === 'error' && (
                        <span className="text-red-500">• {fileItem.error}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {fileItem.status === 'complete' && parseResults[fileItem.id] && (
                    <button
                      onClick={() => {
                        // Show parse results modal
                        console.log('Show results for:', parseResults[fileItem.id]);
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title="View results"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  )}
                  
                  <button
                    onClick={() => removeFile(fileItem.id)}
                    disabled={uploading}
                    className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-50"
                    title="Remove file"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Progress bar */}
                {fileItem.status === 'processing' && uploadProgress[fileItem.id] && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 rounded-b-lg overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${uploadProgress[fileItem.id] * 100}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results Summary */}
      {Object.keys(parseResults).length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="text-lg font-medium text-green-900 mb-2">Upload Complete</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium text-green-700">Documents:</span>
              <span className="ml-1 text-green-600">{Object.keys(parseResults).length}</span>
            </div>
            <div>
              <span className="font-medium text-green-700">Policies:</span>
              <span className="ml-1 text-green-600">
                {Object.values(parseResults).reduce((sum, result) => sum + (result.addedPolicies || 0), 0)}
              </span>
            </div>
            <div>
              <span className="font-medium text-green-700">Categories:</span>
              <span className="ml-1 text-green-600">
                {[...new Set(Object.values(parseResults).flatMap(result => result.metadata?.categories || []))].length}
              </span>
            </div>
            <div>
              <span className="font-medium text-green-700">Auto-linked:</span>
              <span className="ml-1 text-green-600">Yes</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PolicyUpload;
