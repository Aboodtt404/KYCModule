// Production-safe logger. In development (Vite dev server) logs are shown.
// In production builds (import.meta.env.PROD === true) all logs are silent.

const isDev = !import.meta.env.PROD;

export const log = {
  info:  (...args) => isDev && console.log('[KYC]',   ...args),
  warn:  (...args) => isDev && console.warn('[KYC]',  ...args),
  error: (...args) =>          console.error('[KYC]', ...args), // always show errors
  debug: (...args) => isDev && console.debug('[KYC]', ...args),
};
