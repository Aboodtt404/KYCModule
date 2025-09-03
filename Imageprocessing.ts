type DocumentType = 'national-id' | 'passport';

interface EnhancementOptions {
  brightness: number;
  contrast: number;
  sharpness: number;
  gamma: number;
  denoise: boolean;
  autoRotate: boolean;
  cropDocument: boolean;
  normalizeColors: boolean;
  enhanceEdges: boolean;
  histogramEqualization: boolean;
}

// Default enhancement settings optimized for document processing
const getEnhancementSettings = (documentType: DocumentType): EnhancementOptions => {
  const baseSettings: EnhancementOptions = {
    brightness: 1.1,
    contrast: 1.2,
    sharpness: 1.3,
    gamma: 1.0,
    denoise: true,
    autoRotate: true,
    cropDocument: true,
    normalizeColors: true,
    enhanceEdges: true,
    histogramEqualization: true,
  };

  // Specific adjustments for different document types
  if (documentType === 'national-id') {
    // Arabic text often benefits from higher contrast and sharpness
    return {
      ...baseSettings,
      contrast: 1.3,
      sharpness: 1.4,
      gamma: 0.9, // Slightly darker for better Arabic text visibility
    };
  } else {
    // Passport settings
    return {
      ...baseSettings,
      brightness: 1.05, // Passports often have good lighting already
      contrast: 1.15,
    };
  }
};

// Convert File to ImageData for processing
const fileToImageData = (file: File): Promise<{ imageData: ImageData; canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      resolve({ imageData, canvas, ctx });
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};

// Apply brightness and contrast adjustments
const adjustBrightnessContrast = (imageData: ImageData, brightness: number, contrast: number): void => {
  const data = imageData.data;
  const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));

  for (let i = 0; i < data.length; i += 4) {
    // Apply brightness
    data[i] = Math.min(255, Math.max(0, data[i] * brightness));     // Red
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * brightness)); // Green
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * brightness)); // Blue

    // Apply contrast
    data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128));
    data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128));
    data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128));
  }
};

// Apply gamma correction
const applyGammaCorrection = (imageData: ImageData, gamma: number): void => {
  const data = imageData.data;
  const gammaCorrection = 1 / gamma;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.pow(data[i] / 255, gammaCorrection) * 255;
    data[i + 1] = Math.pow(data[i + 1] / 255, gammaCorrection) * 255;
    data[i + 2] = Math.pow(data[i + 2] / 255, gammaCorrection) * 255;
  }
};

// Apply sharpening filter using convolution
const applySharpeningFilter = (imageData: ImageData, intensity: number): void => {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const newData = new Uint8ClampedArray(data);

  // Sharpening kernel
  const kernel = [
    0, -intensity, 0,
    -intensity, 1 + 4 * intensity, -intensity,
    0, -intensity, 0
  ];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) { // RGB channels only
        let sum = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + c;
            sum += data[idx] * kernel[(ky + 1) * 3 + (kx + 1)];
          }
        }
        const idx = (y * width + x) * 4 + c;
        newData[idx] = Math.min(255, Math.max(0, sum));
      }
    }
  }

  // Copy the processed data back
  for (let i = 0; i < data.length; i += 4) {
    data[i] = newData[i];
    data[i + 1] = newData[i + 1];
    data[i + 2] = newData[i + 2];
  }
};

// Apply denoising using a simple blur filter
const applyDenoising = (imageData: ImageData): void => {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const newData = new Uint8ClampedArray(data);

  // Simple 3x3 blur kernel for noise reduction
  const kernel = [
    1/9, 1/9, 1/9,
    1/9, 1/9, 1/9,
    1/9, 1/9, 1/9
  ];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + c;
            sum += data[idx] * kernel[(ky + 1) * 3 + (kx + 1)];
          }
        }
        const idx = (y * width + x) * 4 + c;
        newData[idx] = sum;
      }
    }
  }

  // Copy back only slightly blurred version to reduce noise while preserving detail
  for (let i = 0; i < data.length; i += 4) {
    data[i] = (data[i] * 0.7 + newData[i] * 0.3);
    data[i + 1] = (data[i + 1] * 0.7 + newData[i + 1] * 0.3);
    data[i + 2] = (data[i + 2] * 0.7 + newData[i + 2] * 0.3);
  }
};

// Apply histogram equalization for better contrast
const applyHistogramEqualization = (imageData: ImageData): void => {
  const data = imageData.data;
  const histogram = new Array(256).fill(0);
  const totalPixels = imageData.width * imageData.height;

  // Calculate histogram for luminance
  for (let i = 0; i < data.length; i += 4) {
    const luminance = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    histogram[luminance]++;
  }

  // Calculate cumulative distribution
  const cdf = new Array(256);
  cdf[0] = histogram[0];
  for (let i = 1; i < 256; i++) {
    cdf[i] = cdf[i - 1] + histogram[i];
  }

  // Normalize CDF
  const cdfMin = cdf.find(val => val > 0) || 0;
  for (let i = 0; i < 256; i++) {
    cdf[i] = Math.round(((cdf[i] - cdfMin) / (totalPixels - cdfMin)) * 255);
  }

  // Apply equalization
  for (let i = 0; i < data.length; i += 4) {
    const luminance = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    const newLuminance = cdf[luminance];
    const factor = newLuminance / (luminance || 1);

    data[i] = Math.min(255, Math.max(0, data[i] * factor));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * factor));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * factor));
  }
};

