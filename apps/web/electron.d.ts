export {};

declare global {
  interface Window {
    requestAuth?: (options?: {
      provider?: string;
    }) => Promise<void>;
  }
}
