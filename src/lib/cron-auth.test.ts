import { describe, it, expect } from "vitest";
import {
  extractCronSecret,
  verifyCronSecret,
  isAuthorizedCronRequest,
} from "./cron-auth";

const SECRET = "s3cr3t-cron-value-long-enough-32ch";

function headers(init: Record<string, string>): Headers {
  return new Headers(init);
}

describe("extractCronSecret", () => {
  it("reads x-cron-secret header", () => {
    expect(extractCronSecret(headers({ "x-cron-secret": SECRET }))).toBe(SECRET);
  });
  it("reads Bearer Authorization header", () => {
    expect(extractCronSecret(headers({ authorization: `Bearer ${SECRET}` }))).toBe(SECRET);
  });
  it("is case-insensitive on the Bearer prefix", () => {
    expect(extractCronSecret(headers({ authorization: `bearer ${SECRET}` }))).toBe(SECRET);
  });
  it("prefers x-cron-secret when both are present", () => {
    expect(
      extractCronSecret(
        headers({ "x-cron-secret": SECRET, authorization: "Bearer other" }),
      ),
    ).toBe(SECRET);
  });
  it("returns empty string when no header is present", () => {
    expect(extractCronSecret(headers({}))).toBe("");
  });
});

describe("verifyCronSecret", () => {
  it("accepts an exact match", () => {
    expect(verifyCronSecret(SECRET, SECRET)).toBe(true);
  });
  it("rejects a wrong secret of equal length", () => {
    const wrong = "x".repeat(SECRET.length);
    expect(verifyCronSecret(wrong, SECRET)).toBe(false);
  });
  it("rejects a wrong secret of different length", () => {
    expect(verifyCronSecret("short", SECRET)).toBe(false);
  });
  it("rejects an empty provided secret", () => {
    expect(verifyCronSecret("", SECRET)).toBe(false);
  });
  it("rejects when the expected secret is empty (unconfigured)", () => {
    expect(verifyCronSecret(SECRET, "")).toBe(false);
  });
});

describe("isAuthorizedCronRequest", () => {
  it("authorizes a valid x-cron-secret header", () => {
    expect(
      isAuthorizedCronRequest(headers({ "x-cron-secret": SECRET }), SECRET),
    ).toBe(true);
  });
  it("authorizes a valid Bearer Authorization header", () => {
    expect(
      isAuthorizedCronRequest(headers({ authorization: `Bearer ${SECRET}` }), SECRET),
    ).toBe(true);
  });
  it("rejects a missing header", () => {
    expect(isAuthorizedCronRequest(headers({}), SECRET)).toBe(false);
  });
  it("rejects a wrong x-cron-secret", () => {
    expect(
      isAuthorizedCronRequest(headers({ "x-cron-secret": "nope" }), SECRET),
    ).toBe(false);
  });
  it("rejects a wrong Bearer token", () => {
    expect(
      isAuthorizedCronRequest(
        headers({ authorization: "Bearer nope" }),
        SECRET,
      ),
    ).toBe(false);
  });
  it("rejects a non-Bearer Authorization scheme", () => {
    expect(
      isAuthorizedCronRequest(
        headers({ authorization: `Basic ${SECRET}` }),
        SECRET,
      ),
    ).toBe(false);
  });
  it("rejects when CRON_SECRET is not configured", () => {
    expect(
      isAuthorizedCronRequest(headers({ "x-cron-secret": SECRET }), ""),
    ).toBe(false);
  });
});
