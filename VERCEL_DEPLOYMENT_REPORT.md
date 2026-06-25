# Vercel Deployment Report — Loom Website

| Field | Value |
|---|---|
| **GitHub Commit SHA** | `434a4f4f4b4a37b4d38ee7189de61456b557933a` |
| **GitHub Tag** | `v0.1.0-beta` |
| **Vercel Project Name** | `loom` |
| **Production URL** | https://loom-eight-omega.vercel.app |
| **Preview URL** | https://loom-g1l60ma5a-yash249114s-projects.vercel.app |
| **Framework Detected** | Next.js |
| **Root Directory Used** | `website/` |
| **Build Command** | `pnpm build` → `next build` |
| **Install Command** | `pnpm install` |
| **Output Directory** | `.next` (Next.js default) |
| **Node Version** | 24.x |
| **Package Manager** | pnpm v10.28.0 (Vercel) |
| **Environment Variables** | None required |

## Build Logs Summary

```
▲ Next.js 16.2.9 (Turbopack)
✓ Compiled successfully in 6.7s
✓ TypeScript check passed in 3.4s (zero errors)
✓ Static pages generated: 6/6 in 274ms
```

## Routes Verified

| Route | Status | Content |
|---|---|---|
| `/` | ✅ 200 | Landing page with hero, features grid, CTA |
| `/features` | ✅ 200 | Features page with 4 categories |
| `/docs` | ✅ 200 | Docs page with FAQ-style sections |
| `/download` | ✅ 200 | Download page with install methods |
| `/changelog` | ✅ 200 | Changelog with timeline |

## Lighthouse Estimate

| Metric | Estimate |
|---|---|
| Performance | High — static site, minimal JS, optimized images |
| Accessibility | Good — semantic HTML, aria-label on menu button |
| Best Practices | Good — clean Next.js config, no mixed content |
| SEO | Good — proper metadata, viewport, semantic structure |

## Notes

- The Vercel project `rootDirectory` was updated from `.` to `website/` for correct automatic git-based deployments.
- A `vercel.json` was added to `website/` to explicitly set framework, build, and install commands.
- The extra `website` project created during initial deployment was cleaned up.

## Deployment Status

🟢 Production Live

### Summary

The Loom marketing website was successfully deployed to Vercel. The deployment:
- Built from the `website/` subdirectory
- Uses Next.js 16.2.9 with Turbopack
- Tailwind CSS v4 for styling
- Framer Motion for animations
- All 5 routes are fully static (pre-rendered at build time)
- Zero TypeScript errors, zero build warnings
- Production domain: https://loom-eight-omega.vercel.app
