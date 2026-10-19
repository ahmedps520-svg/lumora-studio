/**
 * The template catalogue: every built-in template, as (kind × theme ×
 * blueprint × palette × fonts). Each theme gets different layouts in each
 * kind, and blueprints only go to themes whose words they suit.
 */
import { getTheme, THEMES } from "./content";
import type { Copy, TemplateDef, TemplateKind, Theme } from "./types";

type Need = (c: Copy) => boolean;

/** What a blueprint needs from a theme's words to look right. */
const NEEDS: Record<string, Need> = {
  bigDeal: (c) => c.stats.length > 0 && c.stats[0]![0].length <= 6,
  listTips: (c) => c.items.length >= 3,
  quoteCard: (c) => Boolean(c.quote),
  ticket: (c) => Boolean(c.date && (c.time || c.place)),
  confettiParty: (c) => Boolean(c.date),
  circleBadge: (c) => c.stats.length >= 2,
  ytNumber: (c) => c.stats.length > 0 && c.stats[0]![0].length <= 4,
  ytVersus: (c) => c.items.length >= 2,
  menuClassic: (c) => c.items.length >= 3,
  menuModern: (c) => c.items.length >= 3,
  speakerWide: (c) => Boolean(c.name && (c.date || c.subtitle)),
  quoteWide: (c) => Boolean(c.quote),
};

const suits = (blueprint: string, theme: Theme) => {
  const need = NEEDS[blueprint];
  return need ? need(theme.copy.en) && need(theme.copy.ar) : true;
};

interface KindPlan {
  blueprints: string[];
  /** Theme ids, or "all". */
  themes: string[] | "all";
  /** Templates per theme. */
  perTheme: number;
}

const SOCIAL = [
  "spotlight",
  "splitBand",
  "photoHero",
  "bigDeal",
  "confettiParty",
  "listTips",
  "quoteCard",
  "archGlow",
  "retroSun",
  "waveFooter",
  "ticket",
  "stackedType",
  "cardOnGradient",
  "collage",
  "circleBadge",
  "minimalLine",
  "editorial",
];

/** Layouts built around photos (frames fill with photos that suit the theme). */
const PHOTO = [
  "photoFull",
  "magazine",
  "photoSplit",
  "polaroid",
  "photoGrid",
  "duotone",
  "photoCard",
  "photoBorder",
  "photoStrips",
  "photoCircle",
];

const LANDSCAPE = [
  "promoWide",
  "wideCenter",
  "speakerWide",
  "quoteWide",
  "ytSplit",
  "widePhoto",
  "wideCards",
];

const words = (s: string) => s.split(/\s+/).filter(Boolean);

