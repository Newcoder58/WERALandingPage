# WERA landing page

A responsive landing page and working closet app for WERA, an outfit planner for university students. Built with Next.js, React and TypeScript. The wardrobe imagery, scroll story, sample outfits, SEO metadata, analytics, integrated closet app, and feedback form are included.

Vercel Web Analytics is included in the root layout for page views. Enable Web Analytics in the Vercel project dashboard and deploy the latest commit to begin collecting visits. This is separate from the optional GA4 integration.

## Deploy to Vercel

Import this GitHub repository into Vercel. Framework Preset: **Next.js**. Root Directory: repository root. Build Command: `npm run build`. No custom Vercel configuration is required for the landing page.

The real app is embedded directly in the landing page by default and available at `/closet`. Add these optional environment variables in Vercel:

- `VITE_APP_EMBED_URL`: optional external app HTTPS URL, overriding the built-in app. Leave blank to use WERA's included closet app.
- `VITE_GA_MEASUREMENT_ID`: a real GA4 measurement ID. With no ID, analytics stays off.
- `WERA_INSTAGRAM_URL`, `WERA_TIKTOK_URL`: verified HTTPS social profile URLs. Blank values show “Coming soon.”
- `WERA_SITE_URL`: the production HTTPS domain if you want to override Vercel's `VERCEL_PROJECT_PRODUCTION_URL` for canonical and Open Graph URLs.

### Feedback storage

To make the feedback form save responses, create a **private Vercel Blob store** in the Vercel project's Storage tab and connect it to the project. Vercel supplies `BLOB_READ_WRITE_TOKEN` to the connected environment. Deploy again after connecting it. Responses are written to private `feedback/*.json` blobs. Email is optional and never goes to analytics. If the store is missing, the form preserves the visitor's answers and shows an availability message instead of claiming the submission succeeded.

## Local development

Use Node.js 22.13 or later. Run `npm install`, then `npm run dev`. Run `npm run typecheck` and `npm run build` before publishing. For local feedback storage, provide a private Blob store token in `.env.local` (never commit the token). The `.env.example` file documents all configuration keys.

The outfit examples outside the app are illustrative previews from a small sample wardrobe. The live app begins with an empty closet and contains only pieces added by the visitor. The generated wardrobe photo and crops are included in `public/`.

## The WERA app

The app fulfills the landing page flow: add owned pieces with optional photos; identify clothing with Gemini or enter/edit type, color, pattern, style, formality and warmth; choose University, Casual, Work, or Presentation / Interview; generate an outfit using only inventory IDs, with an explanation and styling tips. One-pieces are supported as an alternative to a top and bottom. Creating an outfit produces a flat-lay image using the selected clothing photos as references in the same flow. Users can request another combination, save up to eight looks, and download or regenerate the image. Explanations are collapsed below the image. AI visualizations are labeled and original clothing remains visible.

No account is required. Up to 24 pieces, their photos and saved looks live in IndexedDB on the visitor's browser/device. There is no cloud closet sync. Photos are resized/re-encoded in the browser before any AI request. Uploading a photo automatically sends it to Google for identification and fills in editable details. Creating an outfit automatically sends the selected clothing photos to Cloudflare to generate its image. Outfit styling sends clothing metadata and preferences, not wardrobe photos. Clothing data and images are not included in analytics. Clearing browser site data removes this closet; third-party iframe storage can be restricted or partitioned by browsers.

### Connect Google

1. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey), or use an existing compatible key.
2. Google is used for text/photo identification and styling only. Free-tier availability depends on the project. Check [Google's billing guide](https://ai.google.dev/gemini-api/docs/billing) and [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits).
3. Set `GEMINI_API_KEY` in the Vercel project's server environment and redeploy. Do **not** prefix the key with `NEXT_PUBLIC_`, put it in a URL, or commit `.env.local`.
4. Optional overrides: `GEMINI_TEXT_MODEL` (default `gemini-3.1-flash-lite`). Model availability depends on the Google project.

Without a key, users can still build their closet, receive a clearly labeled metadata-based matching result, and save outfits. AI errors are shown honestly; no generated image is fabricated. Matching considers occasion/formality, colors, pattern, style and warmth. Free-text notes are used by AI styling only.

The `/api/closet` endpoint supports only the three fixed wardrobe tasks. It validates inputs and chosen inventory IDs, blocks cross-origin browser requests, limits request size and upstream duration, and includes a **best-effort per-instance** throttle (12 requests per IP per ten minutes). This is not a distributed spending cap: for a public production launch, configure Google quotas and Vercel Firewall rate limits according to the owner's budget. No secrets or raw upstream errors are sent to browsers. Responses are not cached.

### Connect free Cloudflare image generation

1. Open Workers AI in the [Cloudflare dashboard](https://dash.cloudflare.com/), select **Use REST API**, create a Workers AI API token, and copy the Account ID. A custom token needs Workers AI Read and Edit for the chosen account.
2. Add server-only `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, and `WERA_ENABLE_IMAGE_GENERATION=true` to the Vercel project environment and redeploy. Locally put them in ignored `.env.local`. Never use a NEXT_PUBLIC_ prefix.
3. Stay on Workers Free for the daily 10,000-neuron allocation. Requests stop when the allowance is exhausted. See [current pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/).

The fixed model is `@cf/black-forest-labs/flux-2-klein-4b`. Every selected piece needs an actual uploaded photo. References are resized on the server below 512px; when five pieces are selected, the last two share a reference sheet so all pieces fit the model's four-reference limit. Images are AI approximations and may alter details; the original photographs always remain visible. Missing credentials, quota failures, missing photos, and invalid responses show honest errors. No generated previews or sample inventory are preloaded.

A three-step first-visit tutorial appears when the app becomes visible, remembers completion in IndexedDB, supports skipping/back navigation, and can be replayed with **Quick tour**. Legacy sample pieces and sample saved looks are removed on load while uploaded clothing is retained.

### Embed elsewhere

Use the actual deployed HTTPS origin:

```html
<iframe
  src="https://YOUR-WERA-DOMAIN/closet?embed=1"
  title="WERA outfit planner"
  style="width:100%;height:1000px;border:0;border-radius:16px"
  loading="lazy"
></iframe>
```

The built-in page uses the app component directly, so it adapts to its content height. Cross-site iframe hosts need enough height (or scrolling) for smaller screens. No credential belongs in the embed code. The app calls its own origin for all API requests.

### Verification

`npm test` checks that matching selects only actual owned pieces, supports one-pieces, refuses incomplete closets, rejects fabricated/duplicate/conflicting AI selections, produces alternatives, and rejects malformed clothing. `npm run typecheck` and `npm run build` verify the deployable Next.js app. Live AI functionality additionally requires a valid configured Google key and sufficient quota.
