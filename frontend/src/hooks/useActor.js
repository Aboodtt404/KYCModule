import { createActor } from "declarations/rust_backend";

const RUST_BACKEND_CANISTER_ID = "u6s2n-gx777-77774-qaaba-cai";

const rustBackendActor = createActor(RUST_BACKEND_CANISTER_ID);

export const useActor = () => {
    return { actor: rustBackendActor, isLoading: false, isError: false };
};