export const KIND_PLANS: Partial<Record<TemplateKind, KindPlan>> = {
  instagramPost: { blueprints: [...PHOTO, ...SOCIAL], themes: "all", perTheme: 6 },
  instagramStory: {
    blueprints: [
      ...PHOTO,
      "spotlight",
      "photoHero",
      "splitBand",
      "waveFooter",
      "archGlow",
      "confettiParty",
      "cardOnGradient",
      "circleBadge",
      "listTips",
      "retroSun",
      "stackedType",
      "ticket",
      "quoteCard",
      "collage",
    ],
    themes: "all",
    perTheme: 4,
  },
  instagramPortrait: { blueprints: [...PHOTO, ...SOCIAL], themes: "all", perTheme: 2 },
  facebookPost: { blueprints: LANDSCAPE, themes: "all", perTheme: 2 },
  poster: {
    blueprints: [
      "spotlight",
      "retroSun",
      "editorial",
      "stackedType",
      "bigDeal",
      "ticket",
      "archGlow",
      "minimalLine",
      "splitBand",
      "photoFull",
      "magazine",
      "duotone",
      "photoBorder",
      "photoSplit",
    ],
    themes: words(`festival sale newYear marathon webinar eco charity fitness graduation iftar
      bookClub kidsWorkshop productLaunch travel holidays pets blackFriday perfume sneakers
      electronics grocery artExhibition filmNight networking gala grandOpening potteryClass
      techSummit football pizza iceCream farmersMarket brunch burger coffee runningClub hiking
      camping beachHoliday cityBreak summerVibes mentalHealth scienceFair languageClass
      backToSchool cyberSecurity nationalDay halloween womensDay mothersDay fathersDay ramadan eid
      musicRelease bookLaunch fitnessChallenge streamSchedule startupPitch hiring birthday`),
    perTheme: 2,
  },
  flyer: {
    blueprints: [
      "splitBand",
      "waveFooter",
      "photoHero",
      "cardOnGradient",
      "listTips",
      "collage",
      "circleBadge",
      "photoSplit",
      "photoCard",
      "photoGrid",
      "photoBorder",
      "photoStrips",
    ],
    themes: words(`sale coffee burger bakery healthyFood fitness yoga realEstate beauty pets hiring
      agency course kidsWorkshop charity travel blackFriday jewelry skincare furniture florist
      carService grocery electronics ecommerce pizza sushi iceCream juiceBar shawarma brunch
      farmersMarket dentist barber gardening cleaning interiorDesign runningClub hiking camping
      beachHoliday luxuryHotel consulting lawFirm languageClass backToSchool scienceFair
      potteryClass grandOpening networking techSummit artExhibition halloween mothersDay
      fathersDay iftar ramadan fitnessChallenge finance eco`),
    perTheme: 2,
  },
  pinterestPin: {
    blueprints: [
      ...PHOTO,
      "photoHero",
      "listTips",
      "quoteCard",
      "editorial",
      "cardOnGradient",
      "collage",
      "minimalLine",
    ],
    themes: words(`tips quote photography skincare perfume jewelry furniture florist interiorDesign
      cooking healthyFood bakery brunch iceCream juiceBar sushi pizza coffee yoga fitness
      mentalHealth gardening cleaning travel beachHoliday cityBreak hiking camping luxuryHotel
      wedding engagement babyShower birthday valentine mothersDay halloween holidays ramadan eid
      beauty beautyTutorial fitnessChallenge bookLaunch bookClub musicRelease tutorial vlog
      podcast realEstate pets eco finance course backToSchool kidsWorkshop summerVibes womensDay
      newArrivals sneakers`),
    perTheme: 2,
  },
  invitation: {
    blueprints: [
      "editorial",
      "archGlow",
      "confettiParty",
      "ticket",
      "minimalLine",
      "cardOnGradient",
      "polaroid",
      "photoCircle",
    ],
    themes:
      words(`birthday wedding babyShower graduation iftar newYear valentine bookClub engagement
      gala artExhibition grandOpening filmNight networking summerVibes halloween mothersDay eid
      potteryClass bookLaunch`),
    perTheme: 3,
  },
  youtubeThumbnail: {
    blueprints: ["ytPunch", "ytSplit", "ytNumber", "ytVersus", "wideCenter", "widePhoto"],
    themes:
      words(`gaming techReview cooking vlog podcast tutorial fitness travel finance course tips
      productLaunch burger aiTool appPromo musicRelease bookLaunch fitnessChallenge
      beautyTutorial streamSchedule cyberSecurity electronics sneakers pizza sushi shawarma
      hiking camping cityBreak beachHoliday startupPitch marketReport languageClass scienceFair
      football halloween interiorDesign carService mentalHealth skincare`),
    perTheme: 3,
  },
  xPost: {
    blueprints: [...LANDSCAPE, "ytPunch", "ytNumber"],
    themes: words(`sale blackFriday productLaunch giveaway quote tips webinar techSummit networking
      hiring agency finance marketReport startupPitch consulting appPromo aiTool cyberSecurity
      course podcast musicRelease bookLaunch streamSchedule football filmNight newYear
      nationalDay ramadan eid womensDay electronics ecommerce testimonial newTeamMember travel
      cityBreak coffee pizza eco charity`),
    perTheme: 1,
  },
  linkedinPost: {
    blueprints: LANDSCAPE,
    themes: words(`hiring agency finance consulting lawFirm startupPitch newTeamMember marketReport
      testimonial webinar techSummit networking course languageClass aiTool appPromo
      cyberSecurity productLaunch ecommerce tips quote photography realEstate interiorDesign
      charity eco womensDay nationalDay graduation podcast bookLaunch grandOpening gala
      mentalHealth dentist carService luxuryHotel furniture electronics ramadan`),
    perTheme: 1,
  },
  linkedinBanner: {
    blueprints: ["bannerWide", "bannerPhoto"],
    themes: words(`hiring agency finance course appPromo aiTool photography realEstate webinar
      podcast productLaunch tips consulting lawFirm startupPitch marketReport cyberSecurity
      interiorDesign newTeamMember testimonial techSummit networking languageClass ecommerce
      dentist luxuryHotel electronics furniture mentalHealth carService`),
    perTheme: 2,
  },
  facebookCover: {
    blueprints: ["bannerWide", "bannerPhoto"],
    themes: words(`coffee burger bakery pizza sushi iceCream juiceBar shawarma brunch farmersMarket
      fitness yoga beauty barber florist jewelry skincare perfume sneakers furniture grocery
      travel beachHoliday hiking camping realEstate pets charity eco grandOpening`),
    perTheme: 2,
  },
  xHeader: {
    blueprints: ["bannerWide", "bannerPhoto"],
    themes: words(`podcast gaming streamSchedule musicRelease bookLaunch vlog techReview tutorial
      aiTool appPromo photography agency startupPitch cyberSecurity fitnessChallenge
      beautyTutorial runningClub hiking cityBreak football`),
    perTheme: 2,
  },
  presentation16x9: {
    blueprints: ["deckClean", "deckBold"],
    themes: words(`productLaunch agency appPromo aiTool course charity eco travel realEstate finance
      hiring webinar consulting lawFirm startupPitch marketReport cyberSecurity techSummit
      interiorDesign luxuryHotel scienceFair languageClass backToSchool mentalHealth
      fitnessChallenge ecommerce testimonial networking newTeamMember grocery`),
    perTheme: 2,
  },
  businessCard: {
    blueprints: ["bcMinimal", "bcBand", "bcDark", "bcCorner"],
    themes: words(`photography agency realEstate coffee beauty yoga fitness hiring course appPromo
      burger bakery consulting lawFirm dentist barber interiorDesign florist carService cleaning
      jewelry startupPitch gardening languageClass`),
    perTheme: 2,
  },
  logo: {
    blueprints: ["logoBadge", "logoMonogram", "logoRing", "logoWordmark", "logoStamp"],
    themes: words(`coffee bakery burger healthyFood fitness yoga beauty pets photography agency
      appPromo aiTool travel eco realEstate kidsWorkshop pizza sushi iceCream juiceBar shawarma
      brunch barber florist jewelry perfume sneakers furniture grocery carService`),
    perTheme: 2,
  },
  certificate: {
    blueprints: ["certClassic", "certModern", "certRibbon"],
    themes: words(`course marathon graduation kidsWorkshop charity scienceFair languageClass
      runningClub fitnessChallenge potteryClass techSummit`),
    perTheme: 2,
  },
  menu: {
    blueprints: ["menuClassic", "menuModern"],
    themes: words(`coffee burger bakery healthyFood iftar valentine pizza sushi iceCream juiceBar
      shawarma brunch`),
    perTheme: 2,
  },
  resume: {
    blueprints: ["resumeSidebar", "resumeClassic"],
    themes: words(
      `hiring photography agency course consulting lawFirm interiorDesign newTeamMember`,
    ),
    perTheme: 1,
  },
};

