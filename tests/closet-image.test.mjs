import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import sharp from "sharp";
const require = createRequire(import.meta.url);
const compiled = ts
  .transpileModule(
    readFileSync(new URL("../lib/closet-image.ts", import.meta.url), "utf8"),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
      },
    },
  )
  .outputText.replace(
    'from "sharp"',
    `from ${JSON.stringify(pathToFileURL(require.resolve("sharp")).href)}`,
  );
const { createOutfitImage, imageConfigured } = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);
const photo =
  "data:image/jpeg;base64," +
  (
    await sharp({
      create: { width: 20, height: 20, channels: 3, background: "white" },
    })
      .jpeg()
      .toBuffer()
  ).toString("base64");
const items = ["Top", "Bottom", "Shoes", "Layer", "Accessory"].map(
  (category, i) => ({
    id: `owned-${i}`,
    name: `My ${category}`,
    category,
    color: "White",
    pattern: "Solid",
    style: "Classic",
    formality: 2,
    warmth: 2,
    image: photo,
  }),
);
process.env.CLOUDFLARE_ACCOUNT_ID = "a".repeat(32);
process.env.CLOUDFLARE_API_TOKEN = "test-only-token";
process.env.WERA_ENABLE_IMAGE_GENERATION = "true";
test("Cloudflare requires configured credentials and actual photos before an upstream call", async () => {
  assert.equal(imageConfigured(), true);
  await assert.rejects(
    createOutfitImage([{ ...items[0], image: "" }]),
    /real photo/,
  );
  await assert.rejects(
    createOutfitImage([{ ...items[0], image: "data:image/jpeg;base64,AAAA" }]),
    /could not be read/,
  );
  process.env.WERA_ENABLE_IMAGE_GENERATION = "false";
  await assert.rejects(createOutfitImage(items), /not configured/);
  process.env.WERA_ENABLE_IMAGE_GENERATION = "true";
});
test("five owned pieces fit four bounded reference inputs and return a verified JPEG", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.ok(url.endsWith("/ai/run/@cf/black-forest-labs/flux-2-klein-4b"));
    assert.equal(options.headers.Authorization, "Bearer test-only-token");
    const form = options.body;
    assert.equal(form.has("input_image_4"), false);
    for (let i = 0; i < 4; i++) {
      const metadata = await sharp(
        Buffer.from(await form.get(`input_image_${i}`).arrayBuffer()),
      ).metadata();
      assert.ok(metadata.width < 512 && metadata.height < 512);
    }
    for (const item of items) assert.ok(form.get("prompt").includes(item.name));
    return Response.json({
      success: true,
      result: { image: photo.split(",")[1] },
    });
  };
  try {
    assert.equal(await createOutfitImage(items), photo);
  } finally {
    globalThis.fetch = original;
  }
});
test("quota and malformed upstream images produce errors instead of fake success", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response("quota", { status: 429 });
    await assert.rejects(
      createOutfitImage(items),
      (error) => error.status === 429 && /allowance/.test(error.message),
    );
    globalThis.fetch = async () =>
      Response.json({ success: true, result: { image: "AAAA" } });
    await assert.rejects(createOutfitImage(items), /could not be read/);
  } finally {
    globalThis.fetch = original;
  }
});
