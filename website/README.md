# Loom Web

Website for [Loom](https://github.com/yash249114/loom) — a local-first AI coding agent CLI.

Built with Next.js 16, TypeScript, Tailwind CSS, and Framer Motion.

## Pages

- `/` — Landing page with hero, features, and terminal demo
- `/features` — Full feature listing
- `/providers` — Provider adapters and setup guides
- `/docs` — Documentation and FAQ
- `/download` — Install guides for all platforms
- `/changelog` — Release notes

## Responsive behaviour

The site adapts from 320px phones up to ultrawide desktops. See
[RESPONSIVE.md](./RESPONSIVE.md) for the layout system, canvas and navigation
behaviour, and the tested viewport matrix.

## Development

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build

```bash
pnpm build
```

## Deploy

Deploy to Vercel with the Vercel CLI or Git integration:

```bash
pnpm vercel
```

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md).
