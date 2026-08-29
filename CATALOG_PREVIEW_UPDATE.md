# Three-product storefront previews

The store home page now shows three random products in each production group:

- Laptops
- Accessories
- PC Parts

Each group header includes a **View all →** button. The full catalogues are:

- `/catalog/laptops`
- `/catalog/accessories`
- `/catalog/pc-parts`

The full catalogue pages load products in 100-row API batches and display 12
cards at a time. The **Show more** button reveals the next group of cards.

## Important sync restart

Next.js loads `.env.local` when the development server starts. If a Supabase
key was changed while the server was already running, the old process still
uses the previous key and Google Sheet Sync can show `Unauthorized`.

Stop the old server with `Control + C`, then run:

```bash
npm install
npm run dev
```

After the restart, open the admin dashboard, run **Dry Run**, and then click
**Sync Products**. The success banner should say that 464 products were
updated. The number may change later as rows are added or removed from the
Google Sheet.
