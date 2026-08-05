import { describe, it, expect } from "vitest";
import { generateIdempotencyKey, isValidIdempotencyKey } from "./idempotency.js";

describe("Idempotency utilities", () => {
  describe("generateIdempotencyKey", () => {
    it("generates a valid UUID v4", () => {
      const key = generateIdempotencyKey();
      expect(isValidIdempotencyKey(key)).toBe(true);
    });

    it("generates unique keys", () => {
      const keys = new Set(Array.from({ length: 100 }, () => generateIdempotencyKey()));
      expect(keys.size).toBe(100);
    });
  });

  describe("isValidIdempotencyKey", () => {
    it("accepts valid UUID v4", () => {
      expect(isValidIdempotencyKey("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    });

    it("rejects empty string", () => {
      expect(isValidIdempotencyKey("")).toBe(false);
    });

    it("rejects non-UUID strings", () => {
      expect(isValidIdempotencyKey("not-a-uuid")).toBe(false);
    });

    it("rejects UUID v1 format", () => {
      // UUID v1 has version digit 1 in position 13
      expect(isValidIdempotencyKey("550e8400-e29b-11d4-a716-446655440000")).toBe(false);
    });
  });
});
