import { MODEL_IDS } from "@/lib/ai/models";
import { spentToday } from "@/lib/ai/server/limits";
import { getFeatureFlags } from "@/lib/env";

/** Whether AI is available with the owner key, and today's server-side spend. Never exposes keys. */
export function GET() {
  const flags = getFeatureFlags();
  return Response.json(
    {
      ownerKey: flags.aiOwnerKey,
      imageOwnerKey: flags.imageOwnerKey,
      acceptsUserKey: true,
      dailyBudgetUsd: flags.dailyBudgetUsd,
      spentTodayUsd: spentToday(),
      models: MODEL_IDS,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
