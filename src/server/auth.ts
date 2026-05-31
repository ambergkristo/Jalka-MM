import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const keyLength = 64;

export async function hashSecret(secret: string): Promise<string> {
  assertSecret(secret);
  const salt = randomBytes(16).toString('base64url');
  const key = (await scrypt(secret, salt, keyLength)) as Buffer;
  return `scrypt$${salt}$${key.toString('base64url')}`;
}

export async function verifySecret(secret: string, storedHash: unknown): Promise<boolean> {
  if (typeof storedHash !== 'string' || !storedHash.startsWith('scrypt$')) return false;
  const [, salt, expected] = storedHash.split('$');
  if (!salt || !expected) return false;
  const actual = (await scrypt(secret, salt, keyLength)) as Buffer;
  const expectedBuffer = Buffer.from(expected, 'base64url');
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}

export function assertSecret(secret: string): void {
  if (typeof secret !== 'string' || secret.length < 6) throw new Error('Password must be at least 6 characters');
}

export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string, sessionSecret: string): string {
  return createHmac('sha256', sessionSecret).update(token).digest('base64url');
}

export function normalizeNamePart(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizedFullName(firstName: string, lastName: string): string {
  return `${normalizeNamePart(firstName)} ${normalizeNamePart(lastName)}`.toLocaleLowerCase('et-EE');
}
