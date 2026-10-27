import { notFound } from "next/navigation";
import { ReviewGrid } from "@/components/templates/review-grid";

/**
 * Development only: renders chosen templates for visual review.
 *   /templates/review?ids=a,b,c
 *   /templates/review?blueprint=neonFrame&limit=24
 *   /templates/review?theme=coffee&kind=poster
 */
export default async function TemplateReviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const params = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  return (
    <main className="min-h-dvh bg-background p-4">
      <ReviewGrid
        ids={first(params.ids)}
        blueprint={first(params.blueprint)}
        theme={first(params.theme)}
        kind={first(params.kind)}
        limit={Number(first(params.limit)) || 24}
        offset={Number(first(params.offset)) || 0}
      />
    </main>
  );
}
