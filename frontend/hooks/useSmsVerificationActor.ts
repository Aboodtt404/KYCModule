import { createActor } from "@/declarations/sms_verification_backend/index";
import type { _SERVICE } from "@/declarations/sms_verification_backend/sms_verification_backend.did";
import { useQuery } from "@tanstack/react-query";

const canisterId = "uxrrr-q7777-77774-qaaaq-cai";

export function useSmsVerificationActor() {
  const { data: actor, isLoading } = useQuery({
    queryKey: ["sms_verification_actor"],
    queryFn: () => createActor(canisterId),
    staleTime: Infinity,
    cacheTime: Infinity,
    public: true,
  });

  return { actor, isLoading };
}