/** Builds the catalogue (stable order and ids). */
export function buildCatalog(): TemplateDef[] {
  const defs: TemplateDef[] = [];
  const plans = Object.entries(KIND_PLANS) as [TemplateKind, KindPlan][];
  plans.forEach(([kind, plan], ki) => {
    const themes = plan.themes === "all" ? THEMES : plan.themes.map(getTheme);
    // Each layout is used about equally often in a kind.
    const used = new Map<string, number>(plan.blueprints.map((b) => [b, 0]));
    themes.forEach((theme, ti) => {
      const options = plan.blueprints.filter((b) => suits(b, theme));
      const picked: string[] = [];
      for (let j = 0; j < Math.min(plan.perTheme, options.length); j++) {
        const blueprint = options
          .filter((b) => !picked.includes(b))
          .map((b, i) => ({ b, score: used.get(b)! * 100 + ((i + ti * 7) % options.length) }))
          .sort((x, y) => x.score - y.score)[0]!.b;
        picked.push(blueprint);
        used.set(blueprint, used.get(blueprint)! + 1);
        const id = `${kind}-${theme.id}-${blueprint}`;
        if (defs.some((d) => d.id === id)) continue;
        defs.push({
          id,
          kind,
          theme: theme.id,
          category: theme.category,
          blueprint,
          // Shifted by kind, so a theme looks different in each size.
          palette: theme.palettes[(ti + j + ki) % theme.palettes.length]!,
          fonts: theme.fonts[(ti + j * 2 + ki) % theme.fonts.length]!,
        });
      }
    });
  });
  return defs;
}

let cached: TemplateDef[] | null = null;
export function catalog(): TemplateDef[] {
  return (cached ??= buildCatalog());
}

export function getTemplateDef(id: string): TemplateDef | undefined {
  return catalog().find((d) => d.id === id);
}
