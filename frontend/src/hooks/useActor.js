import { createActor, canisterId } from "declarations/rust_backend";

const rustBackendActor = createActor(canisterId);

export const useActor = () => {
    return { actor: rustBackendActor, isLoading: false, isError: false };
};
