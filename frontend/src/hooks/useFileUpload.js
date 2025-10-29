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
    console.log(`[Uploader] Starting upload for: ${file.name}, size: ${file.size}`);

    const fileBuffer = await file.arrayBuffer();
    const totalChunks = Math.ceil(fileBuffer.byteLength / CHUNK_SIZE);
    console.log(`[Uploader] Splitting into ${totalChunks} chunks.`);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, fileBuffer.byteLength);
      const chunk = Array.from(new Uint8Array(fileBuffer.slice(start, end)));
      
      console.log(`[Uploader] Uploading chunk ${i + 1}/${totalChunks}`);
      await actor.upload(
        file.name,
        file.type || "application/octet-stream",
        chunk,
        true // Mark as complete since we are uploading the whole file at once for now
      );
    }
    console.log(`[Uploader] Finished uploading ${file.name}`);
  }, [actor]);

  const mutation = useMutation({
    mutationFn: uploadFile,
    onSuccess: (_, variables) => {
      console.log(`[Uploader] Successfully uploaded ${variables.name}. Invalidating 'documents' query.`);
      // When an upload is successful, invalidate the documents query 
      // so all components using it will refetch the latest list.
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (error, variables) => {
        console.error(`[Uploader] Error uploading ${variables.name}:`, error);
    }
  });

  const handleFileSelect = async (selectedFiles) => {
    if (!selectedFiles || selectedFiles.length === 0) return;
    console.log(`[Uploader] handleFileSelect called with ${selectedFiles.length} files.`);

    // We process uploads sequentially to avoid overwhelming the connection.
    try {
      for (const file of Array.from(selectedFiles)) {
        console.log(`[Uploader] Processing file in handleFileSelect: ${file.name}`);
        await mutation.mutateAsync(file);
      }
    } catch (e) {
      console.error('[Uploader] File upload process failed:', e);
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
