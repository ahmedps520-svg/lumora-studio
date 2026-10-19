import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth/server";

// Node's built-in SQLite driver stores the accounts.
export const runtime = "nodejs";

export const { GET, POST } = toNextJsHandler(async (request) => (await getAuth()).handler(request));
