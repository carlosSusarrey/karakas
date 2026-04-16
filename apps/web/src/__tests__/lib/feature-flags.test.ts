import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isAiEnabled } from "@/lib/feature-flags";

describe("isAiEnabled", () => {
  const originalEnv = process.env.AI_ENABLED_USERS;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.AI_ENABLED_USERS;
    } else {
      process.env.AI_ENABLED_USERS = originalEnv;
    }
  });

  it("returns false when env var is not set", () => {
    delete process.env.AI_ENABLED_USERS;
    expect(isAiEnabled("alice")).toBe(false);
  });

  it("returns false when env var is empty", () => {
    process.env.AI_ENABLED_USERS = "";
    expect(isAiEnabled("alice")).toBe(false);
  });

  it("returns true when env var is *", () => {
    process.env.AI_ENABLED_USERS = "*";
    expect(isAiEnabled("alice")).toBe(true);
    expect(isAiEnabled("bob")).toBe(true);
  });

  it("returns true for listed username", () => {
    process.env.AI_ENABLED_USERS = "alice,bob";
    expect(isAiEnabled("alice")).toBe(true);
    expect(isAiEnabled("bob")).toBe(true);
  });

  it("returns false for unlisted username", () => {
    process.env.AI_ENABLED_USERS = "alice,bob";
    expect(isAiEnabled("carlos")).toBe(false);
  });

  it("is case insensitive", () => {
    process.env.AI_ENABLED_USERS = "Alice,BOB";
    expect(isAiEnabled("alice")).toBe(true);
    expect(isAiEnabled("ALICE")).toBe(true);
    expect(isAiEnabled("Bob")).toBe(true);
  });

  it("handles whitespace in env var", () => {
    process.env.AI_ENABLED_USERS = " alice , bob ";
    expect(isAiEnabled("alice")).toBe(true);
    expect(isAiEnabled("bob")).toBe(true);
  });

  it("handles single username", () => {
    process.env.AI_ENABLED_USERS = "carlos";
    expect(isAiEnabled("carlos")).toBe(true);
    expect(isAiEnabled("alice")).toBe(false);
  });
});
