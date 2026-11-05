import { describe, it, expect } from 'vitest';
import { KeyPair, Signature } from '@nimiq/core';
import {
  loginMessage,
  messageDigest,
  normalizeAddress,
  verifyWalletSignature,
} from '../server/security';
import { toLuna } from '../src/lib/types';
describe('wallet authentication', () => {
  const keys = KeyPair.generate(),
    address = keys.publicKey.toAddress().toUserFriendlyAddress();
  const message = loginMessage(
    'https://bountex.example',
    address,
    'testnet',
    'one-time-nonce',
    '2026-11-06T12:00:00Z',
  );
  const sig = Signature.create(keys.privateKey, keys.publicKey, messageDigest(message)).toHex();
  it('verifies the Nimiq-prefixed message and wallet ownership', () =>
    expect(verifyWalletSignature(address, message, keys.publicKey.toHex(), sig)).toBe(true));
  it('rejects a changed origin, nonce or network', () => {
    for (const change of ['bountex.example', 'one-time-nonce', 'testnet'])
      expect(
        verifyWalletSignature(
          address,
          message.replace(change, 'attacker'),
          keys.publicKey.toHex(),
          sig,
        ),
      ).toBe(false);
  });
  it('rejects a valid signature belonging to a different wallet', () => {
    const wrong = KeyPair.generate().publicKey.toAddress().toUserFriendlyAddress();
    expect(verifyWalletSignature(wrong, message, keys.publicKey.toHex(), sig)).toBe(false);
  });
  it('rejects signatures over unprefixed text', () => {
    const raw = Signature.create(
      keys.privateKey,
      keys.publicKey,
      new TextEncoder().encode(message),
    ).toHex();
    expect(verifyWalletSignature(address, message, keys.publicKey.toHex(), raw)).toBe(false);
  });
  it('rejects malformed keys and signatures', () =>
    expect(verifyWalletSignature(address, message, 'not-a-key', 'not-a-signature')).toBe(false));
  it('validates address checksums', () => {
    expect(normalizeAddress(address.replaceAll(' ', ''))).toBe(address);
    expect(() => normalizeAddress('NQ00 NOT A WALLET')).toThrow();
  });
});
describe('integer Luna conversion', () => {
  it('preserves the smallest reward without floating point rounding', () => {
    expect(toLuna('0.00001')).toBe(1);
    expect(toLuna('0.29')).toBe(29000);
    expect(toLuna('250.12345')).toBe(25012345);
  });
  it.each(['0', '-1', 'Infinity', '1.000001', '1e7', '1,000', '999999999999999999999999'])(
    'rejects invalid reward %s',
    (value) => expect(() => toLuna(value)).toThrow(),
  );
});
