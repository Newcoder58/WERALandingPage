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

The outfit examples outside the app are illustrative previews from a small sample wardrobe. The live app begins with an empty closet and offers an explicitly labeled sample wardrobe. The generated wardrobe photo and crops are included in `public/`.

## The WERA app

The app fulfills the landing page flow: add owned pieces with optional photos; identify clothing with Gemini or enter/edit type, color, pattern, style, formality and warmth; choose University, Casual, Work, or Presentation / Interview; generate an outfit using only inventory IDs, with an explanation and styling tips. One-pieces are supported as an alternative to a top and bottom. Users can request another combination, save up to eight looks, and generate/download a flat-lay outfit visualization using the selected clothing photos as references. AI visualizations are labeled and original clothing remains visible.

No account is required. Up to 24 pieces, their photos and saved looks live in IndexedDB on the visitor's browser/device. There is no cloud closet sync. Photos are resized/re-encoded in the browser before any AI request. A user explicitly chooses whether to send a photo to Google for identification or image creation. Outfit styling sends clothing metadata and preferences, not wardrobe photos. Clothing data and images are not included in analytics. Clearing browser site data removes this closet; third-party iframe storage can be restricted or partitioned by browsers.

### Connect Google

1. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey), or use an existing compatible key.
2. Image generation needs an eligible project with paid-tier billing and image quota. Text/photo identification may be available on the free tier. Check [Google's billing guide](https://ai.google.dev/gemini-api/docs/billing) and [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits).
3. Set `GEMINI_API_KEY` in the Vercel project's server environment and redeploy. Image creation is **off by default**; set `WERA_ENABLE_IMAGE_GENERATION=true` only after the project has image quota. The app shows real clothing photos when it is off. Do **not** prefix the key with `NEXT_PUBLIC_`, put it in a URL, or commit `.env.local`.
4. Optional overrides: `GEMINI_TEXT_MODEL` (default `gemini-3.1-flash-lite`) and `GEMINI_IMAGE_MODEL` (default `gemini-3.1-flash-image`). The image model supports multiple clothing reference photos. Model availability depends on the Google project.

Without a key, users can still build their closet, receive a clearly labeled metadata-based matching result, and save outfits. AI errors are shown honestly; no generated image is fabricated. Matching considers occasion/formality, colors, pattern, style and warmth. Free-text notes are used by AI styling only.

The `/api/closet` endpoint supports only the three fixed wardrobe tasks. It validates inputs and chosen inventory IDs, blocks cross-origin browser requests, limits request size and upstream duration, and includes a **best-effort per-instance** throttle (12 requests per IP per ten minutes). This is not a distributed spending cap: for a public production launch, configure Google quotas and Vercel Firewall rate limits according to the owner's budget. No secrets or raw upstream errors are sent to browsers. Responses are not cached.

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
