import { createActor } from "@/declarations/sms_verification_backend/index";
import type { _SERVICE } from "@/declarations/sms_verification_backend/sms_verification_backend.did";
import { useQuery } from "@tanstack/react-query";

const canisterId = "uzt4z-lp777-77774-qaabq-cai";

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