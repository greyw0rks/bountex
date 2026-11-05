import { afterEach, describe, expect, it, vi } from 'vitest';
import { KeyPair, Policy } from '@nimiq/core';
import {
  validateTransaction,
  verifyPayout,
  verifySender,
  paymentBackendReady,
  type PaymentIntent,
  type RpcTransaction,
} from '../server/payments';
const creator = KeyPair.generate().publicKey.toAddress().toUserFriendlyAddress(),
  worker = KeyPair.generate().publicKey.toAddress().toUserFriendlyAddress(),
  htlc = KeyPair.generate().publicKey.toAddress().toUserFriendlyAddress();
const intent: PaymentIntent = {
  id: 'intent',
  task_id: 'task',
  creator,
  sender: htlc,
  recipient: worker,
  reward_luna: 25000000,
  reference: 'BXT:unique-task',
  network: 'testnet',
  state: 'pending',
  hash: 'a'.repeat(64),
  block: null,
  created_at: new Date(Date.now() - 60_000).toISOString(),
};
const block = Policy.BLOCKS_PER_BATCH - 1;
const tx: RpcTransaction = {
  hash: intent.hash!,
  from: htlc,
  to: worker,
  value: 25000000,
  recipientData: Buffer.from(intent.reference).toString('hex'),
  networkId: 5,
  executionResult: true,
  blockNumber: block,
  timestamp: Date.now(),
  confirmations: 1,
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
function rpcMock(resolve: (method: string, params: unknown[]) => unknown) {
  vi.stubEnv('NIMIQ_RPC_URL', `http://rpc.example/${crypto.randomUUID()}`);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url, opts) => {
      const { method, params } = JSON.parse(opts.body);
      return new Response(
        JSON.stringify({ jsonrpc: '2.0', id: 1, result: { data: resolve(method, params) } }),
        { status: 200 },
      );
    }),
  );
}
describe('payment verification', () => {
  it('accepts the exact reward from the frozen spending HTLC', () =>
    expect(() => validateTransaction(tx, intent)).not.toThrow());
  it.each([
    { hash: 'b'.repeat(64) },
    { from: worker },
    { to: creator },
    { value: 1 },
    { executionResult: false },
    { networkId: 24 },
    { recipientData: Buffer.from('BXT:another-task').toString('hex') },
    { blockNumber: undefined },
    { timestamp: 1 },
  ])('rejects mismatched or unsuccessful payments %j', (patch) =>
    expect(() => validateTransaction({ ...tx, ...patch }, intent)).toThrow(),
  );
  it('does not treat one micro-block confirmation as finality', async () => {
    rpcMock((m) =>
      m === 'getTransactionByHash'
        ? tx
        : m === 'getLastMacroBlock'
          ? 0
          : { number: block, type: 'micro', network: 'TestAlbatross' },
    );
    expect(await verifyPayout(intent)).toEqual({ confirmed: false, block });
  });
  it('confirms only after a canonical macro checkpoint', async () => {
    rpcMock((m) =>
      m === 'getTransactionByHash'
        ? tx
        : { number: block + 1, type: 'macro', network: 'TestAlbatross' },
    );
    expect(await verifyPayout(intent)).toEqual({ confirmed: true, block });
  });
  it('keeps reorganized transactions pending', async () => {
    let calls = 0;
    rpcMock((m) =>
      m === 'getTransactionByHash'
        ? { ...tx, blockNumber: ++calls === 1 ? block : block - 1 }
        : { number: block + 1, type: 'macro', network: 'TestAlbatross' },
    );
    await expect(verifyPayout(intent)).rejects.toThrow('moved blocks');
  });
  it('requires a valid RPC result rather than trusting the client hash', async () => {
    rpcMock(() => null);
    await expect(verifyPayout(intent)).rejects.toThrow();
  });
  it('uses the testnet genesis offset when a micro head has crossed a macro checkpoint', async () => {
    const included = 15_972_140;
    rpcMock((m, params) => {
      if (m === 'getTransactionByHash') return { ...tx, blockNumber: included };
      if (m === 'getLatestBlock')
        return { number: 15_972_170, type: 'micro', network: 'TestAlbatross' };
      if (m === 'getLastMacroBlock') {
        expect(params).toEqual([15_972_170]);
        return 15_972_150;
      }
      expect(m).toBe('getBlockByNumber');
      expect(params).toEqual([15_972_150, false]);
      return { number: 15_972_150, type: 'macro', network: 'TestAlbatross' };
    });
    expect(await verifyPayout(intent)).toEqual({ confirmed: true, block: included });
  });
  it('rejects a checkpoint on another network', async () => {
    rpcMock((m) =>
      m === 'getTransactionByHash'
        ? tx
        : {
            number: block + 1,
            type: 'macro',
            network: m === 'getLatestBlock' ? 'TestAlbatross' : 'MainAlbatross',
          },
    );
    await expect(verifyPayout(intent)).rejects.toThrow('different network');
  });
  it.each([-1, block + 10, '60', null])(
    'rejects an invalid checkpoint policy result %j',
    async (height) => {
      rpcMock((m) =>
        m === 'getTransactionByHash'
          ? tx
          : m === 'getLastMacroBlock'
            ? height
            : { number: block + 2, type: 'micro', network: 'TestAlbatross' },
      );
      await expect(verifyPayout(intent)).rejects.toThrow();
    },
  );
});
describe('spending contract ownership', () => {
  it('uses the basic wallet when no contract is listed', async () => {
    rpcMock((m) => {
      expect(m).toBe('getLatestBlock');
      return { number: block + 1, type: 'macro', network: 'TestAlbatross' };
    });
    expect(await verifySender([creator], creator, 'testnet')).toBe(creator);
  });
  it('checks a rotating HTLC on-chain before trusting it', async () => {
    rpcMock((m) =>
      m === 'getLatestBlock'
        ? { number: block + 1, type: 'macro', network: 'TestAlbatross' }
        : { address: htlc, type: 'htlc', sender: creator, recipient: worker },
    );
    expect(await verifySender([creator, htlc], creator, 'testnet')).toBe(htlc);
  });
  it('rejects a contract belonging to someone else', async () => {
    rpcMock((m) =>
      m === 'getLatestBlock'
        ? { number: block + 1, type: 'macro', network: 'TestAlbatross' }
        : { address: htlc, type: 'htlc', sender: worker, recipient: worker },
    );
    await expect(verifySender([creator, htlc], creator, 'testnet')).rejects.toThrow(
      'could not be linked',
    );
  });
  it('rejects a node on the wrong network', async () => {
    rpcMock(() => ({ number: block + 1, type: 'macro', network: 'MainAlbatross' }));
    await expect(verifySender([creator], creator, 'testnet')).rejects.toThrow('different network');
  });
});
describe('payment backend readiness', () => {
  it('requires a canonical checkpoint on the configured network', async () => {
    rpcMock(() => ({ number: block + 1, type: 'macro', network: 'TestAlbatross' }));
    expect(await paymentBackendReady('testnet')).toBe(true);
    expect(await paymentBackendReady('mainnet')).toBe(false);
  });
  it('keeps payouts unavailable when the node returns a micro checkpoint', async () => {
    rpcMock((m) =>
      m === 'getLastMacroBlock'
        ? block + 1
        : {
            number: m === 'getLatestBlock' ? block + 2 : block + 1,
            type: 'micro',
            network: 'TestAlbatross',
          },
    );
    expect(await paymentBackendReady('testnet')).toBe(false);
  });
  it('keeps payouts unavailable for an HTML documentation URL', async () => {
    vi.stubEnv('NIMIQ_RPC_URL', 'http://rpc.example/documentation');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>RPC docs</html>')),
    );
    expect(await paymentBackendReady('testnet')).toBe(false);
  });
});
