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

## Invite Emails

Project creation now sends invite emails for every email-based invitee through
`POST /api/notify/invites`. Configure `RESEND_API_KEY` and `EMAIL_FROM` in `.env.local` to send
real email. Without those values, the API returns preview deliveries so local development does not
pretend an email was sent.

## Supabase Persistence

Projects are persisted through server-only Supabase routes:

- `POST /api/projects` saves draft projects, contributors, invite codes, scenarios, versions,
  chain sessions, submissions, artifacts, and invite delivery status.
- `GET /api/projects/[id]` and `GET /api/projects/invite/[code]` hydrate the dashboard and invite
  join flow from the shared database.
- `POST /api/projects/[id]/register` claims an invite seat, stores the contributor wallet and FFE
  public key, and keeps the browser-only private key out of Supabase.

Apply `../supabase/migrations/20260514170000_ffe_project_persistence.sql` to the Supabase project,
then set `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. Public tables
have RLS enabled; the frontend writes through Next API routes using the server-side service role.

## Live FFE bridge

The frontend now has a server-side bridge for the real SDK path:

- `POST /api/ffe/projects` creates a Coordinator session with `FFE.openSession()`.
- `POST /api/ffe/contributions` uploads contributor data with `FFE.submit()`.
- `POST /api/ffe/contributions/prepare` encrypts and uploads data, then returns a storage root
  for browser wallet submission.
- `GET /api/ffe/sessions/[sessionId]` reads Coordinator status for live dashboard progress.
- `POST /api/ffe/sessions/[sessionId]/artifact` resolves the minted INFT and decrypts the LoRA
  artifact receipt for the project playground.

New projects start as drafts. Contributors open `/join?code=...`, connect a wallet, and register an
X25519 training key. The owner then starts the real Coordinator session from the dashboard, using
the registered wallet/pubkey list. The browser wallet signs `Coordinator.submit()` after the server
prepares the encrypted 0G Storage payload. Set the values in `.env.local.example`, run the
aggregator with the same Coordinator/INFT/storage settings, and enable `USE_REAL_0G_TRAINING=true`
in the aggregator when you want the quorum event to trigger the real 0G fine-tuning service.

The artifact endpoint is still a development bridge: it receives the project participant X25519
private key from the browser cache so it can call the current Node SDK decrypt path. The production
version should move this decryption client-side and keep the recipient key off the server.

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
