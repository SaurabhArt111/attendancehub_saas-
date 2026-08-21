# AttendanceHub — Marketing Landing Page

A static, dependency-free landing page for AttendanceHub, built to sit alongside
the existing `admin/`, `user/` and `backend/` apps without touching any of their
code or functionality.

## What's in here

```
landing/
├── index.html      # all sections: hero, features, admin/employee experience,
│                    # payroll showcase, how-it-works, gallery, FAQ, final CTA, footer
├── css/style.css    # design system + all component/section styles
├── js/main.js       # theme toggle, mobile menu, scroll reveal, count-up stats,
│                    # FAQ accordion, gallery lightbox — vanilla JS, no build step
├── assets/          # logo + icons copied from admin/public
└── ads.txt          # copied from admin/public/ads.txt for AdSense verification
```

No build tooling, no npm install — open `index.html` in a browser, or serve the
`landing/` folder with any static file server (`python3 -m http.server`, nginx,
Vercel, Netlify, GitHub Pages, etc).

## About the product screenshots

Every "screenshot" on the page (the browser-framed admin views, the phone-framed
employee app, the gallery thumbnails) is a hand-built, pixel-faithful recreation
using the **same CSS custom properties, component classes and icon paths** as the
real `admin/src/index.css` and `user/src/index.css` — not a live capture from a
running instance with real company data. This keeps the marketing site visually
identical to the product while showing realistic, readable sample data (sample
names, salaries, designations) instead of empty states or a specific customer's
real records.

If you'd rather use literal screenshots of your own running instance, you can
swap any `.mock-browser` / `.mock-phone` / `.crop` block in `index.html` for an
`<img>` tag pointing at a real capture — the surrounding layout and captions
will keep working unchanged.

## Things to wire up before going live

1. **Links.** The nav's "Admin Sign In", and the final CTA's "Register Your
   Company" / "Employee Sign In" buttons currently point at `#` or scroll
   anchors. Point them at your deployed admin/user app URLs, e.g.
   `https://app.yourdomain.com/register` and `https://app.yourdomain.com/login`.
2. **AdSense.** Two ad slots are already wired up in `index.html`
   (search for `adsbygoogle`) using the AdSense client ID already present in
   `admin/public/ads.txt`/`manifest`. Replace the two placeholder
   `data-ad-slot` values with real ad unit IDs from your AdSense account, and
   swap `landing/ads.txt` if your publisher ID differs.
3. **Domain / favicon.** `ads.txt` must be served from your site's root
   (`https://yourdomain.com/ads.txt`), so if `landing/` isn't deployed at the
   domain root, move `ads.txt` accordingly.
4. **Legal pages.** "Privacy Policy" and "Terms" in the footer are placeholders
   (`href="#"`) — link them to real pages once you have them.

## Notes

- Fonts (Plus Jakarta Sans / Inter / JetBrains Mono) load from Google Fonts —
  swap the `@import` in `style.css` for self-hosted fonts if you need to avoid
  the external request.
- The light/dark toggle in the header is local to the landing page (stored in
  `localStorage`) and doesn't affect the admin or employee apps' own theme
  settings.
- Nothing in `admin/`, `user/` or `backend/` was modified — this is purely an
  additive `landing/` folder.
