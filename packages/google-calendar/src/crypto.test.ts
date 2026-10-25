import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decryptRefreshToken, encryptRefreshToken } from "./crypto";

beforeEach(() => vi.stubEnv("GOOGLE_TOKEN_ENC_KEY", Buffer.alloc(32, 7).toString("base64")));
afterEach(() => vi.unstubAllEnvs());

describe("Cifrado de refresh tokens", () => {
  it("recupera el token y usa un nonce distinto en cada cifrado", () => {
    const one = encryptRefreshToken("refresh-secret");
    expect(one).not.toContain("refresh-secret");
    expect(decryptRefreshToken(one)).toBe("refresh-secret");
    expect(encryptRefreshToken("refresh-secret")).not.toBe(one);
  });
  it("rechaza un ciphertext alterado", () => {
    const parts = encryptRefreshToken("refresh-secret").split(":");
    const bytes = Buffer.from(parts[3]!, "base64"); bytes[0] = bytes[0]! ^ 1; parts[3] = bytes.toString("base64");
    expect(() => decryptRefreshToken(parts.join(":"))).toThrow();
  });
  it("rechaza otra llave, un token sin cifrar y versiones desconocidas", () => {
    const token = encryptRefreshToken("refresh-secret");
    vi.stubEnv("GOOGLE_TOKEN_ENC_KEY", Buffer.alloc(32, 8).toString("base64"));
    expect(() => decryptRefreshToken(token)).toThrow();
    expect(() => decryptRefreshToken("refresh-secret")).toThrow();
    expect(() => decryptRefreshToken(token.replace("v1:", "v2:"))).toThrow();
  });
  it.each(["", "abc", Buffer.alloc(31).toString("base64")])("rechaza una llave inválida", (value) => {
    vi.stubEnv("GOOGLE_TOKEN_ENC_KEY", value);
    expect(() => encryptRefreshToken("secret")).toThrow();
  });
});
