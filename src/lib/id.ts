import { customAlphabet } from "nanoid";

/** Short, URL-safe, collision-resistant IDs (12 chars ≈ 62 bits of randomness). */
export const createId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 12);
