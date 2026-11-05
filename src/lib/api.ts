import type { Task, Profile, Payment } from './types';
import { getHostNetwork, init, type NimiqProvider } from '@nimiq/mini-app-sdk';
export async function request<T>(path: string, body?: unknown, method?: string): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method: method ?? (body ? 'POST' : 'GET'),
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({ error: 'The server could not be reached.' }));
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data as T;
}
let wallet: NimiqProvider | undefined;
export async function connectWallet(): Promise<Profile> {
  wallet = await init({ timeout: 2500 });
  const accounts = await wallet.listAccounts();
  if (!accounts[0]) throw new Error('No Nimiq account was shared. Try connecting again.');
  const challenge = await request<{ id: string; message: string }>('auth/challenge', {
    address: accounts[0],
    network: getHostNetwork(),
  });
  const signed = await wallet.sign(challenge.message);
  return request<Profile>('auth/verify', { challengeId: challenge.id, ...signed });
}
export async function getWalletAccounts(): Promise<string[]> {
  wallet ??= await init({ timeout: 2500 });
  return wallet.listAccounts();
}
export async function sendReward(payment: Payment, rewardLuna: number): Promise<string> {
  wallet ??= await init({ timeout: 2500 });
  const hostNetwork = getHostNetwork();
  if (!hostNetwork || hostNetwork !== payment.network)
    throw new Error(
      'Your Nimiq Pay network does not match this payout. Reopen the app on the configured network.',
    );
  if (!(await wallet.isConsensusEstablished()))
    throw new Error('Nimiq is still connecting. Please try again in a moment.');
  const hash = await wallet.sendBasicTransactionWithData({
    recipient: payment.recipient,
    value: rewardLuna,
    data: payment.reference,
  });
  if (!/^[a-f0-9]{64}$/i.test(hash))
    throw new Error('Payment outcome unknown. Check Nimiq Pay before retrying.');
  return hash;
}
export async function prepareReward(payment: Payment): Promise<void> {
  wallet ??= await init({ timeout: 2500 });
  if (getHostNetwork() !== payment.network)
    throw new Error('Your Nimiq Pay network does not match this payout.');
  if (!(await wallet.isConsensusEstablished()))
    throw new Error('Nimiq is still connecting. Please try again in a moment.');
}
export { NimiqProviderError } from '@nimiq/mini-app-sdk';
export const api = {
  config: () =>
    request<{ configured: boolean; network: 'mainnet' | 'testnet'; paymentsReady: boolean }>(
      'config',
    ),
  tasks: () => request<Task[]>('tasks'),
  me: () => request<Profile>('auth/me'),
  logout: () => request('auth/logout', {}),
  create: (body: unknown) => request<Task>('tasks', body),
  action: (id: string, action: string, body = {}) => request<Task>(`tasks/${id}/${action}`, body),
  upload: async (taskId: string, file: File) => {
    const ticket = await request<{ token: string; path: string; url: string }>(
      `tasks/${taskId}/upload`,
      { name: file.name, size: file.size, type: file.type },
    );
    const response = await fetch(ticket.url, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'false' },
      body: file,
    });
    if (!response.ok) throw new Error('The evidence upload failed. Your draft is still here.');
    return { name: file.name, path: ticket.path, size: file.size };
  },
  evidenceUrl: (id: string, path: string) =>
    request<{ url: string }>(`tasks/${id}/evidence-url`, { path }),
};
