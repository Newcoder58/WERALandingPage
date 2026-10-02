import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
const source = readFileSync(
  new URL("../lib/closet.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
  },
}).outputText;
const {
  matchOutfit,
  missingPieces,
  validSelection,
  validClothing,
  sampleCloset,
} = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);
const preferences = {
  occasion: "Work",
  weather: "Mild",
  mood: "Balanced",
  notes: "",
};
test("matching selects a complete outfit exclusively from the actual inventory", () => {
  for (const occasion of [
    "University",
    "Casual",
    "Work",
    "Presentation / Interview",
  ]) {
    const look = matchOutfit(sampleCloset, { ...preferences, occasion });
    assert.equal(validSelection(look.itemIds, sampleCloset), true);
    assert.ok(
      look.itemIds.every((id) => sampleCloset.some((p) => p.id === id)),
    );
  }
});
test("a one-piece and shoes are a complete outfit without an invented top or bottom", () => {
  const dress = {
    ...sampleCloset[0],
    id: "dress",
    name: "Blue dress",
    category: "One-piece",
  };
  const items = [dress, sampleCloset[4]];
  assert.deepEqual(missingPieces(items), []);
  const outfit = matchOutfit(items, preferences);
  assert.deepEqual(new Set(outfit.itemIds), new Set(items.map((i) => i.id)));
  assert.equal(validSelection(outfit.itemIds, items), true);
});
test("missing footwear produces an actionable error instead of a fabricated outfit", () => {
  const items = sampleCloset.filter((i) => i.category !== "Shoes");
  assert.deepEqual(missingPieces(items), ["shoes"]);
  assert.throws(() => matchOutfit(items, preferences), /shoes/);
});
test("AI selections reject unknown IDs, repeated IDs and conflicting garments", () => {
  const valid = ["sample-shirt", "sample-trousers", "sample-loafers"];
  assert.equal(validSelection(valid, sampleCloset), true);
  assert.equal(validSelection([...valid, "made-up-coat"], sampleCloset), false);
  assert.equal(validSelection([...valid, "sample-shirt"], sampleCloset), false);
  assert.equal(validSelection([...valid, "sample-knit"], sampleCloset), false);
  const dress = { ...sampleCloset[0], id: "dress", category: "One-piece" };
  assert.equal(
    validSelection([...valid, "dress"], [...sampleCloset, dress]),
    false,
  );
});
test("another combination changes the selected base when the closet offers alternatives", () => {
  const first = matchOutfit(sampleCloset, preferences);
  const second = matchOutfit(sampleCloset, preferences, first.itemIds);
  assert.notDeepEqual(second.itemIds, first.itemIds);
});
test("clothing validation rejects remote image URLs, oversized payloads and malformed metadata", () => {
  assert.equal(validClothing(sampleCloset[0]), true);
  assert.equal(
    validClothing({
      ...sampleCloset[0],
      image: "https://external.example/photo.png",
    }),
    false,
  );
  assert.equal(validClothing({ ...sampleCloset[0], formality: 99 }), false);
  assert.equal(
    validClothing({
      ...sampleCloset[0],
      image: "data:image/png;base64," + "A".repeat(650001),
    }),
    false,
  );
});
