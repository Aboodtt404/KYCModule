import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from '@/hooks/useActor';
import { useFileList } from '@/components/shared/FileList';

export function useDocuments() {
  const { actor, isFetching } = useActor();
  const { getFileList } = useFileList();

  return useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      if (!actor) return [];
      console.log('[useDocuments] Refetching documents from canister...');
      return await getFileList();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useDeleteDocument() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (path) => {
      if (!actor) throw new Error('Backend not available');
      console.log('Attempting to delete file:', path);
      try {
        const result = await actor['delete'](path);
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
    mutationFn: async (imageData) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      try {
        const OCR_SERVER_URL = process.env.VITE_OCR_SERVER_URL || 'https://194.31.150.154:5000';
        const response = await fetch(`${OCR_SERVER_URL}/ocr`, {
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
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (imageData) => {
      if (!actor) throw new Error('Backend not available');

      const arrayBuffer = await imageData.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      const path = `egyptian-id-${Date.now()}.jpg`;
      await actor.upload(path, 'image/jpeg', uint8Array, true);

      const result = await actor.get_egyptian_id_ocr_and_save(path);
      return JSON.parse(result);
    },
  });
}

export function usePassportOCR() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (imageData) => {
      if (!actor) throw new Error('Backend not available');

      const arrayBuffer = await imageData.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      const path = `passport-${Date.now()}.jpg`;
      await actor.upload(path, 'image/jpeg', uint8Array, true);

      const result = await actor.get_passport_ocr_and_save(path);
      return JSON.parse(result);
    },
  });
}

export function useEgyptianIdResults() {
  const { actor, isFetching } = useActor();

  return useQuery({
    queryKey: ['egyptianIdResults'],
    queryFn: async () => {
      if (!actor) return [];
      const results = await actor.get_all_egyptian_id_results();
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
      if (!actor) return [];
      const results = await actor.get_all_passport_results();
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
      if (!actor) return null;
      const result = await actor.get_egyptian_id_result(path);
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
      if (!actor) return null;
      const result = await actor.get_passport_result(path);
      return result || null;
    },
    enabled: !!actor && !isFetching && !!path,
  });
}

// KYC Submissions
export function useSubmitKYC() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ submissionId, kycData }) => {
      if (!actor) throw new Error('Actor not available');
      // kycData is already wrapped in { kycData: {...} } from the frontend
      const jsonData = JSON.stringify(kycData);
      console.log('Submitting KYC:', jsonData);
      const result = await actor.submit_kyc(submissionId, jsonData);
      console.log('KYC submission result:', result);
      return { submissionId, kycData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kycSubmissions'] });
    },
  });
}

export function useKYCSubmissions() {
  const { actor, isFetching } = useActor();

  return useQuery({
    queryKey: ['kycSubmissions'],
    queryFn: async () => {
      if (!actor) return [];
      console.log('[useKYCSubmissions] Fetching submissions from canister...');
      const submissions = await actor.get_all_kyc_submissions();
      console.log('[useKYCSubmissions] Received submissions:', submissions);
      return submissions || [];
    },
    enabled: !!actor && !isFetching,
    refetchOnWindowFocus: true,
    refetchInterval: 10000, // Refetch every 10 seconds
  });
}

export function useDeleteKYCSubmission() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (submissionId) => {
      if (!actor) throw new Error('Actor not available');
      await actor.delete_kyc_submission(submissionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kycSubmissions'] });
    },
  });
}

export function useCheckDuplicateId() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (nationalId) => {
      if (!actor) throw new Error('Actor not available');
      return await actor.national_id_exists(nationalId);
    },
  });
}

// ===========================
// Verification Session Hooks
// ===========================

export function useCreateVerificationSession() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (sessionId) => {
      if (!actor) throw new Error('Actor not available');
      const result = await actor.create_verification_session(sessionId);
      if ('Err' in result) {
        throw new Error(result.Err);
      }
      return sessionId;
    },
  });
}

export function useVerificationStatus(sessionId) {
  const { actor } = useActor();

  return useQuery({
    queryKey: ['verificationStatus', sessionId],
    queryFn: async () => {
      if (!actor || !sessionId) return null;
      const statusJson = await actor.get_verification_status(sessionId);
      if (statusJson && statusJson.length > 0) {
        return JSON.parse(statusJson[0]);
      }
      return null;
    },
    enabled: !!actor && !!sessionId,
    refetchInterval: 2000, // Automatically refetch every 2 seconds
    refetchOnWindowFocus: true,
  });
}

export function useVerifySession() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (sessionId) => {
      if (!actor) return false;
      return await actor.verify_session(sessionId);
    },
  });
}

export function useMarkVerificationInProgress() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (sessionId) => {
      if (!actor) throw new Error('Actor not available');
      const result = await actor.mark_verification_in_progress(sessionId);
      if ('Err' in result) {
        throw new Error(result.Err);
      }
      return true;
    },
  });
}

export function useCompleteVerification() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async ({ sessionId, kycData }) => {
      if (!actor) throw new Error('Actor not available');
      const jsonData = JSON.stringify(kycData);
      const result = await actor.complete_verification(sessionId, jsonData);
      if ('Err' in result) {
        throw new Error(result.Err);
      }
      return true;
    },
  });
}
