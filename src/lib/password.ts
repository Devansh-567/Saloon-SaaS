# Copyright (c) 2026 Devansh Singh
# All Rights Reserved.
#
# This software and its source code are proprietary
# and confidential property of Guru AI Technologies.
#
# Unauthorized copying, modification, distribution,
# or use of this software, in whole or in part,
# is strictly prohibited without prior written
# permission from Guru AI Technologies.
 import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import bcrypt from "bcryptjs";

const SCRYPT_PREFIX = "scrypt";
const SCRYPT_COST = 2 ** 15;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELISM = 1;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const MAX_MEMORY_BYTES = 64 * 1024 * 1024;

function derive(password: string, salt: Buffer, options: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, { ...options, maxmem: MAX_MEMORY_BYTES }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt, { N: SCRYPT_COST, r: SCRYPT_BLOCK_SIZE, p: SCRYPT_PARALLELISM });
  return [SCRYPT_PREFIX, SCRYPT_COST, SCRYPT_BLOCK_SIZE, SCRYPT_PARALLELISM, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string) {
  if (!stored.startsWith(`${SCRYPT_PREFIX}$`)) return bcrypt.compare(password, stored);
  const [, cost, blockSize, parallelism, salt, expected] = stored.split("$");
  if (!cost || !blockSize || !parallelism || !salt || !expected) return false;
  const key = await derive(password, Buffer.from(salt, "base64url"), {
    N: Number(cost),
    r: Number(blockSize),
    p: Number(parallelism),
  });
  const expectedBytes = Buffer.from(expected, "base64url");
  return key.length === expectedBytes.length && timingSafeEqual(key, expectedBytes);
}

export function needsRehash(stored: string) {
  return !stored.startsWith(`${SCRYPT_PREFIX}$${SCRYPT_COST}$${SCRYPT_BLOCK_SIZE}$${SCRYPT_PARALLELISM}$`);
}

const dummyHash = hashPassword(randomBytes(16).toString("hex"));

export async function verifyDummyPassword(password: string) {
  return verifyPassword(password, await dummyHash);
}

