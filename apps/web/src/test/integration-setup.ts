import { afterAll, beforeEach, vi } from "vitest";

import { closeTestDb, resetDb } from "@granola/db/testing";

import { RedirectSignal, TEST_CLIENT_IP } from "./next-mocks";

// --- Fronteras de Next.js (solo existen dentro de un request real) -------------
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectSignal(url);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": `${TEST_CLIENT_IP}, 10.0.0.1` }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
}));

// --- Cada test parte de una base vacía ------------------------------------------
beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

afterAll(async () => {
  await closeTestDb();
});
