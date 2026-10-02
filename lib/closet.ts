export const categories = [
  "Top",
  "Bottom",
  "One-piece",
  "Shoes",
  "Layer",
  "Accessory",
] as const;
export const occasions = [
  "University",
  "Casual",
  "Work",
  "Presentation / Interview",
] as const;
export type Category = (typeof categories)[number];
export type Occasion = (typeof occasions)[number];
export type Clothing = {
  id: string;
  name: string;
  category: Category;
  color: string;
  pattern: string;
  style: string;
  formality: number;
  warmth: number;
  image: string;
  sample?: boolean;
};
export type Preferences = {
  occasion: Occasion;
  weather: "Warm" | "Mild" | "Cold";
  mood: "Comfortable" | "Balanced" | "Polished";
  notes: string;
};
export type Outfit = {
  id: string;
  title: string;
  reason: string;
  tips: string;
  itemIds: string[];
  occasion: Occasion;
  source: "Gemini" | "Closet matching";
  createdAt: string;
  image?: string;
  pieces?: Clothing[];
};
export function validClothing(value: unknown): value is Clothing {
  if (!value || typeof value !== "object") return false;
  const v = value as Clothing;
  return (
    typeof v.id === "string" &&
    /^[a-zA-Z0-9_-]{1,80}$/.test(v.id) &&
    typeof v.name === "string" &&
    v.name.length > 0 &&
    v.name.length <= 100 &&
    categories.includes(v.category) &&
    ["color", "pattern", "style"].every(
      (k) =>
        typeof v[k as keyof Clothing] === "string" &&
        String(v[k as keyof Clothing]).length <= 80,
    ) &&
    Number.isInteger(v.formality) &&
    v.formality >= 1 &&
    v.formality <= 3 &&
    Number.isInteger(v.warmth) &&
    v.warmth >= 1 &&
    v.warmth <= 3 &&
    typeof v.image === "string" &&
    (v.image === "" ||
      /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v.image)) &&
    v.image.length <= 650000
  );
}
export function missingPieces(items: Clothing[]) {
  const missing: string[] = [];
  if (!items.some((i) => i.category === "One-piece")) {
    if (!items.some((i) => i.category === "Top"))
      missing.push("a top or one-piece");
    if (!items.some((i) => i.category === "Bottom"))
      missing.push("a bottom or one-piece");
  }
  if (!items.some((i) => i.category === "Shoes")) missing.push("shoes");
  return missing;
}
export function validSelection(
  ids: unknown,
  items: Clothing[],
): ids is string[] {
  if (
    !Array.isArray(ids) ||
    ids.length < 2 ||
    ids.length > 6 ||
    new Set(ids).size !== ids.length ||
    !ids.every((id) => typeof id === "string" && items.some((i) => i.id === id))
  )
    return false;
  const selected = items.filter((i) => ids.includes(i.id));
  if (missingPieces(selected).length) return false;
  return (
    categories.every(
      (category) => selected.filter((i) => i.category === category).length <= 1,
    ) &&
    !(
      selected.some((i) => i.category === "One-piece") &&
      selected.some((i) => ["Top", "Bottom"].includes(i.category))
    )
  );
}
const neutrals = /black|white|cream|ivory|beige|grey|gray|navy|brown|denim/i;
export function matchOutfit(
  items: Clothing[],
  preferences: Preferences,
  previous: string[] = [],
): Outfit {
  const missing = missingPieces(items);
  if (missing.length)
    throw new Error(
      "Add " + missing.join(" and ") + " to complete your outfit.",
    );
  const target =
    preferences.occasion === "Casual" || preferences.occasion === "University"
      ? 1
      : preferences.occasion === "Work"
        ? 2
        : 3;
  const warmth =
    preferences.weather === "Warm" ? 1 : preferences.weather === "Cold" ? 3 : 2;
  const score = (piece: Clothing) =>
    10 -
    Math.abs(piece.formality - target) * 3 -
    Math.abs(piece.warmth - warmth) +
    (preferences.mood === "Comfortable" &&
    /relax|casual|sport/i.test(piece.style)
      ? 2
      : 0) +
    (preferences.mood === "Polished" && piece.formality > 1 ? 2 : 0) -
    (previous.includes(piece.id) ? 4 : 0);
  const group = (category: Category) =>
    items.filter((i) => i.category === category);
  const bases = [
    ...group("Top").flatMap((top) =>
      group("Bottom").map((bottom) => [top, bottom]),
    ),
    ...group("One-piece").map((dress) => [dress]),
  ];
  const combinations = bases.flatMap((base) =>
    group("Shoes").map((shoes) => [...base, shoes]),
  );
  combinations.sort((a, b) => {
    const combinationScore = (pieces: Clothing[]) =>
      pieces.reduce((s, p) => s + score(p), 0) / pieces.length +
      (pieces.filter((p) => !neutrals.test(p.color)).length <= 1 ? 2 : 0) -
      Math.max(
        0,
        pieces.filter((p) => !/solid|plain/i.test(p.pattern)).length - 1,
      ) *
        3;
    return combinationScore(b) - combinationScore(a);
  });
  const picked = combinations[0];
  const extra = (category: Category) =>
    group(category).sort((a, b) => score(b) - score(a))[0];
  const layer = extra("Layer");
  if (layer && preferences.weather !== "Warm") picked.push(layer);
  const accessory = extra("Accessory");
  if (accessory) picked.push(accessory);
  const patterned = picked.filter((i) => !/solid|plain/i.test(i.pattern));
  const mismatch = picked.some((i) => Math.abs(i.formality - target) > 1);
  return {
    id: crypto.randomUUID(),
    title:
      preferences.occasion === "University"
        ? "Your campus edit"
        : preferences.occasion === "Casual"
          ? "Everyday, considered"
          : "Ready for your day",
    reason: `${picked.map((i) => i.name).join(", ")} bring together ${picked.filter((i) => neutrals.test(i.color)).length ? "a neutral foundation" : "your closet’s colors"} with ${patterned.length ? "a little pattern" : "simple, solid textures"}. These are the closest matches in your closet for a ${preferences.weather.toLowerCase()} ${preferences.occasion.toLowerCase()} day.${mismatch ? " Your current pieces lean more casual; check your workplace or interview dress code." : ""}`,
    tips:
      preferences.weather === "Cold" && !layer
        ? "Your closet has no outer layer yet. Add a coat or jacket for colder weather."
        : preferences.mood === "Comfortable"
          ? "Choose the fit that feels comfortable, and keep any optional layer easy to remove."
          : "Keep the silhouette clean and let one piece be the focus.",
    itemIds: picked.map((i) => i.id),
    occasion: preferences.occasion,
    source: "Closet matching",
    createdAt: new Date().toISOString(),
  };
}
