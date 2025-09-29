import { Actor, HttpAgent } from "@dfinity/agent";
import { useQuery } from "@tanstack/react-query";
import { idlFactory as backendIdlFactory } from "../../../src/declarations/backend";
import { _SERVICE as BackendService } from "../../../src/declarations/backend/backend.did";

const backendCanisterId = process.env.CANISTER_ID_BACKEND as string;
const host = process.env.DFX_NETWORK === "ic" ? "https://icp-api.io" : "http://127.0.0.1:4943";

const agent = new HttpAgent({ host });

// Fetch root key for development and test environments
if (process.env.DFX_NETWORK !== "ic") {
  agent.fetchRootKey().catch(err => {
    console.warn("Unable to fetch root key. Check to ensure that your local replica is running");
    console.error(err);
  });
}

const backendActor = Actor.createActor<BackendService>(backendIdlFactory, {
  agent,
  canisterId: backendCanisterId,
});


export const useActor = () => {
    return { actor: backendActor, isLoading: false, isError: false };
}

