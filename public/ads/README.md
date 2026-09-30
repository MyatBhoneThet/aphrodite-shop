# Your homepage advertisements

1. Save your own banner images in this directory (WebP, JPG or PNG).
2. Use 1600 × 600 pixels, or another 8:3 ratio. Keep important text large for phones.
3. Edit `app/data/home-ads.ts`. Add `image: "/ads/your-banner.webp"` and descriptive `imageAlt` to a slide.
4. Set `href` to the page that should open when clicked, such as `/catalog/laptops`.
5. Add or remove entries to change the number of slides. Rebuild/redeploy for production.

Images are fitted, not cropped. Text slides remain as a fallback if an image is unavailable. The slideshow has arrows, navigation dots, pause controls, and respects reduced-motion preferences. No third-party advertising service or tracking is installed.
