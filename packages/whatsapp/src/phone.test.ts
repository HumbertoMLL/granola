import { describe, expect, it } from "vitest";
import { fromWaId, normalizePhoneMx, toWaId } from "./phone";

describe("normalizePhoneMx", () => {
  it("acepta 10 dígitos con espacios, guiones y paréntesis", () => {
    expect(normalizePhoneMx("33 1234 5678")).toBe("+523312345678");
    expect(normalizePhoneMx("(55) 1234-5678")).toBe("+525512345678");
    expect(normalizePhoneMx("5512345678")).toBe("+525512345678");
  });

  it("acepta +52 con y sin el 1 viejo de celular", () => {
    expect(normalizePhoneMx("+52 33 1234 5678")).toBe("+523312345678");
    expect(normalizePhoneMx("+52 1 33 1234 5678")).toBe("+523312345678");
    expect(normalizePhoneMx("52133 1234 5678")).toBe("+523312345678");
    expect(normalizePhoneMx("523312345678")).toBe("+523312345678");
  });

  it("quita prefijos nacionales 01 / 044 / 045 y el 1 suelto", () => {
    expect(normalizePhoneMx("044 33 1234 5678")).toBe("+523312345678");
    expect(normalizePhoneMx("045 55 1234 5678")).toBe("+525512345678");
    expect(normalizePhoneMx("01 33 1234 5678")).toBe("+523312345678");
    expect(normalizePhoneMx("1 33 1234 5678")).toBe("+523312345678");
  });

  it("acepta prefijo internacional 00", () => {
    expect(normalizePhoneMx("0052 33 1234 5678")).toBe("+523312345678");
  });

  it("rechaza basura", () => {
    expect(normalizePhoneMx("")).toBeNull();
    expect(normalizePhoneMx(null)).toBeNull();
    expect(normalizePhoneMx("12345")).toBeNull();
    expect(normalizePhoneMx("0312345678")).toBeNull(); // lada no puede empezar en 0
    expect(normalizePhoneMx("+1 415 555 2671")).toBeNull(); // no es MX
    expect(normalizePhoneMx("+52 33 1234 567")).toBeNull();
  });

  it("toWaId / fromWaId", () => {
    expect(toWaId("+523312345678")).toBe("523312345678");
    expect(fromWaId("523312345678")).toBe("+523312345678");
    expect(fromWaId("5213312345678")).toBe("+523312345678");
  });
});
