import { createHash, randomBytes } from 'node:crypto';
import { Address, PublicKey, Signature } from '@nimiq/core';
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
export const token = () => randomBytes(32).toString('hex');
export function normalizeAddress(value: string): string {
  try {
    return Address.fromString(value).toUserFriendlyAddress();
  } catch {
    throw new AppError('Enter a valid Nimiq wallet address.');
  }
}
export function messageDigest(message: string): Uint8Array {
  const bytes = Buffer.from(message, 'utf8');
  return createHash('sha256')
    .update(
      Buffer.concat([Buffer.from('\x16Nimiq Signed Message:\n' + bytes.byteLength, 'utf8'), bytes]),
    )
    .digest();
}
export function verifyWalletSignature(
  address: string,
  message: string,
  publicKey: string,
  signature: string,
): boolean {
  if (!/^[a-f\d]{64}$/i.test(publicKey) || !/^[a-f\d]{128}$/i.test(signature)) return false;
  try {
    const key = PublicKey.fromHex(publicKey);
    return (
      key.toAddress().toUserFriendlyAddress() === normalizeAddress(address) &&
      key.verify(Signature.fromHex(signature), messageDigest(message))
    );
  } catch {
    return false;
  }
}
export function loginMessage(
  origin: string,
  address: string,
  network: string,
  nonce: string,
  expires: string,
) {
  return `Bountex sign-in\n\nOrigin: ${origin}\nWallet: ${address}\nNetwork: ${network}\nNonce: ${nonce}\nExpires: ${expires}\n\nSign this message to access your tasks. This does not authorize a payment.`;
}
