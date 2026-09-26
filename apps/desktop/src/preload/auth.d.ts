import type {
  ElectronRequestAuthOptions,
  ElectronAuthenticateOptions,
} from '@better-auth/electron/client';

declare global {
  interface Window {
    getUser: () => Promise<unknown>;
    requestAuth: (options?: ElectronRequestAuthOptions) => Promise<void>;
    signOut: () => Promise<void>;
    authenticate: (data: ElectronAuthenticateOptions) => Promise<void>;
    onAuthenticated: (callback: (user: unknown) => void) => () => void;
    onUserUpdated: (callback: (user: unknown) => void) => () => void;
    onAuthError: (callback: (context: unknown) => void) => () => void;
  }
}

export {};