// Detect and correct document orientation (simplified version)
const correctOrientation = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void => {
  // This is a simplified orientation correction
  // In a real implementation, you might use edge detection to determine document orientation
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // Simple heuristic: check if there are more horizontal or vertical edges
  let horizontalEdges = 0;
  let verticalEdges = 0;
  
  for (let y = 1; y < canvas.height - 1; y++) {
    for (let x = 1; x < canvas.width - 1; x++) {
      const idx = (y * canvas.width + x) * 4;
      const current = data[idx];
      const right = data[idx + 4];
      const bottom = data[(y + 1) * canvas.width * 4 + x * 4];
      
      if (Math.abs(current - right) > 30) horizontalEdges++;
      if (Math.abs(current - bottom) > 30) verticalEdges++;
    }
  }
  
  // If more vertical edges than horizontal, the document might be rotated
  if (verticalEdges > horizontalEdges * 1.5) {
    // Rotate 90 degrees
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCanvas.width = canvas.height;
      tempCanvas.height = canvas.width;
      tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
      tempCtx.rotate(Math.PI / 2);
      tempCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
      
      canvas.width = tempCanvas.width;
      canvas.height = tempCanvas.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(tempCanvas, 0, 0);
    }
  }
};

// Crop document to edges (simplified version)
const cropToDocument = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void => {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  let minX = canvas.width, maxX = 0, minY = canvas.height, maxY = 0;
  
  // Find document boundaries by looking for non-white pixels
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const idx = (y * canvas.width + x) * 4;
      const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      
      // If pixel is not close to white, it's likely part of the document
      if (brightness < 240) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }
  
  // Add some padding
  const padding = 10;
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(canvas.width, maxX + padding);
  maxY = Math.min(canvas.height, maxY + padding);
  
  // Only crop if we found reasonable boundaries
  if (maxX > minX && maxY > minY && (maxX - minX) > canvas.width * 0.3 && (maxY - minY) > canvas.height * 0.3) {
    const croppedImageData = ctx.getImageData(minX, minY, maxX - minX, maxY - minY);
    canvas.width = maxX - minX;
    canvas.height = maxY - minY;
    ctx.putImageData(croppedImageData, 0, 0);
  }
};

// Normalize colors for better OCR
const normalizeColors = (imageData: ImageData): void => {
  const data = imageData.data;
  
  // Convert to grayscale and enhance contrast for better OCR
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    
    // Enhance contrast by making dark pixels darker and light pixels lighter
    const enhanced = gray < 128 ? Math.max(0, gray - 20) : Math.min(255, gray + 20);
    
    data[i] = enhanced;     // Red
    data[i + 1] = enhanced; // Green
    data[i + 2] = enhanced; // Blue
  }
};

// Main enhancement function
export const enhanceImage = async (file: File, documentType: DocumentType): Promise<File> => {
  try {
    const settings = getEnhancementSettings(documentType);
    const { imageData, canvas, ctx } = await fileToImageData(file);

    // Apply orientation correction first
    if (settings.autoRotate) {
      correctOrientation(canvas, ctx);
    }

    // Crop to document boundaries
    if (settings.cropDocument) {
      cropToDocument(canvas, ctx);
    }

    // Get fresh image data after potential rotation/cropping
    const freshImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Apply brightness and contrast adjustments
    adjustBrightnessContrast(freshImageData, settings.brightness, settings.contrast);

    // Apply gamma correction
    if (settings.gamma !== 1.0) {
      applyGammaCorrection(freshImageData, settings.gamma);
    }

    // Apply histogram equalization
    if (settings.histogramEqualization) {
      applyHistogramEqualization(freshImageData);
    }

    // Apply denoising
    if (settings.denoise) {
      applyDenoising(freshImageData);
    }

    // Apply sharpening
    if (settings.sharpness > 1.0) {
      applySharpeningFilter(freshImageData, (settings.sharpness - 1.0) * 0.5);
    }

    // Normalize colors for better OCR
    if (settings.normalizeColors) {
      normalizeColors(freshImageData);
    }

    // Put the processed image data back to canvas
    ctx.putImageData(freshImageData, 0, 0);

    // Convert canvas back to File
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          const enhancedFile = new File([blob], `enhanced-${file.name}`, {
            type: file.type,
            lastModified: Date.now(),
          });
          resolve(enhancedFile);
        }
      }, file.type, 0.95); // High quality
    });

  } catch (error) {
    console.error('Image enhancement failed:', error);
    // Return original file if enhancement fails
    return file;
  }
};
