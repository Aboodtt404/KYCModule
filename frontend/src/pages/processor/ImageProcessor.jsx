import React, { useState, useRef, useCallback } from 'react';
import { useFileList } from '../../components/shared/FileList';
import { useFileUpload } from '../../components/shared/FileUploadd';
import { useDocuments } from '../../../useQueries';
import { Image, Download, Upload, Loader2, Sliders, RotateCcw } from 'lucide-react';
const enhancements = [
    { type: 'brightness', value: 0, label: 'Brightness', min: -100, max: 100, step: 5, default: 0 },
    { type: 'contrast', value: 0, label: 'Contrast', min: -100, max: 100, step: 5, default: 0 },
    { type: 'sharpness', value: 0, label: 'Sharpness', min: 0, max: 200, step: 10, default: 0 },
];
export function ImageProcessor() {
    const { data: documents } = useDocuments();
    const { getFileUrl } = useFileList();
    const { uploadFile, isUploading } = useFileUpload();
    const [selectedImage, setSelectedImage] = useState(null);
    const [originalUrl, setOriginalUrl] = useState('');
    const [processedUrl, setProcessedUrl] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isGreyscale, setIsGreyscale] = useState(false);
    const [enhancementValues, setEnhancementValues] = useState({
        greyscale: 0,
        brightness: 0,
        contrast: 0,
        sharpness: 0,
    });
    const [downloadingProcessed, setDownloadingProcessed] = useState(false);
    const canvasRef = useRef(null);
    const imageFiles = documents?.filter(doc => doc.mimeType.startsWith('image/')) || [];
    // Debug logs
    console.log('=== DEBUG INFO ===');
    console.log('documents:', documents);
    console.log('imageFiles:', imageFiles);
    console.log('selectedImage:', selectedImage);
    console.log('originalUrl:', originalUrl);
    console.log('==================');
    const loadImage = useCallback(async (file) => {
        try {
            const url = await getFileUrl(file);
            setOriginalUrl(url);
            setSelectedImage(file);
            setProcessedUrl('');
            setIsGreyscale(false);
            setEnhancementValues({
                greyscale: 0,
                brightness: 0,
                contrast: 0,
                sharpness: 0,
            });
        }
        catch (error) {
            console.error('Failed to load image:', error);
        }
    }, [getFileUrl]);
    const applyEnhancements = useCallback(async () => {
        if (!originalUrl || !canvasRef.current)
            return;
        setIsProcessing(true);
        try {
            const img = document.createElement('img');
            img.crossOrigin = 'anonymous';
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = originalUrl;
            });
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (!ctx)
                return;
            // Set canvas size to match image
            canvas.width = img.width;
            canvas.height = img.height;
            // Draw the original image first
            ctx.drawImage(img, 0, 0);
            // Apply greyscale if enabled
            if (isGreyscale) {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                for (let i = 0; i < data.length; i += 4) {
                    const grey = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                    data[i] = grey; // Red
                    data[i + 1] = grey; // Green
                    data[i + 2] = grey; // Blue
                }
                ctx.putImageData(imageData, 0, 0);
            }
            // Apply brightness and contrast adjustments
            if (enhancementValues.brightness !== 0 || enhancementValues.contrast !== 0) {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                const brightness = enhancementValues.brightness;
                const contrast = enhancementValues.contrast;
                const contrastFactor = (100 + contrast) / 100;
                for (let i = 0; i < data.length; i += 4) {
                    // Apply brightness
                    let r = data[i] + brightness;
                    let g = data[i + 1] + brightness;
                    let b = data[i + 2] + brightness;
                    // Apply contrast
                    r = ((r - 128) * contrastFactor) + 128;
                    g = ((g - 128) * contrastFactor) + 128;
                    b = ((b - 128) * contrastFactor) + 128;
                    // Clamp values to 0-255
                    data[i] = Math.max(0, Math.min(255, r));
                    data[i + 1] = Math.max(0, Math.min(255, g));
                    data[i + 2] = Math.max(0, Math.min(255, b));
                }
                ctx.putImageData(imageData, 0, 0);
            }
            // Apply sharpness (unsharp mask)
            if (enhancementValues.sharpness > 0) {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                const sharpness = enhancementValues.sharpness / 100;
                // Simple sharpening kernel
                const kernel = [
                    0, -sharpness, 0,
                    -sharpness, 1 + 4 * sharpness, -sharpness,
                    0, -sharpness, 0
                ];
                const width = canvas.width;
                const height = canvas.height;
                const newData = new Uint8ClampedArray(data);
                for (let y = 1; y < height - 1; y++) {
                    for (let x = 1; x < width - 1; x++) {
                        for (let c = 0; c < 3; c++) { // RGB channels
                            let sum = 0;
                            for (let ky = -1; ky <= 1; ky++) {
                                for (let kx = -1; kx <= 1; kx++) {
                                    const idx = ((y + ky) * width + (x + kx)) * 4 + c;
                                    sum += data[idx] * kernel[(ky + 1) * 3 + (kx + 1)];
                                }
                            }
                            const idx = (y * width + x) * 4 + c;
                            newData[idx] = Math.max(0, Math.min(255, sum));
                        }
                    }
                }
                const newImageData = new ImageData(newData, width, height);
                ctx.putImageData(newImageData, 0, 0);
            }
            // Convert to blob URL
            canvas.toBlob((blob) => {
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    setProcessedUrl(url);
                }
            }, 'image/jpeg', 0.9);
        }
        catch (error) {
            console.error('Failed to process image:', error);
        }
        finally {
            setIsProcessing(false);
        }
    }, [originalUrl, isGreyscale, enhancementValues]);
    const handleEnhancementChange = (type, value) => {
        setEnhancementValues(prev => ({
            ...prev,
            [type]: value
        }));
    };
    const resetEnhancements = () => {
        setIsGreyscale(false);
        setEnhancementValues({
            greyscale: 0,
            brightness: 0,
            contrast: 0,
            sharpness: 0,
        });
        setProcessedUrl('');
    };
    const downloadProcessed = useCallback(async () => {
        if (!processedUrl || !selectedImage)
            return;
        setDownloadingProcessed(true);
        try {
            const link = document.createElement('a');
            link.href = processedUrl;
            // Create descriptive filename
            const enhancements = [];
            if (isGreyscale)
                enhancements.push('greyscale');
            if (enhancementValues.brightness !== 0)
                enhancements.push(`brightness${enhancementValues.brightness > 0 ? '+' : ''}${enhancementValues.brightness}`);
            if (enhancementValues.contrast !== 0)
                enhancements.push(`contrast${enhancementValues.contrast > 0 ? '+' : ''}${enhancementValues.contrast}`);
            if (enhancementValues.sharpness !== 0)
                enhancements.push(`sharpness+${enhancementValues.sharpness}`);
            const enhancementSuffix = enhancements.length > 0 ? `_${enhancements.join('_')}` : '_enhanced';
            const filename = `${selectedImage.path.replace(/\.[^/.]+$/, '')}${enhancementSuffix}.jpg`;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        catch (error) {
            console.error('Failed to download processed image:', error);
        }
        finally {
            setDownloadingProcessed(false);
        }
    }, [processedUrl, selectedImage, isGreyscale, enhancementValues]);
    const saveProcessed = useCallback(async () => {
        if (!processedUrl || !selectedImage || !canvasRef.current)
            return;
        try {
            const canvas = canvasRef.current;
            canvas.toBlob(async (blob) => {
                if (blob) {
                    const arrayBuffer = await blob.arrayBuffer();
                    const uint8Array = new Uint8Array(arrayBuffer);
                    // Create descriptive filename
                    const enhancements = [];
                    if (isGreyscale)
                        enhancements.push('greyscale');
                    if (enhancementValues.brightness !== 0)
                        enhancements.push(`brightness${enhancementValues.brightness > 0 ? '+' : ''}${enhancementValues.brightness}`);
                    if (enhancementValues.contrast !== 0)
                        enhancements.push(`contrast${enhancementValues.contrast > 0 ? '+' : ''}${enhancementValues.contrast}`);
                    if (enhancementValues.sharpness !== 0)
                        enhancements.push(`sharpness+${enhancementValues.sharpness}`);
                    const enhancementSuffix = enhancements.length > 0 ? `_${enhancements.join('_')}` : '_enhanced';
                    const filename = `${selectedImage.path.replace(/\.[^/.]+$/, '')}${enhancementSuffix}.jpg`;
                    await uploadFile(filename, 'image/jpeg', uint8Array, (progress) => setUploadProgress(progress));
                    setUploadProgress(0);
                }
            }, 'image/jpeg', 0.9);
        }
        catch (error) {
            console.error('Failed to save processed image:', error);
        }
    }, [processedUrl, selectedImage, uploadFile, isGreyscale, enhancementValues]);
    const hasEnhancements = isGreyscale || Object.values(enhancementValues).some(v => v !== 0);
    return (<div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Image Processor</h2>
        <p className="text-gray-600 dark:text-gray-300">Apply various enhancements to your images</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Image Selection */}
        <div className="bg-white dark:bg-glass dark:backdrop-blur-md rounded-lg shadow-sm border border-gray-200 dark:border-white/10 p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Select Image</h3>

          {imageFiles.length === 0 ? (<div className="text-center py-8">
              <Image className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-400 mb-4"/>
              <p className="text-gray-600 dark:text-gray-300">No images available</p>
            </div>) : (<div className="space-y-2 max-h-96 overflow-y-auto">
              {imageFiles.map((file, index) => (<button key={`${file.path}-${index}`} onClick={() => loadImage(file)} className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedImage?.path === file.path
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                    : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'}`}>
                  <div className="flex items-center">
                    <Image className={`w-4 h-4 mr-2 ${selectedImage?.path === file.path ? 'text-blue-600' : 'text-gray-500 dark:text-gray-300'}`}/>
                    <span className="text-sm font-medium truncate text-gray-800 dark:text-gray-100">{file.path}</span>
                  </div>
                </button>))}
            </div>)}

          {/* Enhancement Controls */}
          {selectedImage && (<div className="mt-6 pt-6 border-t border-gray-200 dark:border-white/10">
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">Enhancement Controls</h4>

              {/* Greyscale Toggle */}
              <div className="mb-4">
                <label className="flex items-center">
                  <input type="checkbox" checked={isGreyscale} onChange={(e) => setIsGreyscale(e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"/>
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-200">Greyscale</span>
                </label>
              </div>

              {/* Enhancement Sliders */}
              {enhancements.map((enhancement) => (<div key={enhancement.type} className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    {enhancement.label}: {enhancementValues[enhancement.type]}
                  </label>
                  <input type="range" min={enhancement.min} max={enhancement.max} step={enhancement.step} value={enhancementValues[enhancement.type]} onChange={(e) => handleEnhancementChange(enhancement.type, Number(e.target.value))} className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"/>
                </div>))}

              {/* Control Buttons */}
              <div className="space-y-2">
                <button onClick={applyEnhancements} disabled={isProcessing || !originalUrl} className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center">
                  {isProcessing ? (<>
                      <Loader2 className="w-4 h-4 animate-spin mr-2"/>
                      Processing...
                    </>) : (<>
                      <Sliders className="w-4 h-4 mr-2"/>
                      Apply Enhancements
                    </>)}
                </button>

                <button onClick={resetEnhancements} disabled={!hasEnhancements} className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors flex items-center justify-center">
                  <RotateCcw className="w-4 h-4 mr-2"/>
                  Reset
                </button>
              </div>
            </div>)}
        </div>

        {/* Image Preview and Processing */}
        <div className="lg:col-span-2 bg-white dark:bg-glass dark:backdrop-blur-md rounded-lg shadow-sm border border-gray-200 dark:border-white/10 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Image Processing</h3>

            {processedUrl && (<div className="flex space-x-2">
                <button onClick={downloadProcessed} disabled={downloadingProcessed} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center">
                  {downloadingProcessed ? (<>
                      <Loader2 className="w-4 h-4 animate-spin mr-2"/>
                      Downloading...
                    </>) : (<>
                      <Download className="w-4 h-4 mr-2"/>
                      Download Enhanced
                    </>)}
                </button>

                <button onClick={saveProcessed} disabled={isUploading} className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center">
                  {isUploading ? (<>
                      <Loader2 className="w-4 h-4 animate-spin mr-2"/>
                      Saving... {Math.round(uploadProgress)}%
                    </>) : (<>
                      <Upload className="w-4 h-4 mr-2"/>
                      Save to Library
                    </>)}
                </button>
              </div>)}
          </div>

          {!selectedImage ? (<div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
              <Image className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-400 mb-4"/>
              <p className="text-gray-600 dark:text-gray-300">Select an image to start processing</p>
            </div>) : (<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Original Image */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Original</h4>
                <div className="border border-gray-200 dark:border-white/10 rounded-lg overflow-hidden bg-white dark:bg-gray-900">
                  {originalUrl && (<img src={originalUrl} alt="Original" className="w-full h-auto"/>)}
                </div>
              </div>

              {/* Processed Image */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Enhanced Preview</h4>
                <div className="border border-gray-200 dark:border-white/10 rounded-lg overflow-hidden bg-white dark:bg-gray-900">
                  {processedUrl ? (<img src={processedUrl} alt="Enhanced" className="w-full h-auto"/>) : (<div className="aspect-square bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
                      <p className="text-gray-500 dark:text-gray-300 text-center px-4">
                        Adjust settings and click "Apply Enhancements" to preview
                      </p>
                    </div>)}
                </div>
              </div>
            </div>)}

          {/* Hidden canvas for processing */}
          <canvas ref={canvasRef} className="hidden"/>
        </div>
      </div>
    </div>);
}
