export const categories = [
  'All bounties',
  'Design',
  'Development',
  'Writing',
  'Research',
  'Community',
] as const;
export type Category = Exclude<(typeof categories)[number], 'All bounties'>;
export type Status =
  'open' | 'claimed' | 'submitted' | 'revision' | 'approved' | 'paid' | 'rejected' | 'cancelled';
export interface Evidence {
  note: string;
  url: string;
  files: { name: string; path: string; size: number }[];
  submittedAt: string;
}
export interface Payment {
  hash: string | null;
  state: 'ready' | 'pending' | 'confirmed' | 'uncertain';
  recipient: string;
  sender: string;
  reference: string;
  network: 'mainnet' | 'testnet';
  block?: number;
  intentId?: string;
}
export interface Task {
  id: string;
  title: string;
  description: string;
  category: Category;
  rewardLuna: number;
  minutes: number;
  deadline: string;
  creator: string;
  creatorName: string;
  avatar: string;
  status: Status;
  worker: string | null;
  requirements: string[];
  createdAt: string;
  evidence?: Evidence;
  feedback?: string;
  payment?: Payment;
  featured?: boolean;
}
export interface Profile {
  address: string;
  name: string;
  accounts: string[];
}
export type View = 'explore' | 'work' | 'create' | 'rewards';
export function nim(luna: number): string {
  return new Intl.NumberFormat('en', { maximumFractionDigits: 5 }).format(luna / 100_000);
}
export function toLuna(value: string): number {
  if (!/^\d+(\.\d{1,5})?$/.test(value.trim()))
    throw new Error('Use a positive NIM amount with up to 5 decimals.');
  const [whole, fraction = ''] = value.trim().split('.');
  const result = Number(whole) * 100_000 + Number(fraction.padEnd(5, '0'));
  if (!Number.isSafeInteger(result) || result <= 0 || result > 1_000_000_000_000)
    throw new Error('Enter a reward between 0.00001 and 10,000,000 NIM.');
  return result;
}
export function short(address: string): string {
  return address.startsWith('preview:')
    ? 'Preview account'
    : `${address.slice(0, 9)}…${address.slice(-4)}`;
}
export const statusLabels: Record<Status, string> = {
  open: 'Open',
  claimed: 'In progress',
  submitted: 'In review',
  revision: 'Revision requested',
  approved: 'Awaiting payment',
  paid: 'Paid',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};
