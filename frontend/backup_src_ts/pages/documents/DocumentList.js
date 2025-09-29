import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { FileText, Image, Download, Trash2, Eye, Loader2, X } from 'lucide-react';
import { useDocuments, useDeleteDocument } from '../../../useQueries';
import { useFileList } from '../../components/shared/FileList';
import { formatFileSize } from '../../../utils/formatFileSize';
const getFileIcon = (mimeType) => {
    return mimeType.startsWith('image/')
        ? _jsx(Image, { className: "w-5 h-5 text-blue-600 dark:text-blue-400" })
        : _jsx(FileText, { className: "w-5 h-5 text-gray-600 dark:text-gray-300" });
};
const isImage = (mimeType) => mimeType.startsWith('image/');
export function DocumentList() {
    const { data: documents, isLoading, refetch } = useDocuments();
    const { getFileUrl } = useFileList();
    const deleteDocumentMutation = useDeleteDocument();
    const [selectedFile, setSelectedFile] = useState(null);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [previewUrl, setPreviewUrl] = useState('');
    const [downloadingFiles, setDownloadingFiles] = useState(new Set());
    const handlePreview = async (file) => {
        if (!isImage(file.mimeType))
            return;
        setLoadingPreview(true);
        try {
            const url = await getFileUrl(file);
            setPreviewUrl(url);
            setSelectedFile(file);
        }
        catch (error) {
            console.error('Failed to load preview:', error);
        }
        finally {
            setLoadingPreview(false);
        }
    };
    const handleDownload = async (file) => {
        setDownloadingFiles(prev => new Set(prev).add(file.path));
        try {
            const url = await getFileUrl(file);
            const link = document.createElement('a');
            link.href = url;
            link.download = file.path;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        catch (error) {
            console.error('Failed to download file:', error);
        }
        finally {
            setDownloadingFiles(prev => {
                const newSet = new Set(prev);
                newSet.delete(file.path);
                return newSet;
            });
        }
    };
    const handleDelete = async (file) => {
        if (window.confirm(`Are you sure you want to delete "${file.path}"?`)) {
            try {
                await deleteDocumentMutation.mutateAsync(file.path);
            }
            catch (error) {
                console.error('Failed to delete file:', error);
            }
        }
    };
    const closePreview = () => {
        setSelectedFile(null);
        setPreviewUrl('');
    };
    if (isLoading) {
        return (_jsxs("div", { className: "flex items-center justify-center py-12", children: [_jsx(Loader2, { className: "w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" }), _jsx("span", { className: "ml-2 text-gray-600 dark:text-gray-300", children: "Loading documents..." })] }));
    }
    return (_jsxs("div", { className: "max-w-6xl mx-auto", children: [_jsxs("div", { className: "mb-6 flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2", children: "Document Library" }), _jsxs("p", { className: "text-gray-600 dark:text-gray-300", children: [documents?.length || 0, " documents in your collection"] })] }), _jsx("button", { onClick: () => refetch(), className: "bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-500 transition-colors", children: "Refresh" })] }), !documents || documents.length === 0 ? (_jsxs("div", { className: "bg-white dark:bg-glass rounded-lg shadow-sm border border-gray-200 dark:border-white/10 p-12 text-center", children: [_jsx(FileText, { className: "mx-auto h-12 w-12 text-gray-400 mb-4" }), _jsx("h3", { className: "text-lg font-medium text-gray-900 dark:text-gray-100 mb-2", children: "No documents yet" }), _jsx("p", { className: "text-gray-600 dark:text-gray-300", children: "Upload your first document to get started" })] })) : (_jsx("div", { className: "bg-white dark:bg-glass rounded-lg shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden", children: _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200 dark:divide-white/10", children: [_jsx("thead", { className: "bg-gray-50 dark:bg-white/5", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider", children: "File" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider", children: "Type" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider", children: "Size" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white dark:bg-transparent divide-y divide-gray-200 dark:divide-white/10", children: documents.map((file, index) => (_jsxs("tr", { className: "hover:bg-gray-50 dark:hover:bg-white/5", children: [_jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsxs("div", { className: "flex items-center", children: [getFileIcon(file.mimeType), _jsx("span", { className: "ml-3 text-sm font-medium text-gray-900 dark:text-gray-100", children: file.path })] }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300", children: file.mimeType }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300", children: formatFileSize(file.size) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm font-medium", children: _jsxs("div", { className: "flex space-x-2", children: [isImage(file.mimeType) && (_jsx("button", { onClick: () => handlePreview(file), disabled: loadingPreview, className: "text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 disabled:opacity-50", title: "Preview", children: _jsx(Eye, { className: "w-4 h-4" }) })), _jsxs("button", { onClick: () => handleDownload(file), disabled: downloadingFiles.has(file.path), className: "bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 dark:hover:bg-green-500 disabled:opacity-50 transition-colors flex items-center", title: "Download", children: [downloadingFiles.has(file.path) ? (_jsx(Loader2, { className: "w-4 h-4 animate-spin" })) : (_jsx(Download, { className: "w-4 h-4" })), _jsx("span", { className: "ml-1 text-xs", children: "Download" })] }), _jsx("button", { onClick: () => handleDelete(file), disabled: deleteDocumentMutation.isPending, className: "text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 disabled:opacity-50", title: "Delete", children: deleteDocumentMutation.isPending ? (_jsx(Loader2, { className: "w-4 h-4 animate-spin" })) : (_jsx(Trash2, { className: "w-4 h-4" })) })] }) })] }, `${file.path}-${index}`))) })] }) }) })), selectedFile && previewUrl && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4", children: _jsxs("div", { className: "bg-white dark:bg-glass rounded-lg max-w-4xl max-h-full overflow-auto border border-gray-200 dark:border-white/10", children: [_jsxs("div", { className: "flex items-center justify-between p-4 border-b border-gray-200 dark:border-white/10", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900 dark:text-gray-100", children: selectedFile.path }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsxs("button", { onClick: () => handleDownload(selectedFile), disabled: downloadingFiles.has(selectedFile.path), className: "bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 dark:hover:bg-green-500 disabled:opacity-50 transition-colors flex items-center", children: [downloadingFiles.has(selectedFile.path) ? (_jsx(Loader2, { className: "w-4 h-4 animate-spin mr-1" })) : (_jsx(Download, { className: "w-4 h-4 mr-1" })), "Download"] }), _jsx("button", { onClick: closePreview, className: "text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100", children: _jsx(X, { className: "w-6 h-6" }) })] })] }), _jsx("div", { className: "p-4", children: _jsx("img", { src: previewUrl, alt: selectedFile.path, className: "max-w-full h-auto rounded" }) })] }) }))] }));
}
