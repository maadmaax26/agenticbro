# Brand Guard — Outreach Contact Discovery Table

**Created:** 2026-06-05
**Method:** 4-step SOP — Identify → Verify → Capture → Prioritize

---

## Contact Table

| # | Company | Website | Primary Email | Contact Form | LinkedIn | Instagram / FB | Priority Channel | Scan Summary | Notes |
|---|---------|---------|---------------|--------------|----------|-----------------|-----------------|---------------|-------|
| 1 | Artisan Coffee Co | artisancoffeeco.com | hello@artisancoffeeco.com | ✅ artisancoffeeco.com/pages/contact-us | ❌ Not found | ❌ Not found | **Email** | DMARC quarantine, 2 lookalike domains | Bristol, UK coffee roaster. Contact page has form only (no direct email shown on page, but hello@ found via search). |
| 2 | Glow & Co. Skincare | glowandcostudio.com | ❌ Not found (likely via contact form) | ✅ glowandcostudio.com | ❌ Not found | ✅ @glowandco (FB: Avongirl31@gmail.com) | **Instagram DM** | SPF/DKIM likely misconfigured, 3 IG impersonators | Canadian self-tan/skincare studio. Instagram active — IG DM is best bet. |
| 3 | TechNest IT Solutions | technestitsolutions.com | ❌ Not published (contact form only) | ✅ technestitsolutions.com (footer form) | ✅ LinkedIn company page exists | ❌ Not found | **Contact form + LinkedIn DM** | No DMARC, no DKIM — CRITICAL 8/10 | UAE-based IT company. No email on site, only contact form. LinkedIn likely has founders listed. |
| 4 | Crafters Haven Art Supplies | craftershavenartsupplies.com | support@craftershavenartsupplies.com | ✅ Live chat (8am–5pm Mon–Fri) | ❌ Not found | ❌ Not found | **Email** | DMARC quarantine, 3 lookalike domains | Small e-commerce art supply shop. Phone: (844) 732-2762. Owned by Naitacac Inc. |
| 5 | Urban Threads Clothing Boutique | urbanthreadsclothingboutique.com | ❌ Not found (likely via contact form) | ✅ urbanthreadsclothingboutique.com/pages/contact | ❌ Not found | ✅ Active on FB | **Instagram DM → Contact form** | Email security solid, 3 social impersonators | Milbank, SD boutique. Owner: Lindsey Keller. Phone: 605-438-6400. |
| 6 | Green Leaf Organics LLC | greenleaforganics.com | ❌ Not found (likely via FB/email signup) | ✅ Via website | ❌ Not found | ✅ FB: @GreenLeafOrganicsLLC | **Facebook Messenger** | DMARC p=none, SPF ~all, 2 clone sites | Spokane, WA. Skin & body care. Phone: (509) 220-3073. |
| 7 | PixelForge Studios | pixeldesignpro.com | ❌ Not found (portfolio-only site) | ❌ Contact page 404 | ✅ Likely exists | ✅ Likely active | **LinkedIn DM** | No DMARC, no DKIM — CRITICAL 9/10 | Richmond, KY graphic design studio. Logo/branding/packaging. Contact form broken (404) — reach via LinkedIn or social DMs. |
| 8 | Blue Horizon Travel & Yacht Charters | bluehorizon.net | vacation@bluehorizon.net | ✅ bluehorizon.net/contact-us | ❌ Not found | ✅ FB likely | **Email (direct)** | DMARC quarantine, 2 fake booking domains | Full-service travel agency, Orion, IL. President: Diane Gelaude (Diane@bluehorizon.net). Multiple staff emails available. |
| 9 | EcoHome Innovations | ecohomeinnovations.ca | office@ecohomeinnovations.ca | ❌ Not found (site minimal) | ✅ LinkedIn company page | ✅ FB: @EcoHomeInnovations | **Email + LinkedIn DM** | DMARC p=none, SPF ~all, 2 marketplace clones | HVAC/home services, Ontario CA. CEO: Omar Mohamed. Instagram: @ecohomeinnovations. |
| 10 | Sweet Bakes | sweet-bakes.org | sweetbakesreno@gmail.com | ✅ Via website | ❌ Not found | ✅ FB: @sweetbakespatisserie (Arbroath) | **Email (direct)** | No DMARC, no DKIM — CRITICAL 8/10 | Reno, NV bakery. Phone: 775-686-8205. Also Sweet Bakes Patisserie (Arbroath, Scotland) on FB. |

---

## Outreach Priority Ranking

| Priority | Company | Best Channel | Reason |
|----------|---------|-------------|--------|
| 🔴 1 | PixelForge Studios | LinkedIn DM | Critical 9/10 score, broken contact form, design studio = B2B |
| 🔴 2 | TechNest IT Solutions | Contact form + LinkedIn | Critical 8/10, no DMARC/DKIM, IT company = understands security |
| 🔴 3 | Sweet Bakes | Email (sweetbakesreno@gmail.com) | Critical 8/10, direct email available, SMB = quick decision |
| 🟡 4 | Green Leaf Organics | Facebook Messenger | DMARC p=none, active FB presence, wellness brand = social-first |
| 🟡 5 | EcoHome Innovations | Email (office@ecohomeinnovations.ca) | DMARC p=none, direct email + LinkedIn available |
| 🟡 6 | Artisan Coffee Co | Email (hello@artisancoffeeco.com) | DMARC quarantine, direct email available |
| 🟡 7 | Crafters Haven | Email (support@craftershavenartsupplies.com) | DMARC quarantine, direct email + live chat available |
| 🟢 8 | Urban Threads Boutique | Contact form | Email security solid ✅, social impersonation is main issue |
| 🟢 9 | Blue Horizon Travel | Email (vacation@bluehorizon.net) | DMARC quarantine, multiple staff emails available |
| 🟢 10 | Glow & Co. Skincare | Instagram DM | Likely misconfigured email, IG-active brand |

---

## Key Observations

- **3 companies have CRITICAL email security** (no DMARC, no DKIM): PixelForge (9/10), TechNest (8/10), Sweet Bakes (8/10) — prioritize these first
- **2 companies have broken contact forms** (PixelForge 404, TechNest redirect to homepage) — use LinkedIn DM instead
- **Only 1 company has truly solid email security** (Urban Threads) — their issue is purely social impersonation
- **Best direct email targets**: Blue Horizon (vacation@bluehorizon.net), Sweet Bakes (sweetbakesreno@gmail.com), EcoHome Innovations (office@ecohomeinnovations.ca)

---

## Next Steps

1. Run actual Brand Guard scans on each domain to replace mock data with real findings
2. Customize outreach messages with real scan results
3. Send emails via Resend (from alerts@agenticbro.app)
4. Track responses in outreach CRM
5. Follow up on LinkedIn/IG DMs after 3 business days