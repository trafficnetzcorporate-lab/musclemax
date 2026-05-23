## Goal

Replace `public/og-image.jpg` with a new app-icon-style logo inspired by the uploaded Adonis Index reference: a bold, symbolic muscular torso silhouette emphasizing the V-taper (broad shoulders → narrow waist) that signals "perfect physique" instantly.

## Direction

- **Format**: 1024×1024 square, iOS app-icon proportions with implied rounded-corner composition (so it looks native when used as `apple-touch-icon`).
- **Subject**: Stylized front-facing muscular torso silhouette — shoulders, chest, abs, arms framing the sides. Symbolic and graphic, not photorealistic. No head, no face, no legs, no veins/skin detail that reads "human photo."
- **Style**: High-contrast vector/screenprint look — think Nike, Gymshark, classical Greek statue iconography reduced to a clean mark. Sharp negative-space cuts define the musculature.
- **Color**: Matte black background. Torso rendered in lustrous metallic gold (matches the project's golden-accent design system). Optional subtle gold rim-light to give it dimension.
- **No text, no numbers, no measurement lines** — pure symbol.
- **Mood**: Aspirational, premium, instantly readable at favicon size.

## Files touched

- `public/og-image.jpg` — regenerated (referenced by OG tags, Twitter card, and `apple-touch-icon` in `index.html`; no HTML changes needed).

## QA

- Inspect the generated image at full size and mentally at 60×60 (favicon scale) to confirm the V-taper silhouette still reads.
- Confirm zero text/numerals were rendered (image models occasionally hallucinate letters — regenerate if so).
