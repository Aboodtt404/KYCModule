import { canisterId, createActor } from "@/declarations/sms_verification_backend/index";
import { useQuery } from "@tanstack/react-query";
export function useSmsVerificationActor() {
    const { data: actor, isLoading, error } = useQuery({
        queryKey: ["sms_verification_actor", canisterId],
        queryFn: async () => {
            if (!canisterId) {
                throw new Error("SMS verification backend canister ID not found. Make sure dfx is running and the canister is deployed.");
            }
            return await createActor(canisterId);
        },
        staleTime: Infinity,
        gcTime: Infinity,
        enabled: !!canisterId,
    });
    return { actor, isLoading, error };
}
