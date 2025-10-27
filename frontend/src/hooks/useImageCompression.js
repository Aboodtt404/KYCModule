import { useState, useCallback } from 'react';
import { compressImage, needsCompression, getCompressionRecommendations, createCompressedFile } from '../utils/imageCompression';
/**
 * Hook for image compression functionality
 * @param options - Compression options
 * @returns Compression utilities and state
 */
export const useImageCompression = (options = {}) => {
    const { autoCompress = true, showCompressionInfo = true, ...compressionOptions } = options;
    const [isCompressing, setIsCompressing] = useState(false);
    const [compressionResult, setCompressionResult] = useState(null);
    const [compressionError, setCompressionError] = useState(null);
    const compressImageFile = useCallback(async (file) => {
        setIsCompressing(true);
        setCompressionError(null);
        setCompressionResult(null);
        try {
            // Check if compression is needed
            const needsComp = needsCompression(file, compressionOptions.maxSizeKB);
            if (!needsComp && !autoCompress) {
                // No compression needed
                setIsCompressing(false);
                return file;
            }
            // Get compression recommendations
            const recommendations = getCompressionRecommendations(file);
            // Use recommendations if no specific options provided
            const finalOptions = {
                maxSizeKB: compressionOptions.maxSizeKB || recommendations.maxSizeKB,
                maxWidth: compressionOptions.maxWidth || recommendations.maxWidth,
                maxHeight: compressionOptions.maxHeight || recommendations.maxHeight,
                quality: compressionOptions.quality || recommendations.quality,
                format: compressionOptions.format || 'image/jpeg'
            };
            // Compress the image
            const result = await compressImage(file, finalOptions);
            // Create compressed file
            const compressedFile = createCompressedFile(file, result.compressedBlob);
            // Store result for display
            setCompressionResult({
                ...result,
                originalSize: file.size
            });
            if (showCompressionInfo) {
                console.log('Image compression completed:', {
                    originalSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
                    compressedSize: `${(result.compressedSize / 1024 / 1024).toFixed(2)} MB`,
                    compressionRatio: `${((1 - result.compressedSize / file.size) * 100).toFixed(1)}%`,
                    dimensions: result.dimensions
                });
            }
            setIsCompressing(false);
            return compressedFile;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown compression error';
            setCompressionError(errorMessage);
            setIsCompressing(false);
            console.error('Image compression failed:', error);
            // Return original file if compression fails
            return file;
        }
    }, [compressionOptions, autoCompress, showCompressionInfo]);
    const needsCompressionCheck = useCallback((file) => {
        return needsCompression(file, compressionOptions.maxSizeKB);
    }, [compressionOptions.maxSizeKB]);
    const getRecommendations = useCallback((file) => {
        return getCompressionRecommendations(file);
    }, []);
    const reset = useCallback(() => {
        setIsCompressing(false);
        setCompressionResult(null);
        setCompressionError(null);
    }, []);
    return {
        compressImageFile,
        isCompressing,
        compressionResult,
        compressionError,
        needsCompressionCheck,
        getRecommendations,
        reset
    };
};
