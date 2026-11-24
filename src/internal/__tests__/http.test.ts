import { expect, it } from "bun:test";
import { isHostAllowed } from "../http";

it("should only allow loopback hosts unless allowedHosts says otherwise", () => {
  for (const host of [
    "localhost:3000",
    "a.localhost",
    "127.0.0.1",
    "[::1]:3000",
  ]) {
    expect(isHostAllowed(host, undefined)).toBe(true);
  }
  for (const host of ["evil.com", "192.168.1.5:3000", ""]) {
    expect(isHostAllowed(host, undefined)).toBe(false);
  }
  expect(isHostAllowed("evil.com", true)).toBe(true);
  expect(isHostAllowed("a.example.com", [".example.com"])).toBe(true);
  expect(isHostAllowed("badexample.com", [".example.com"])).toBe(false);
});
