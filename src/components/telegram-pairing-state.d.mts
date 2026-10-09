export const BOT: string;
export function validToken(t: unknown): boolean;
export function pairingLink(token: string): string;
export function alive(expiresAt: string, now?: number): boolean;
export function pendingReady(p: unknown, now?: number): boolean;
export function createResult(r: unknown): string;
