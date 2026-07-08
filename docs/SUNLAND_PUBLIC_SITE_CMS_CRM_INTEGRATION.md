# Sunland — Public Site (sunland.co.ke) CMS/CRM Integration Note

Date: 2026-06-29
Status: **Forward-looking integration note — explicitly outside the primary ERP scope.** Captured now so the ERP data model is built with this integration in mind (cheap to design for now, expensive to retrofit later). Nothing here is committed work; it's the plan for when/if the public site is folded into the ecosystem.

> **Why bother now, if it's out of scope?** Because the public site is where **leads are born** and where **listings are published** — the two things the ERP's CRM (`leads`, `contacts`) and property (`properties`) modules already own. If the ERP is built so the public site can read listings and write inquiries directly into it, then reworking sunland.co.ke later is a thin presentation layer, not a second system. If it's built ignoring the site, you get the classic split: a marketing site with its own CMS and its own contact-form inbox that never reaches the CRM.

---

## 1. The integration thesis

sunland.co.ke should become a **read/write client of the ERP**, not a separate app:

- **Listings (read):** public property pages render from the ERP `properties` table (filtered to `listing_type` + a `is_published` flag), so the sales/BD team publishes a listing once, in the ERP, and it appears on the site. No duplicate data entry, no stale listings.
- **Inquiries (write):** every "Enquire / Book a viewing / Request valuation / Contact" form on the site `POST`s into the ERP as a **lead** (`leads` + `contacts`), attributed to source, landing directly in the BD/Line-Manager pipeline. No form-to-email dead end.
- **Content (CMS):** editorial content (about, services, team, blog/insights) is managed in a lightweight CMS surface in the ERP (or a headless CMS the ERP proxies), so Front-Office/Marketing edits copy without a deploy.

This is the same CMS+CRM integration philosophy applied in Andishi (public marketing site reads testimonials/blog/work from the ERP and writes contact/newsletter/careers into it) — a proven pattern to lift.

---

## 2. What the ERP must expose (design-for-it-now, build-it-later)

Small, additive design choices in the ERP that make the future integration trivial:

1. **Publishing flags on `properties`:** `isPublished boolean`, `publishedAt`, `slug` (unique, SEO), `seoTitle`, `seoDescription`, and confirm the `media` jsonb is CDN-ready (Cloudinary is already a dependency). Align `propertyType` to the Sunland.co.ke designations already mandated in the README (`Apartment`, `Commercial`, `House`, `Land`, `Villa`; plus `All Properties` as a filter, not a type).
2. **A public read API** (`/api/public/listings`, `/api/public/listings/[slug]`) — unauthenticated, returns only published, entity-appropriate fields, cacheable at the edge/Upstash. Never exposes owner/landlord/financial fields.
3. **A public inquiry API** (`/api/public/inquiries`) — unauthenticated `POST`, rate-limited, validated (Zod), that calls the same CRM lead-intake service internal forms use (one write path — backend master §1). Deduplicates against existing open leads; attributes `source` (which page/campaign). This mirrors Andishi's `recordIntakeLead()` single intake path.
4. **A CMS content model** — either `content_pages`/`content_blocks` tables in the ERP, or a headless CMS (e.g. Sanity/Payload) the ERP reads; decide based on how much non-technical editing the client wants. Keep it behind a `src/lib/services/cms/*` boundary so the choice is swappable.
5. **Shared design tokens** — the public site adopts Terrain Identity tokens (or a public-facing variant) so brand is consistent between the marketing site and the portals a landlord/tenant logs into from it. A landlord clicking "Owner Login" on sunland.co.ke should land in the `/landlord` portal with visual continuity.

---

## 3. SEO & structured data (for the public site itself)

When the site is built/reworked:
- **`RealEstateListing` / `Product` schema.org JSON-LD** per listing (price, location, beds/baths, images) for rich results.
- **`Organization` + `LocalBusiness`** schema for Sunland (address, geo, contact) — the ERP already stores the office coordinates pattern (seen in the Andishi contact page); reuse.
- **`BreadcrumbList`, `FAQPage`** on service/help pages.
- Server-rendered listing pages (Next.js SSR/SSG) for crawlability; `sitemap.xml` generated from published `properties` + content pages.
- **AI-answer/AEO readiness:** clean semantic headings, concise factual summaries per listing/service so LLM search surfaces them.

(These are site-side concerns; noted for completeness since the ERP is the data source that feeds them.)

---

## 4. The lead lifecycle, end to end (the payoff)

```
Visitor on sunland.co.ke
  → submits "Book a viewing" on a listing (public inquiry API)
  → CRM lead created (leads + contact), source attributed, deduped
  → appears in BD/Line-Manager pipeline (/bd portal)
  → agent qualifies → viewing → offer → (if let) becomes a lease
  → lease creates rental_ledger rows → tenant invited to /tenant portal
  → rent flows through the ledger → landlord sees it in /landlord portal
```

One continuous data spine from anonymous web visitor to posted ledger entry — no re-keying, no separate inboxes, no reconciliation between "the website" and "the system." That is the reason to design the ERP with the site in mind even while the site itself is out of scope.

---

## 5. Explicit non-goals for now

- No public-site code is written in the ERP build until the client greenlights the site rework.
- No CMS is stood up speculatively; the *hooks* (publishing flags, public APIs behind service boundaries) are what get designed in.
- Payments on the public site (e.g. tenant paying rent from a link) route into the `/tenant` portal's payment flow (tenant/landlord doc §3.2), not a separate public checkout.

---

## 6. Checklist of "design-for-it" items to fold into the ERP build

- [ ] `properties`: `isPublished`, `publishedAt`, `slug`, `seoTitle`, `seoDescription`; `propertyType` aligned to site designations.
- [ ] CRM lead-intake is a single service function callable by internal forms *and* a future public inquiry API.
- [ ] Reserve `/api/public/*` namespace; keep it unauthenticated + rate-limited + read-only (except inquiry POST).
- [ ] Keep CMS behind `src/lib/services/cms/*` so the storage choice is swappable.
- [ ] Terrain Identity tokens exportable to a public-facing theme for brand continuity into the login/portal.
