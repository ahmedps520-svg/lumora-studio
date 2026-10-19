import "server-only";
import { headers } from "next/headers";
import { getAuth } from "./server";

/** The signed-in user for this request, or null. */
export async function currentUser() {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}
