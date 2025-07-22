/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_DFX_NETWORK?: string;
    MODE: string; // Removed readonly to match the existing declaration
}
  
interface ImportMeta {
    readonly env: ImportMetaEnv;
}
  