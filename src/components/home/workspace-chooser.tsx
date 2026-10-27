import { ArrowUpRight, Image as ImageIcon, LayoutTemplate } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Spark } from "@/components/light/spark";

/** The first choice on the home page: make a design, or edit a photo. */
export async function WorkspaceChooser() {
  const t = await getTranslations("home.chooser");
  const cards = [
    {
      id: "design",
      href: "#sizes",
      icon: LayoutTemplate,
      tile: "from-[#FF7A3D] to-[#F72585] shadow-[0_12px_32px_-10px_rgb(247_37_133/0.7)]",
      glow: "bg-[#F72585]",
    },
    {
      id: "photo",
      href: "/photo",
      icon: ImageIcon,
      tile: "from-[#7C6CF2] to-[#3A2E8F] shadow-[0_12px_32px_-10px_rgb(124_108_242/0.75)]",
      glow: "bg-[#7C6CF2]",
    },
  ] as const;
  return (
    <section aria-labelledby="chooser-heading" className="mx-auto mt-12 max-w-4xl">
      <h2
        id="chooser-heading"
        className="flex items-center justify-center gap-2 font-sans text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase"
      >
        <Spark className="size-3" />
        {t("title")}
      </h2>
      <ul className="mt-5 grid gap-4 text-start sm:grid-cols-2">
        {cards.map(({ id, href, icon: Icon, tile, glow }) => (
          <li key={id}>
            <Link
              href={href}
              data-testid={`choose-${id}`}
              className="group lumen flex h-full flex-col overflow-hidden rounded-3xl surface-lit p-6 transition-transform duration-300 hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {/* A pool of the studio's colour, brighter on hover */}
              <span
                aria-hidden
                className={`pointer-events-none absolute -end-14 -top-20 -z-10 size-56 rounded-full opacity-20 blur-3xl transition-opacity duration-500 group-hover:opacity-40 ${glow}`}
              />
              <span className="flex items-start justify-between">
                <span
                  className={`flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white ${tile}`}
                >
                  <Icon className="size-6" />
                </span>
                <span className="flex size-9 items-center justify-center rounded-full border text-muted-foreground transition-colors duration-300 group-hover:border-transparent group-hover:bg-foreground group-hover:text-background">
                  <ArrowUpRight className="size-4 rtl:-scale-x-100" />
                </span>
              </span>
              <span className="mt-8 block font-heading text-2xl font-semibold tracking-[-0.025em]">
                {t(`${id}.name`)}
              </span>
              <span className="mt-2 block text-[15px] leading-relaxed text-muted-foreground">
                {t(`${id}.description`)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
