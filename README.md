# SurveyConnectHub

A marketplace for geospatial professionals. Clients post surveying, GIS, and drone jobs. Verified professionals apply, contracts are funded via escrow, and payment is released on completion.

## Stack

- **Framework:** Next.js 15 (App Router, TypeScript)
- **Database & Auth:** Supabase (PostgreSQL + RLS)
- **Payments:** Paystack (NGN escrow)
- **Email:** Resend
- **Rate Limiting:** Upstash Redis
- **Styling:** Tailwind CSS
- **Deployment:** Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase project (local or hosted)
- Paystack account (test/live keys)
- Resend account (for email)
- Upstash Redis (for rate limiting)
- ExchangeRate-API key from [exchangerate-api.com](https://www.exchangerate-api.com)

### Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `PAYSTACK_SECRET_KEY` | Paystack secret key (test or live) |
| `RESEND_API_KEY` | Resend API key for sending emails |
| `RESEND_SENDER_EMAIL` | Verified sender email in Resend |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |
| `EXCHANGE_RATE_API_KEY` | API key from [exchangerate-api.com](https://www.exchangerate-api.com) for USD→NGN exchange rates |
| `NEXT_PUBLIC_APP_URL` | The canonical URL where this SurveyConnectHub deployment is hosted |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile public site key for this app's allowed hostnames |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile server secret; keep private and never expose it client-side |

### Setup Steps

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Run database migrations:**
   The project uses Supabase migrations located in `supabase/migrations/`. Apply them in order:
   ```bash
   npx supabase db reset      # Reset and apply all migrations (recommended)
   # OR
   npx supabase db push        # Push any new migrations to the remote
   # OR apply individually:
   npx supabase migration up   # Apply pending migrations
   ```
   These commands must be run from the project root with the `supabase/migrations/` folder present. Migrations are numbered by date and must be applied in ascending order.

4. **Open [http://localhost:3000](http://localhost:3000)** in your browser.

5. **Configure bot protection (required before testing protected flows):**
   - Create a Cloudflare Turnstile widget for the actual deployment hostname and
     `localhost` if local testing is required. Do not use a hostname that is not
     owned or operated for this deployment.
   - Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in the
     deployment environment and local `.env.local` where applicable.
   - For the current deployment, the existing widget should allow
     `www.surveyconnecthub.com` and `survey-connect-hub.vercel.app`. The public
     site key is `0x4AAAAAAFRsmxjU-U_dZObs`; keep the secret key server-side only.
   - Configure the same CAPTCHA provider in Supabase Authentication.
   - Verify login, signup, password recovery, password reset, and job
     application flows in a browser. The repository does not claim that these
     external services are configured or that production smoke tests have
     passed.

### Security handoff

The implementation includes server-side Turnstile verification and CSP
allowances for Turnstile resources. Before handoff, the deployment owner must
provide the actual application URL, configure the Cloudflare and Supabase
settings, apply the database migrations, and run the browser smoke tests.
Do not send secret keys in this document or commit them to Git.

## Project Structure

- `app/` — Next.js App Router pages and API routes
- `components/` — Shared React components
- `lib/` — Utilities, Supabase client config, email helpers
- `supabase/migrations/` — Database migration files
- `public/` — Static assets

## Features

- **Client Dashboard:** Post jobs, manage applications, release payments
- **Professional Dashboard:** Apply to jobs, manage portfolio, track contracts
- **Admin Panel:** Verify professionals, manage platform
- **Paystack Integration:** NGN escrow with exchange rate conversion
- **Email Notifications:** Contract updates, payment alerts, verification
- **Real-time Messaging:** Chat between clients and professionals
