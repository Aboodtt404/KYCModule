import { useState, useCallback } from 'react';
import { useActor } from './useActor';
import { useQueryClient, useMutation } from '@tanstack/react-query';

const CHUNK_SIZE = 1024 * 500; // 500kb

export function useFileUpload() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  const uploadFile = useCallback(async (file) => {
    if (!actor) {
      throw new Error('Actor not available');
    }

    const fileBuffer = await file.arrayBuffer();
    const totalChunks = Math.ceil(fileBuffer.byteLength / CHUNK_SIZE);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, fileBuffer.byteLength);
      const chunk = Array.from(new Uint8Array(fileBuffer.slice(start, end)));

      await actor.upload(
        file.name,
        file.type || "application/octet-stream",
        chunk,
        true // Mark as complete since we are uploading the whole file at once for now
      );
    }
  }, [actor]);

  const mutation = useMutation({
    mutationFn: uploadFile,
    onSuccess: (_, variables) => {
      // When an upload is successful, invalidate the documents query
      // so all components using it will refetch the latest list.
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: () => {},
  });

  const handleFileSelect = async (selectedFiles) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    // We process uploads sequentially to avoid overwhelming the connection.
    try {
      for (const file of Array.from(selectedFiles)) {
        await mutation.mutateAsync(file);
      }
    } catch (e) {
      // Re-throw the error so the calling component knows about it
      throw new Error('File upload failed. Please try again.');
    }
  };

  return {
    handleFileSelect,
    isUploading: mutation.isPending,
    error: mutation.error,
  };
}
