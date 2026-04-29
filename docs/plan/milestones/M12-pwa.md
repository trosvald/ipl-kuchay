# Milestone 12 - PWA

Source sections:

- Master plan sections 13.12, 22 Milestone 12.

Goal:

- App is installable and mobile-friendly without caching private data.

Files to create/change:

- `public/manifest.webmanifest`
- `public/robots.txt`
- `public/icons/*`
- `lib/registerServiceWorker.ts`
- `features/pwa/InstallPrompt.tsx`
- `app/layout.tsx` or `app/providers.tsx` for service worker registration hooks
- service worker file, for example `public/sw.js`.

PWA contract:

- App name: `IPL Jatiloka Residence`.
- Cache shell/static assets only.
- Do not cache Supabase REST/Auth/Storage responses.
- Do not cache signed proof URLs.
- Auth callback route must continue to work after service worker registration.

Tasks:

1. Add manifest.
2. Add icons.
3. Add service worker.
4. Register service worker.
5. Cache app shell only.
6. Add install prompt UI.
7. Test auth callback and app routes with service worker enabled.

Acceptance:

- Basic PWA installability passes.
- App can be installed on mobile browser.
- Supabase auth still works.
- Authenticated API responses and proof files are not cached.
- Install prompt is Indonesian: `Install aplikasi`.

Out of scope:

- Do not implement offline mutation queues for payments.

Verification:

```bash
npm run typecheck
npm run test
npm run build
```
