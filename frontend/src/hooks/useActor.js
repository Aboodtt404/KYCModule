import { useAuth } from "@/contexts/AuthContext";
import { createActor, canisterId } from "declarations/rust_backend";

// Fallback anonymous actor for unauthenticated users (read-only / public calls)
const anonymousActor = canisterId ? createActor(canisterId) : null;

export const useActor = () => {
    const { actor, isAuthenticated } = useAuth();
    // E2E test hook — only exists in dev builds; Vite eliminates this branch in prod
    if (import.meta.env.DEV && typeof window !== "undefined" && window.__TEST_KYC_ACTOR__) {
        return { actor: window.__TEST_KYC_ACTOR__, isLoading: false, isError: false };
    }
    // Demo mode — sandboxed mock actor, never touches the real canister
    if (typeof window !== "undefined" && window.__DEMO_KYC_ACTOR__) {
        return { actor: window.__DEMO_KYC_ACTOR__, isLoading: false, isError: false };
    }
    // Use the authenticated actor when logged in, anonymous actor otherwise
    return {
        actor: (isAuthenticated && actor) ? actor : anonymousActor,
        isLoading: false,
        isError: false,
    };
};
