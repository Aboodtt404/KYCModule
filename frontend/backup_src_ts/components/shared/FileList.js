import { useActor } from '../../../useActor';
import { canisterId } from '../../../../src/declarations/backend';
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
        return files.map(file => ({
            ...file,
            size: Number(file.size) // Convert bigint to number
        }));
    };
    const sanitizeUrl = (path) => {
        return path
            .trim() // Remove leading/trailing whitespace first
            .replace(/\s+/g, '-') // Replace all whitespace sequences with single hyphen
            .replace(/[^a-zA-Z0-9\-_./]/g, '') // Remove invalid characters
            .replace(/-+/g, '-') // Replace multiple consecutive hyphens with single hyphen
            .replace(/\.\./g, '') // Remove path traversal attempts
            .replace(/^[-\/]+/, '') // Remove leading hyphens and slashes
            .replace(/\/+/g, '/') // Normalize multiple slashes to single slash
            .replace(/[-\/]+$/, ''); // Remove trailing hyphens and slashes
    };
    const validateUrl = (path) => {
        const validPattern = /^(?!.*\.\.)(?!\/)(?!.*\s)[a-zA-Z0-9\-_.\/]+(?<!\/)$/;
        return validPattern.test(path);
    };
    const getFileUrl = async (metadata) => {
        const sanitizedPath = sanitizeUrl(metadata.path);
        validateUrl(metadata.path);
        const config = await loadConfig();
        let backendCanisterId = canisterId;
        if (config.backend_canister_id !== 'undefined') {
            backendCanisterId = config.backend_canister_id;
        }
        const rawBackendUrl = network === 'local'
            ? `http://${backendCanisterId}.raw.localhost:4943/`
            : `https://${backendCanisterId}.raw.icp0.io/`;
        return `${rawBackendUrl}${sanitizedPath}`;
    };
    return { getFileList, getFileUrl };
};
