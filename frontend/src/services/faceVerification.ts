const OCR_SERVER_BASE_URL = process.env.NEXT_PUBLIC_OCR_SERVER_URL || 'http://194.31.150.154:5000';

export interface FaceVerificationResult {
  similarity_score: number;
  is_match: boolean;
  threshold: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface FaceVerificationResponse {
  success: boolean;
  verification_result: FaceVerificationResult;
  error?: string;
}

export async function verifyFace(
  idImageBase64: string,
  liveImageBase64: string
): Promise<FaceVerificationResponse> {
  try {
    console.log('Sending face verification request to:', `${OCR_SERVER_BASE_URL}/verify-face`);
    console.log('ID image length:', idImageBase64.length);
    console.log('Live image length:', liveImageBase64.length);
    
    const response = await fetch(`${OCR_SERVER_BASE_URL}/verify-face`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id_image: idImageBase64,
        live_image: liveImageBase64,
      }),
    });

    console.log('Face verification response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Face verification error response:', errorData);
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Face verification response data:', data);
    return data;
  } catch (error) {
    console.error('Face verification error:', error);
    throw new Error(
      error instanceof Error 
        ? error.message 
        : 'Face verification failed. Please try again.'
    );
  }
}

export function convertFileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix to get just the base64 string
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to convert file to base64'));
    reader.readAsDataURL(file);
  });
}
