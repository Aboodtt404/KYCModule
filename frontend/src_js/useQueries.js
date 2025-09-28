import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import { useFileList } from './src/components/shared/FileList';
export function useDocuments() {
    const { actor, isFetching } = useActor();
    const { getFileList } = useFileList();
    return useQuery({
        queryKey: ['documents'],
        queryFn: async () => {
            if (!actor)
                return [];
            return await getFileList();
        },
        enabled: !!actor && !isFetching,
    });
}
export function useOCRRatings() {
    const { actor, isFetching } = useActor();
    return useQuery({
        queryKey: ['ocrRatings'],
        queryFn: async () => {
            if (!actor)
                return [];
            return await actor.getAllOcrRatings();
        },
        enabled: !!actor && !isFetching,
    });
}
export function useRateOCR() {
    const { actor } = useActor();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ docId, rating }) => {
            if (!actor)
                throw new Error('Backend not available');
            return await actor.rateOcrQuality(docId, rating);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ocrRatings'] });
        },
    });
}
export function useGetOCRRating(docId) {
    const { actor, isFetching } = useActor();
    return useQuery({
        queryKey: ['ocrRating', docId.toString()],
        queryFn: async () => {
            if (!actor)
                return null;
            const rating = await actor.getOcrRating(docId);
            return typeof rating === 'bigint' ? rating : null; // Ensure the return type is bigint | null
        },
        enabled: !!actor && !isFetching,
    });
}
export function useDeleteDocument() {
    const { actor } = useActor();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (path) => {
            if (!actor)
                throw new Error('Backend not available');
            console.log('Attempting to delete file:', path);
            try {
                const result = await actor.delete(path); // Use 'delete' as shown in the generated interface
                console.log('Delete result:', result);
                return result;
            }
            catch (error) {
                console.error('Delete error:', error);
                throw error;
            }
        },
        onSuccess: (data, path) => {
            console.log('Delete successful for:', path);
            queryClient.invalidateQueries({ queryKey: ['documents'] });
        },
        onError: (error, path) => {
            console.error('Delete failed for:', path, error);
        },
    });
}
export function useOCR() {
    return useMutation({
        mutationFn: async (imageData) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
            try {
                const response = await fetch('http://194.31.150.154:5000/ocr', {
                    method: 'POST',
                    body: imageData,
                    headers: {
                        'Content-Type': 'application/octet-stream'
                    },
                    signal: controller.signal
                });
                if (!response.ok) {
                    throw new Error(`OCR processing failed: ${response.status} ${response.statusText}`);
                }
                return await response.json();
            }
            catch (error) {
                if (error.name === 'AbortError') {
                    throw new Error('OCR request timed out after 30 seconds');
                }
                throw error;
            }
            finally {
                clearTimeout(timeoutId);
            }
        },
    });
}
export function useEgyptianIDOCR() {
    const { actor } = useActor();
    return useMutation({
        mutationFn: async (imageData) => {
            if (!actor)
                throw new Error('Backend not available');
            // Convert blob to Uint8Array
            const arrayBuffer = await imageData.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            // First upload the image to get a path
            const path = `egyptian-id-${Date.now()}.jpg`;
            await actor.upload(path, 'image/jpeg', uint8Array, true);
            // Then call the OCR function
            const result = await actor.getEgyptianIdOcr(path);
            // Parse the JSON result
            return JSON.parse(result);
        },
    });
}
export function usePassportOCR() {
    const { actor } = useActor();
    return useMutation({
        mutationFn: async (imageData) => {
            if (!actor)
                throw new Error('Backend not available');
            // Convert blob to Uint8Array
            const arrayBuffer = await imageData.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            // First upload the image to get a path
            const path = `passport-${Date.now()}.jpg`;
            await actor.upload(path, 'image/jpeg', uint8Array, true);
            // Then call the OCR function
            const result = await actor.getPassportOcr(path);
            // Parse the JSON result
            return JSON.parse(result);
        },
    });
}
// New hooks for retrieving stored OCR results
export function useEgyptianIdResults() {
    const { actor, isFetching } = useActor();
    return useQuery({
        queryKey: ['egyptianIdResults'],
        queryFn: async () => {
            if (!actor)
                return [];
            const results = await actor.getAllEgyptianIdResults();
            return results.map(([path, data]) => [path, data]);
        },
        enabled: !!actor && !isFetching,
    });
}
export function usePassportResults() {
    const { actor, isFetching } = useActor();
    return useQuery({
        queryKey: ['passportResults'],
        queryFn: async () => {
            if (!actor)
                return [];
            const results = await actor.getAllPassportResults();
            return results.map(([path, data]) => [path, data]);
        },
        enabled: !!actor && !isFetching,
    });
}
export function useGetEgyptianIdResult(path) {
    const { actor, isFetching } = useActor();
    return useQuery({
        queryKey: ['egyptianIdResult', path],
        queryFn: async () => {
            if (!actor)
                return null;
            const result = await actor.getEgyptianIdResult(path);
            return result || null;
        },
        enabled: !!actor && !isFetching && !!path,
    });
}
export function useGetPassportResult(path) {
    const { actor, isFetching } = useActor();
    return useQuery({
        queryKey: ['passportResult', path],
        queryFn: async () => {
            if (!actor)
                return null;
            const result = await actor.getPassportResult(path);
            return result || null;
        },
        enabled: !!actor && !isFetching && !!path,
    });
}
