import React, { useState } from 'react';
import { FileText, Image, Download, Trash2, Eye, Loader2, X } from 'lucide-react';

import { useDocuments, useDeleteDocument } from '../../../useQueries';
import { useFileList } from '../../components/shared/FileList';
import { FileMetadata } from '../../../types';
import { formatFileSize } from '../../../utils/formatFileSize';

const getFileIcon = (mimeType: string) => {
  return mimeType.startsWith('image/')
    ? <Image className="w-5 h-5 text-blue-600 dark:text-blue-400" />
    : <FileText className="w-5 h-5 text-gray-600 dark:text-gray-300" />;
};

const isImage = (mimeType: string) => mimeType.startsWith('image/');

export function DocumentList() {
  const { data: documents, isLoading, refetch } = useDocuments();
  const { getFileUrl } = useFileList() as { getFileUrl: (file: FileMetadata) => Promise<string> };
  const deleteDocumentMutation = useDeleteDocument();

  const [selectedFile, setSelectedFile] = useState<FileMetadata | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [downloadingFiles, setDownloadingFiles] = useState(new Set<string>());

  const handlePreview = async (file: FileMetadata) => {
    if (!isImage(file.mimeType)) return;
    setLoadingPreview(true);
    try {
      const url = await getFileUrl(file);
      setPreviewUrl(url);
      setSelectedFile(file);
    } catch (error) {
      console.error('Failed to load preview:', error);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleDownload = async (file: FileMetadata) => {
    setDownloadingFiles(prev => new Set(prev).add(file.path));
    try {
      const url = await getFileUrl(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.path;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Failed to download file:', error);
    } finally {
      setDownloadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(file.path);
        return newSet;
      });
    }
  };

  const handleDelete = async (file: FileMetadata) => {
    if (window.confirm(`Are you sure you want to delete "${file.path}"?`)) {
      try {
        await deleteDocumentMutation.mutateAsync(file.path);
      } catch (error) {
        console.error('Failed to delete file:', error);
      }
    }
  };

  const closePreview = () => {
    setSelectedFile(null);
    setPreviewUrl('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
        <span className="ml-2 text-gray-600 dark:text-gray-300">Loading documents...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Document Library</h2>
          <p className="text-gray-600 dark:text-gray-300">
            {documents?.length || 0} documents in your collection
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-500 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Document List */}
      {!documents || documents.length === 0 ? (
        <div className="bg-white dark:bg-glass rounded-lg shadow-sm border border-gray-200 dark:border-white/10 p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No documents yet</h3>
          <p className="text-gray-600 dark:text-gray-300">Upload your first document to get started</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-glass rounded-lg shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-white/10">
              <thead className="bg-gray-50 dark:bg-white/5">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">File</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Size</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-transparent divide-y divide-gray-200 dark:divide-white/10">
                {documents.map((file, index) => (
                  <tr key={`${file.path}-${index}`} className="hover:bg-gray-50 dark:hover:bg-white/5">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getFileIcon(file.mimeType)}
                        <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-100">{file.path}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{file.mimeType}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{formatFileSize(file.size)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        {isImage(file.mimeType) && (
                          <button
                            onClick={() => handlePreview(file)}
                            disabled={loadingPreview}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 disabled:opacity-50"
                            title="Preview"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDownload(file)}
                          disabled={downloadingFiles.has(file.path)}
                          className="bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 dark:hover:bg-green-500 disabled:opacity-50 transition-colors flex items-center"
                          title="Download"
                        >
                          {downloadingFiles.has(file.path) ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                          <span className="ml-1 text-xs">Download</span>
                        </button>
                        <button
                          onClick={() => handleDelete(file)}
                          disabled={deleteDocumentMutation.isPending}
                          className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 disabled:opacity-50"
                          title="Delete"
                        >
                          {deleteDocumentMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {selectedFile && previewUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-glass rounded-lg max-w-4xl max-h-full overflow-auto border border-gray-200 dark:border-white/10">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-white/10">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{selectedFile.path}</h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleDownload(selectedFile)}
                  disabled={downloadingFiles.has(selectedFile.path)}
                  className="bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 dark:hover:bg-green-500 disabled:opacity-50 transition-colors flex items-center"
                >
                  {downloadingFiles.has(selectedFile.path) ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <Download className="w-4 h-4 mr-1" />
                  )}
                  Download
                </button>
                <button
                  onClick={closePreview}
                  className="text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-4">
              <img
                src={previewUrl}
                alt={selectedFile.path}
                className="max-w-full h-auto rounded"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
