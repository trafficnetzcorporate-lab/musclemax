## Why the old image is still showing

iOS aggressively caches `apple-touch-icon` and OG images by URL. Because the file has kept the same path (`/og-image.jpg`) through every regeneration, iOS Safari, the iOS share sheet ("Add to Home Screen"), and social-preview crawlers (LinkedIn, iMessage, Facebook) all serve their cached copy. Query-string cache-busters (`?v=2`) work for browsers but iOS often ignores them on `apple-touch-icon` — the only reliable fix is a **new filename**.

## Fix

1. **Rename the asset to a versioned path** so every cache treats it as a brand-new resource.
   - Copy current `public/og-image.jpg` → `public/og-image-v2.jpg`
   - Delete the old `public/og-image.jpg` (so stale crawlers get a 404 instead of the old image)

2. **Update every reference in `index.html`** from `/og-image.jpg` to `/og-image-v2.jpg`:
   - `<link rel="apple-touch-icon">`
   - `<meta property="og:image">`
   - `<meta name="twitter:image">`

3. **Add iOS-friendly icon sizing hints** so the home-screen icon picks the right asset:
   - Add `sizes="180x180"` to the apple-touch-icon link (iOS prefers this exact size; our image is 1024×1024 so iOS will downscale cleanly).
   - Add `<link rel="apple-touch-icon-precomposed" href="/og-image-v2.jpg">` as a fallback for older iOS Add-to-Home-Screen behavior.

4. **Tell the user how to force-refresh** (no code can override what's already on their phone):
   - iOS Home Screen: long-press the existing Muscle Max icon → Remove → Delete from Home Screen, then re-add. iOS caches the icon at install time and never refetches.
   - Safari preview: Settings → Safari → Clear History and Website Data, OR open the site in a Private tab.
   - Social previews (iMessage/LinkedIn/etc.): use each platform's debugger (e.g. Facebook Sharing Debugger, LinkedIn Post Inspector) to force a re-scrape, or wait — they re-crawl on their own schedule.

## Files touched

- `public/og-image-v2.jpg` (new — copy of current image)
- `public/og-image.jpg` (deleted)
- `index.html` (three URL updates + icon sizing hints)

## Why not a query string

`?v=2` works in normal `<img>` requests but iOS's Add-to-Home-Screen and many social crawlers strip or ignore query strings on icon URLs. Renaming the file is the only fix that works across all of them.
