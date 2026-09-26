export interface UsageSnapshot { plan: 'free'|'pro'; questionsUsed: number; questionsLimit: number; runsUsed: number; runsLimit: number; }
export interface ApiAuthContext { userId: string; plan: UsageSnapshot['plan']; }
