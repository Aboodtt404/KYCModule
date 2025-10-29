import { useActor } from '../../hooks/useActor';
import { canisterId } from 'declarations/rust_backend';
const network = 'local'; // Default to local for development
async function loadConfig() {
    try {
        const response = await fetch('./env.json');
        const config = await response.json();
        return config;
    }
    catch {
        const fallbackConfig = {
            backend_host: 'undefined',
            backend_canister_id: 'undefined'
        };
        return fallbackConfig;
    }
}
export const useFileList = () => {
    const { actor } = useActor();
    const getFileList = async () => {
        if (!actor) {
            throw new Error('Backend is not available');
        }
        const files = await actor.list();
        console.log("[useFileList] Raw files from canister:", files);

        const transformedFiles = files.map(file => ({
            path: file.path,
            mimeType: file.mime_type,
            size: Number(file.size)
        }));

        console.log("[useFileList] Transformed files:", transformedFiles);
        return transformedFiles;
    };
    const getFileUrl = async (metadata) => {
        // URL-encode the path to handle spaces and special characters
        const encodedPath = encodeURIComponent(metadata.path);
        
        const config = await loadConfig();
        let backendCanisterId = canisterId;
        if (config.backend_canister_id !== 'undefined') {
            backendCanisterId = config.backend_canister_id;
        }
        const rawBackendUrl = network === 'local'
            ? `http://${backendCanisterId}.raw.localhost:4943/`
            : `https://${backendCanisterId}.raw.icp0.io/`;
        return `${rawBackendUrl}${encodedPath}`;
    };
    return { getFileList, getFileUrl };
};
