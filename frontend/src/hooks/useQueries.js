import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from '@/hooks/useActor';
import { useFileList } from '@/components/shared/FileList';
import { log } from '@/lib/logger';

export function useDocuments() {
  const { actor, isFetching } = useActor();
  const { getFileList } = useFileList();

  return useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      if (!actor) return [];
      log.debug('Fetching documents from canister...');
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
      log.debug('Deleting file:', path);
      try {
        const result = await actor['delete'](path);
        log.debug('Delete result:', result);
        return result;
      } catch (error) {
        throw error;
      }
    },
    onSuccess: (data, path) => {
      log.debug('Delete successful for:', path);
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: () => {},
  });
}

export function useOCR() {
  return useMutation({
    mutationFn: async (imageData) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      try {
        const OCR_SERVER_URL = process.env.VITE_OCR_SERVER_URL || '';
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
      const result = await actor.submit_kyc(submissionId, jsonData);
      if (result && 'Err' in result) throw new Error(result.Err);
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
      return await actor.get_all_kyc_submissions() || [];
    },
    enabled: !!actor && !isFetching,
    refetchOnWindowFocus: false,
    refetchInterval: false,   // full dump — only fetch when explicitly needed (CSV export)
  });
}

export function useKYCSubmissionsPage(limit, offset) {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ['kycSubmissionsPage', limit, offset],
    queryFn: async () => {
      if (!actor) return { total: 0, items: [] };
      const [total, items] = await actor.get_kyc_submissions_page(BigInt(limit), BigInt(offset));
      return { total: Number(total), items: items || [] };
    },
    enabled: !!actor && !isFetching,
    keepPreviousData: true,   // don't flash empty while loading next page
    refetchInterval: 15000,
  });
}

export function useDeleteKYCSubmission() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (submissionId) => {
      if (!actor) throw new Error('Actor not available');
      const result = await actor.delete_kyc_submission(submissionId);
      if (result && 'Err' in result) throw new Error(result.Err);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kycSubmissions'] });
    },
  });
}

export function useUpdateKYCStatus() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ submissionId, status }) => {
      if (!actor) throw new Error('Actor not available');
      const result = await actor.update_kyc_status(submissionId, status);
      if (result && 'Err' in result) throw new Error(result.Err);
      // Ok value is a bool: true = email sent, false = email failed
      const emailSent = result && 'Ok' in result ? result.Ok : false;
      return { submissionId, status, emailSent };
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
