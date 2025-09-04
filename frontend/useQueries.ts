import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import { useFileList } from './FileList';
import { FileMetadata } from './types';

export function useDocuments() {
  const { actor, isFetching } = useActor();
  const { getFileList } = useFileList();

  return useQuery<FileMetadata[]>({
    queryKey: ['documents'],
    queryFn: async () => {
      if (!actor) return [];
      return await getFileList();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useOCRRatings() {
  const { actor, isFetching } = useActor();

  return useQuery<Array<[bigint, bigint]>>({
    queryKey: ['ocrRatings'],
    queryFn: async () => {
      if (!actor) return [];
      return await actor.getAllOcrRatings();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useRateOCR() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ docId, rating }: { docId: bigint; rating: bigint }) => {
      if (!actor) throw new Error('Backend not available');
      return await actor.rateOcrQuality(docId, rating);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ocrRatings'] });
    },
  });
}

export function useGetOCRRating(docId: bigint) {
  const { actor, isFetching } = useActor();

  return useQuery<bigint | null>({
    queryKey: ['ocrRating', docId.toString()],
    queryFn: async () => {
      if (!actor) return null;
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
    mutationFn: async (path: string) => {
      if (!actor) throw new Error('Backend not available');
      console.log('Attempting to delete file:', path);
      try {
        const result = await actor.delete(path); // Use 'delete' as shown in the generated interface
        console.log('Delete result:', result);
        return result;
      } catch (error) {
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
    mutationFn: async (imageData: Blob) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      try {
        const response = await fetch('http://localhost:5000/ocr', {
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
      } catch (error) {
        if (error.name === 'AbortError') {
          throw new Error('OCR request timed out after 30 seconds');
        }
        throw error;
      } finally {
        clearTimeout(timeoutId);
      }
    },
  });
}

export function useEgyptianIDOCR() {
  return useMutation({
    mutationFn: async (imageData: Blob) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for Egyptian ID

      try {
        const response = await fetch('http://localhost:5000/egyptian-id', {
          method: 'POST',
          body: imageData,
          headers: {
            'Content-Type': 'application/octet-stream'
          },
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`Egyptian ID OCR processing failed: ${response.status} ${response.statusText}`);
        }

        return await response.json();
      } catch (error) {
        if (error.name === 'AbortError') {
          throw new Error('Egyptian ID OCR request timed out after 60 seconds');
        }
        throw error;
      } finally {
        clearTimeout(timeoutId);
      }
    },
  });
}
