import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function createDeviceToken() {
  return `mm_${randomBytes(32).toString("base64url")}`;
}

export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  const size = Math.max(a.length, b.length, 1);
  const paddedA = Buffer.alloc(size);
  const paddedB = Buffer.alloc(size);
  a.copy(paddedA);
  b.copy(paddedB);
  return timingSafeEqual(paddedA, paddedB) && a.length === b.length;
}
