# WERA landing page

A responsive landing page for WERA, an outfit planner for university students. Built with Next.js, React and TypeScript. The wardrobe imagery, scroll story, interactive sample outfits, SEO metadata, optional GA4 events, app embed slot, and feedback form are included.

Vercel Web Analytics is included in the root layout for page views. Enable Web Analytics in the Vercel project dashboard and deploy the latest commit to begin collecting visits. This is separate from the optional GA4 integration.

## Deploy to Vercel

Import this GitHub repository into Vercel. Framework Preset: **Next.js**. Root Directory: repository root. Build Command: `npm run build`. No custom Vercel configuration is required for the landing page.

The outfit generator is a placeholder until the separate WERA application is ready. Add these optional environment variables in Vercel when available:

- `VITE_APP_EMBED_URL`: the app's HTTPS URL. The page then displays it in a responsive iframe with a direct-link fallback. The app must allow framing by this domain.
- `VITE_GA_MEASUREMENT_ID`: a real GA4 measurement ID. With no ID, analytics stays off.
- `WERA_INSTAGRAM_URL`, `WERA_TIKTOK_URL`: verified HTTPS social profile URLs. Blank values show “Coming soon.”
- `WERA_SITE_URL`: the production HTTPS domain if you want to override Vercel's `VERCEL_PROJECT_PRODUCTION_URL` for canonical and Open Graph URLs.

### Feedback storage

To make the feedback form save responses, create a **private Vercel Blob store** in the Vercel project's Storage tab and connect it to the project. Vercel supplies `BLOB_READ_WRITE_TOKEN` to the connected environment. Deploy again after connecting it. Responses are written to private `feedback/*.json` blobs. Email is optional and never goes to analytics. If the store is missing, the form preserves the visitor's answers and shows an availability message instead of claiming the submission succeeded.

## Local development

Use Node.js 22.13 or later. Run `npm install`, then `npm run dev`. Run `npm run typecheck` and `npm run build` before publishing. For local feedback storage, provide a private Blob store token in `.env.local` (never commit the token). The `.env.example` file documents all configuration keys.

The outfit examples on the page are illustrative previews from a small sample wardrobe; the AI application is a separate next stage. The generated wardrobe photo and its crops are included in `public/`.
