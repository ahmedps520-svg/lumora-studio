import {
  getRemover,
  removeBackgroundOnServer,
  removerReady,
  serverRemovalEnabled,
} from "@/lib/background/server-remover";
import { allowRequest, clientKey } from "@/lib/ai/server/limits";

export const runtime = "nodejs";
/** The first run also downloads the model (~224 MB). */
export const maxDuration = 300;

const MAX_BYTES = 25 * 1024 * 1024;
const IMAGE_TYPES = /^image\/(png|jpeg|webp|gif|avif)$/;

const noStore = { "Cache-Control": "no-store" };

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  return !origin || !host || new URL(origin).host === host;
}

/** Is HD removal available here? `?warm=1` also starts loading the model. */
export async function GET(request: Request) {
  const available = serverRemovalEnabled();
  if (available && new URL(request.url).searchParams.has("warm")) {
    void getRemover().catch((error) => console.warn("Background model failed to load", error));
  }
  return Response.json({ available, ready: available && removerReady() }, { headers: noStore });
}

/** Body: the image bytes. Response: the cut-out as a transparent PNG. */
export async function POST(request: Request) {
  if (!serverRemovalEnabled()) {
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
  if (!sameOrigin(request)) {
    return Response.json({ error: "forbidden" }, { status: 403, headers: noStore });
  }
  if (!allowRequest(`bg:${clientKey(request.headers)}`, 20)) {
    return Response.json({ error: "rate_limited" }, { status: 429, headers: noStore });
  }
  const type = request.headers.get("content-type") ?? "";
  if (!IMAGE_TYPES.test(type)) {
    return Response.json({ error: "unsupported_type" }, { status: 415, headers: noStore });
  }
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) {
    return Response.json({ error: "too_large" }, { status: 413, headers: noStore });
  }
  const bytes = Buffer.from(await request.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_BYTES) {
    return Response.json({ error: "too_large" }, { status: 413, headers: noStore });
  }

  try {
    const { png, device } = await removeBackgroundOnServer(bytes);
    return new Response(new Uint8Array(png), {
      headers: { ...noStore, "Content-Type": "image/png", "X-Lumora-Device": device },
    });
  } catch (error) {
    console.error("Background removal failed", error);
    return Response.json({ error: "failed" }, { status: 500, headers: noStore });
  }
}
