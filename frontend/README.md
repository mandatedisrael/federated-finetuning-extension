This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Live FFE bridge

The frontend now has a server-side bridge for the real SDK path:

- `POST /api/ffe/projects` creates a Coordinator session with `FFE.openSession()`.
- `POST /api/ffe/contributions` uploads contributor data with `FFE.submit()`.
- `POST /api/ffe/contributions/prepare` encrypts and uploads data, then returns a storage root
  for browser wallet submission.
- `GET /api/ffe/sessions/[sessionId]` reads Coordinator status for live dashboard progress.

New projects prefer `wallet-owner` mode when Privy exposes a connected Ethereum wallet: the server
creates the session, but the browser wallet signs `Coordinator.submit()` after the server prepares
the encrypted 0G Storage payload. Projects created without a connected wallet still use the
`server-proxy` fallback. Set the values in `.env.local.example`, run the aggregator with the same
Coordinator/INFT/storage settings, and enable `USE_REAL_0G_TRAINING=true` in the aggregator when you
want the quorum event to trigger the real 0G fine-tuning service.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
