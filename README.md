SteamDB-MINI

Real-time Steam game statistics aggregator

Team: Bekeshov Arsen · Shynbulat Kazbek · Naseken Olzhas

Fast feedback loop:

- Instant local preview: run the Django backend locally and start the Angular dev server with `cd frontend && npm start`. Local rebuilds are usually sub-second.
- Faster Vercel sync: run `cd frontend && npm run redeploy:preview:watch`. This builds Angular locally, generates `.vercel/output` on your machine, and uploads the prebuilt output, which is typically much faster than waiting for a full cloud rebuild after each change.
- Production publish: run `cd frontend && npm run redeploy:prod` only when you actually need the live production site updated.
