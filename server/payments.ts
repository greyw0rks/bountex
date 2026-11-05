import { AppError, normalizeAddress } from './security.js';
export interface PaymentIntent {
  id: string;
  task_id: string;
  creator: string;
  sender: string;
  recipient: string;
  reward_luna: number;
  reference: string;
  network: 'mainnet' | 'testnet';
  state: 'ready' | 'uncertain' | 'pending' | 'confirmed';
  hash: string | null;
  block: number | null;
  created_at: string;
}
export interface RpcTransaction {
  hash: string;
  from: string;
  to: string;
  value: number;
  recipientData: string;
  networkId: number;
  executionResult: boolean;
  blockNumber?: number;
  timestamp?: number;
  confirmations?: number;
}
export interface RpcBlock {
  number: number;
  type: 'macro' | 'micro';
  network: string | number;
  timestamp: number;
  hash: string;
}
export const networkId = (network: 'mainnet' | 'testnet') => (network === 'mainnet' ? 24 : 5);
function assertNetwork(actual: string | number, network: 'mainnet' | 'testnet'): void {
  if (
    actual !== networkId(network) &&
    actual !== (network === 'mainnet' ? 'MainAlbatross' : 'TestAlbatross')
  )
    throw new AppError('The verification node is on a different network.', 503);
}
export async function rpc<T>(method: string, params: unknown[] = []): Promise<T> {
  const url = process.env.NIMIQ_RPC_URL;
  if (!url) throw new AppError('Payment verification has not been configured.', 503);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (process.env.NIMIQ_RPC_USERNAME)
    headers.Authorization = `Basic ${Buffer.from(process.env.NIMIQ_RPC_USERNAME + ':' + (process.env.NIMIQ_RPC_PASSWORD || '')).toString('base64')}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    throw new AppError('Nimiq verification is unavailable. Your payment remains pending.', 503);
  }
  if (!response.ok)
    throw new AppError('Nimiq verification is unavailable. Please check again later.', 503);
  let result: {
    error?: { code: number; message: string };
    result?: { data: T; metadata?: unknown } | T;
  };
  try {
    result = await response.json();
  } catch {
    throw new AppError('Nimiq returned an incomplete verification result.', 503);
  }
  if (result.error)
    throw new AppError(
      method === 'getTransactionByHash'
        ? 'Transaction not found yet. Your payment remains pending.'
        : 'Nimiq could not verify this request.',
      409,
    );
  const value = result.result;
  const data = value && typeof value === 'object' && 'data' in value ? value.data : value;
  if (data === undefined || data === null)
    throw new AppError('Nimiq returned an incomplete verification result.', 503);
  return data as T;
}
async function readHead(network: 'mainnet' | 'testnet'): Promise<RpcBlock> {
  // Public history nodes expose the network in block headers; getNetworkId may be blocked.
  const head = await rpc<RpcBlock>('getLatestBlock', [false]);
  assertNetwork(head.network, network);
  if (
    !Number.isSafeInteger(head.number) ||
    head.number < 0 ||
    !['macro', 'micro'].includes(head.type)
  )
    throw new AppError('Nimiq returned an invalid block height.', 503);
  return head;
}
async function macroHeightFor(head: RpcBlock): Promise<number> {
  // Ask the node's policy: testnet's genesis offsets its macro blocks from height zero.
  const height =
    head.type === 'macro' ? head.number : await rpc<number>('getLastMacroBlock', [head.number]);
  if (!Number.isSafeInteger(height) || height < 0 || height > head.number)
    throw new AppError('Nimiq returned an invalid checkpoint height.', 503);
  return height;
}
async function readCheckpoint(height: number, network: 'mainnet' | 'testnet'): Promise<void> {
  const checkpoint = await rpc<RpcBlock>('getBlockByNumber', [height, false]);
  assertNetwork(checkpoint.network, network);
  if (checkpoint.type !== 'macro' || checkpoint.number !== height)
    throw new AppError('A finalized checkpoint is not available yet.', 409);
}
let readiness: { url: string; network: string; expires: number; ready: boolean } | undefined;
export async function paymentBackendReady(network: 'mainnet' | 'testnet'): Promise<boolean> {
  const url = process.env.NIMIQ_RPC_URL;
  if (!url) return false;
  if (readiness?.url === url && readiness.network === network && readiness.expires > Date.now())
    return readiness.ready;
  let ready = false;
  try {
    const head = await readHead(network);
    await readCheckpoint(await macroHeightFor(head), network);
    ready = true;
  } catch {
    /* An unavailable or incompatible node cannot enable payouts. */
  }
  readiness = { url, network, expires: Date.now() + 10_000, ready };
  return ready;
}
export async function verifySender(
  accounts: string[],
  creator: string,
  network: 'mainnet' | 'testnet',
): Promise<string> {
  const addresses = accounts.map(normalizeAddress);
  if (addresses[0] !== creator)
    throw new AppError(
      'Your active wallet differs from the account that created this bounty.',
      403,
    );
  await readHead(network);
  if (addresses.length === 1) return creator;
  // Nimiq Pay rotates its spending HTLC. Never trust the extra address from the client alone.
  const contract = await rpc<{
    address: string;
    type: string;
    sender?: string;
    recipient?: string;
  }>('getAccountByAddress', [addresses[1]]);
  if (
    normalizeAddress(contract.address) !== addresses[1] ||
    contract.type.toLowerCase() !== 'htlc' ||
    ((!contract.sender || normalizeAddress(contract.sender) !== creator) &&
      (!contract.recipient || normalizeAddress(contract.recipient) !== creator))
  )
    throw new AppError(
      'This spending contract could not be linked to your wallet. Reconnect Nimiq Pay.',
      403,
    );
  return addresses[1];
}
export function validateTransaction(tx: RpcTransaction, intent: PaymentIntent): void {
  if (tx.hash.toLowerCase() !== intent.hash?.toLowerCase())
    throw new AppError('The transaction hash does not match the payout.');
  if (tx.executionResult !== true)
    throw new AppError(
      'This transaction did not execute successfully. The reward is still unpaid.',
      409,
    );
  if (normalizeAddress(tx.from) !== intent.sender || normalizeAddress(tx.to) !== intent.recipient)
    throw new AppError('The payment sender or recipient does not match this bounty.');
  if (tx.networkId !== networkId(intent.network))
    throw new AppError('This payment is on a different Nimiq network.');
  if (!Number.isSafeInteger(tx.value) || tx.value !== intent.reward_luna)
    throw new AppError('The payment amount does not match the agreed reward.');
  if (
    !/^(?:[0-9a-f]{2})*$/i.test(tx.recipientData) ||
    Buffer.from(tx.recipientData, 'hex').toString('utf8') !== intent.reference
  )
    throw new AppError('The payment reference does not match this bounty.');
  if (!Number.isInteger(tx.blockNumber) || !tx.timestamp)
    throw new AppError('The transaction has not been included in a block yet.', 409);
  if (tx.timestamp < new Date(intent.created_at).getTime() - 60_000)
    throw new AppError('This transaction predates the payout intent.');
}
export async function verifyPayout(
  intent: PaymentIntent,
): Promise<{ confirmed: boolean; block: number }> {
  if (!intent.hash) throw new AppError('A transaction hash is needed to verify this payment.');
  const tx = await rpc<RpcTransaction>('getTransactionByHash', [intent.hash]);
  validateTransaction(tx, intent);
  const head = await readHead(intent.network);
  const macroHeight = await macroHeightFor(head);
  if (macroHeight < tx.blockNumber!) return { confirmed: false, block: tx.blockNumber! };
  await readCheckpoint(macroHeight, intent.network);
  // Re-fetch after the checkpoint to ensure the transaction is still on the canonical chain.
  const final = await rpc<RpcTransaction>('getTransactionByHash', [intent.hash]);
  validateTransaction(final, intent);
  if (final.blockNumber !== tx.blockNumber)
    throw new AppError('The payment moved blocks. Check again after the next checkpoint.', 409);
  return { confirmed: true, block: final.blockNumber! };
}
