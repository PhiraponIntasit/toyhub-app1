# Deploying ToyHub

Vercel runs the app; Supabase holds the database. Both have a free tier that is
enough for a demo. The whole thing takes about twenty minutes, most of it
waiting for a database to start.

Nothing here is automated on purpose — the two accounts are yours, and the only
secrets involved should be typed into their dashboards rather than committed.

## 1. The database

1. Create a project at <https://supabase.com/dashboard>. Pick the region closest
   to you (Singapore for Thailand) and **write the database password down** —
   it is shown once.
2. Open **Connect** (top of the project page) → **Transaction pooler**. Copy
   that string. It ends in `:6543/postgres`, and the port matters: a serverless
   function opens a connection per invocation, and the pooler is what keeps that
   from exhausting the database.
3. Put the password into the string in place of `[YOUR-PASSWORD]`.

## 2. Create the schema and the seed rows

Run the migrations from your own machine, pointed at Supabase. The simplest way
on Windows is to edit `toyhub/.env`, swap `DATABASE_URL` for the Supabase
string, and run:

```bash
npm run setup      # migrate, then seed
```

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the same `.env` before running it.
Without them the seed creates `admin@toyhub.co` / `admin1234`, which is printed
in this repository — anyone who found the site could sign in and empty the shop.

Put your local `DATABASE_URL` back afterwards.

In PowerShell you can avoid editing the file:

```powershell
$env:DATABASE_URL="postgres://…:6543/postgres"; $env:ADMIN_PASSWORD="…"; npm run setup
```

## 3. The site

1. At <https://vercel.com/new>, import `PhiraponIntasit/toyhub-app1`.
2. **Set Root Directory to `toyhub`.** The repository has the app in a
   subfolder; without this the build finds no `package.json`. Leave the
   framework preset as Other — there is no build step.
3. Add the environment variables:

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | the pooler string from step 1 |
   | `SESSION_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
   | `ADMIN_EMAIL` | the address you seeded with |
   | `ADMIN_PASSWORD` | not read at runtime, but keep it with the rest |
   | `STRIPE_SECRET_KEY` | `sk_test_…` from <https://dashboard.stripe.com/test/apikeys> |
   | `STRIPE_PUBLISHABLE_KEY` | `pk_test_…` from the same page |

   Vercel sets `NODE_ENV=production` itself, which is what turns on the
   `Secure` flag on the session cookie. `app.set('trust proxy', 1)` is already
   in place so the cookie survives Vercel's TLS termination.

4. Deploy.

## 4. Check it

- `https://<your-app>.vercel.app/api/health` should return `{"ok":true}`. If it
  does not, the `DATABASE_URL` is wrong or still points at port 5432.
- Sign in as the administrator and look at the catalogue.
- Register as a customer, reserve a pre-order on a deposit and pay with the test
  card `4242 4242 4242 4242`, any future expiry, any CVC.
- As the administrator, ask for the balance on that order, then settle it as the
  customer with the same test card. The order should end at Ready to ship, and
  `Send tracking` should be refused before it.

Then put the URL at the top of the [README](../README.md).

## Notes

- **No real money.** The Stripe keys are test keys; the publishable key is
  meant to be public, the secret key never leaves Vercel's environment
  settings. If a secret key is ever pasted somewhere it should not be, roll it
  from the Stripe dashboard.
- **Emails are written to the database, not sent.** `server/lib/mailer.js`
  records what would have gone out, and both the customer and the order desk
  read it back. Nothing needs an SMTP account.
- **Redeploying does not touch the data.** Vercel rebuilds the site; the
  migrations are only run when you run them. They are written to be safe to
  repeat.
