/**
 * Image compression utilities to handle large images before upload
 * This helps avoid 413 Payload Too Large errors from Internet Computer
 */

export interface CompressionOptions {
    maxSizeKB?: number;
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    format?: 'image/jpeg' | 'image/png' | 'image/webp';
}

export interface CompressionResult {
    compressedBlob: Blob;
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    dimensions: {
        original: { width: number; height: number };
        compressed: { width: number; height: number };
    };
}

/**
 * Compress an image file to reduce its size
 * @param file - The original image file
 * @param options - Compression options
 * @returns Promise with compression result
 */
export const compressImage = async (
    file: File,
    options: CompressionOptions = {}
): Promise<CompressionResult> => {
    const {
        maxSizeKB = 500, // Default 500KB limit
        maxWidth = 1200,
        maxHeight = 1200,
        quality = 0.8,
        format = 'image/jpeg'
    } = options;

    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
        }

        img.onload = () => {
            try {
                // Calculate new dimensions while maintaining aspect ratio
                let { width, height } = img;
                const originalWidth = width;
                const originalHeight = height;

                // Scale down if image is too large
                if (width > maxWidth || height > maxHeight) {
                    const aspectRatio = width / height;

                    if (width > height) {
                        width = Math.min(maxWidth, width);
                        height = width / aspectRatio;
                    } else {
                        height = Math.min(maxHeight, height);
                        width = height * aspectRatio;
                    }
                }

                // Set canvas dimensions
                canvas.width = width;
                canvas.height = height;

                // Draw the image on canvas
                ctx.drawImage(img, 0, 0, width, height);

                // First compression attempt
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('Failed to compress image'));
                            return;
                        }

                        const targetSizeBytes = maxSizeKB * 1024;

                        // If still too large, reduce quality progressively
                        if (blob.size > targetSizeBytes) {
                            compressWithQualityReduction(
                                canvas,
                                ctx,
                                img,
                                width,
                                height,
                                targetSizeBytes,
                                format,
                                resolve,
                                reject
                            );
                        } else {
                            resolve({
                                compressedBlob: blob,
                                originalSize: file.size,
                                compressedSize: blob.size,
                                compressionRatio: file.size / blob.size,
                                dimensions: {
                                    original: { width: originalWidth, height: originalHeight },
                                    compressed: { width, height }
                                }
                            });
                        }
                    },
                    format,
                    quality
                );
            } catch (error) {
                reject(error);
            }
        };

        img.onerror = () => {
            reject(new Error('Failed to load image'));
        };

        img.src = URL.createObjectURL(file);
    });
};

/**
 * Recursively reduce quality until target size is reached
 */
const compressWithQualityReduction = (
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    width: number,
    height: number,
    targetSizeBytes: number,
    format: string,
    resolve: (result: CompressionResult) => void,
    reject: (error: Error) => void,
    quality: number = 0.7,
    minQuality: number = 0.1
) => {
    canvas.toBlob(
        (blob) => {
            if (!blob) {
                reject(new Error('Failed to compress image'));
                return;
            }

            if (blob.size <= targetSizeBytes || quality <= minQuality) {
                resolve({
                    compressedBlob: blob,
                    originalSize: 0, // Will be set by caller
                    compressedSize: blob.size,
                    compressionRatio: 0, // Will be calculated by caller
                    dimensions: {
                        original: { width: img.naturalWidth, height: img.naturalHeight },
                        compressed: { width, height }
                    }
                });
                return;
            }

            // Reduce quality and try again
            const newQuality = Math.max(quality - 0.1, minQuality);
            compressWithQualityReduction(
                canvas,
                ctx,
                img,
                width,
                height,
                targetSizeBytes,
                format,
                resolve,
                reject,
                newQuality,
                minQuality
            );
        },
        format,
        quality
    );
};

/**
 * Check if an image needs compression
 * @param file - The image file to check
 * @param maxSizeKB - Maximum allowed size in KB
 * @returns True if compression is needed
 */
export const needsCompression = (file: File, maxSizeKB: number = 1000): boolean => {
    return file.size > maxSizeKB * 1024;
};

/**
 * Get compression recommendations based on file size
 * @param file - The image file
 * @returns Compression recommendations
 */
export const getCompressionRecommendations = (file: File) => {
    const sizeMB = file.size / (1024 * 1024);

    if (sizeMB > 4) {
        return {
            recommended: true,
            maxSizeKB: 500,
            maxWidth: 1000,
            maxHeight: 1000,
            quality: 0.7,
            reason: 'Image is very large (>4MB). Strong compression recommended.'
        };
    } else if (sizeMB > 2) {
        return {
            recommended: true,
            maxSizeKB: 800,
            maxWidth: 1200,
            maxHeight: 1200,
            quality: 0.8,
            reason: 'Image is large (>2MB). Compression recommended.'
        };
    } else if (sizeMB > 1) {
        return {
            recommended: true,
            maxSizeKB: 1000,
            maxWidth: 1400,
            maxHeight: 1400,
            quality: 0.85,
            reason: 'Image is moderately large (>1MB). Light compression recommended.'
        };
    } else {
        return {
            recommended: false,
            maxSizeKB: 1000,
            maxWidth: 1600,
            maxHeight: 1600,
            quality: 0.9,
            reason: 'Image size is acceptable. No compression needed.'
        };
    }
};

/**
 * Create a compressed file with a new name
 * @param originalFile - The original file
 * @param compressedBlob - The compressed blob
 * @returns New File object with compressed data
 */
export const createCompressedFile = (
    originalFile: File,
    compressedBlob: Blob
): File => {
    const nameWithoutExt = originalFile.name.replace(/\.[^/.]+$/, '');
    const extension = originalFile.name.split('.').pop() || 'jpg';
    const compressedFileName = `${nameWithoutExt}_compressed.${extension}`;

    return new File([compressedBlob], compressedFileName, {
        type: compressedBlob.type,
        lastModified: Date.now()
    });
};
