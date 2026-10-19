import { APP_NAME, APP_VERSION } from "@/lib/config";
import { getFeatureFlags } from "@/lib/env";

/** Machine-readable health check. Reports on/off flags only — never key values. */
export function GET() {
  const flags = getFeatureFlags();
  return Response.json(
    {
      status: "ok",
      name: APP_NAME,
      version: APP_VERSION,
      time: new Date().toISOString(),
      features: {
        aiOwnerKey: flags.aiOwnerKey,
        stockPhotos: { unsplash: flags.unsplash, pexels: flags.pexels, pixabay: flags.pixabay },
        cloudSync: flags.cloudSync,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
