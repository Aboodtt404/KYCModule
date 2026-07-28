import { canisterId, createActor } from "@/declarations/sms_verification_backend/index";
import { AGENT_HOST } from "@/lib/agentHost";
import { useQuery } from "@tanstack/react-query";
export function useSmsVerificationActor() {
    const { data: actor, isLoading, error } = useQuery({
        queryKey: ["sms_verification_actor", canisterId],
        queryFn: async () => {
            if (!canisterId) {
                throw new Error("SMS verification backend canister ID not found. Make sure dfx is running and the canister is deployed.");
            }
            return await createActor(canisterId, { agentOptions: { host: AGENT_HOST } });
        },
        staleTime: Infinity,
        gcTime: Infinity,
        enabled: !!canisterId,
    });
    // E2E test hook — only exists in dev builds; Vite eliminates this branch in prod
    if (import.meta.env.DEV && typeof window !== "undefined" && window.__TEST_SMS_ACTOR__) {
        return { actor: window.__TEST_SMS_ACTOR__, isLoading: false, error: null };
    }
    // Demo mode — sandboxed mock actor (OTP code is fixed in demo)
    if (typeof window !== "undefined" && window.__DEMO_SMS_ACTOR__) {
        return { actor: window.__DEMO_SMS_ACTOR__, isLoading: false, error: null };
    }
    return { actor, isLoading, error };
}
