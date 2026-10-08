# @thinkabell/edge-worker

Cloudflare Worker for ThinkaBell edge geo-routing and affiliate link localization.

## Responsibilities

- Geo-based Amazon affiliate routing (`/go/amazon/:asin`)
- Edge header injection (`x-thinkabell-country`, `x-thinkabell-city`)
- Security and caching metadata augmentation
- Proxy pass-through to Hostinger origin

## Local Development

```bash
pnpm --filter @thinkabell/edge-worker dev
```

## Deployment

```bash
pnpm --filter @thinkabell/edge-worker deploy
```

See `docs/CLOUDFLARE_SETUP.md` for full configuration.
