import { isDemoMode } from '@/demo/demoMode';

const OCR_SERVER_BASE_URL = process.env.VITE_OCR_SERVER_URL || '';
export async function verifyFace(idImageBase64, liveImageBase64, challengeFramesBase64 = []) {
    // Demo mode: simulate a successful active-liveness match without a server
    if (isDemoMode()) {
        await new Promise(r => setTimeout(r, 1800));
        return {
            success: true,
            verification_result: {
                is_match: true,
                similarity_score: 91.4,
                distance: 0.32,
                threshold: 75,
                liveness_failed: false,
                liveness_mode: 'active',
                liveness_score: 118.6,
            },
        };
    }
    if (!OCR_SERVER_BASE_URL) {
        throw new Error('Face verification service is not configured. Please contact support.');
    }
    try {
        const response = await fetch(`${OCR_SERVER_BASE_URL}/verify-face`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                id_image: idImageBase64,
                live_image: liveImageBase64,
                challenge_frames: challengeFramesBase64.slice(0, 4),
            }),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        return await response.json();
    }
    catch (error) {
        throw new Error(error instanceof Error
            ? error.message
            : 'Face verification failed. Please try again.');
    }
}
export function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            const base64 = typeof result === 'string' ? result.split(',')[1] : undefined;
            if (!base64) { reject(new Error('Failed to extract base64 from file')); return; }
            resolve(base64);
        };
        reader.onerror = () => reject(new Error('Failed to convert file to base64'));
        reader.readAsDataURL(file);
    });
}
