# ToyHub

Full implementation of the `ToyHub.dc.html` Claude Design prototype (see `../README.md`
and `../chats/chat1.md` for the original design brief): a collectible-figure
storefront with member accounts, admin catalogue management, cart/checkout,
pre-order deposits, order tracking, wishlist/demand, and a contact inbox.

Unlike the prototype (which faked everything in `localStorage`), this is a real
client/server app:

- **Frontend**: static HTML/CSS/JS, no framework or build step (native ES modules).
- **Backend**: Node.js + Express + PostgreSQL, with real password hashing
  (bcrypt) and server-side sessions.
- **Payments**: Stripe, in test mode.
- **Email**: mocked — confirmation and tracking emails are logged to the
  `email_log` table (and the console) instead of actually sent. Swap
  `server/lib/mailer.js` for a real provider (Resend, SendGrid, SMTP via
  nodemailer) to send for real.

## Setup

```
npm install
cp .env.example .env   # then edit DATABASE_URL / SESSION_SECRET / Stripe keys
npm run migrate
npm run seed
npm start
```

Visit `http://localhost:3000`. Demo admin account: `admin@toyhub.co` / `admin1234`.

### Stripe (payments)

Checkout works end-to-end once you add **free** Stripe test-mode keys:

1. Create a free account at <https://dashboard.stripe.com/register> — test
   mode needs no business verification.
2. Copy the test **Publishable key** and **Secret key** from
   <https://dashboard.stripe.com/test/apikeys> into `.env`.
3. Restart the server.

Without keys, the app still runs fully — checkout shows a clear "payment
gateway not configured" notice instead of erroring. With keys, use Stripe's
test card `4242 4242 4242 4242`, any future expiry, any CVC.

## Project layout

```
server/            Express API
  index.js           app wiring, sessions, static file serving
  db.js               pg Pool
  migrate.js, seed.js  one-off scripts (npm run migrate / npm run seed)
  migrations/          SQL schema
  routes/               auth, products, wishlist, messages, orders/checkout
  middleware/auth.js    session -> req.user, requireAuth/Admin/Member
  lib/                  helpers, seed data, mailer (mocked), stripe wrapper

public/             Static frontend (served as-is, no build step)
  index.html
  styles.css          Classical design-system tokens + component classes
  js/
    main.js             router + render loop
    state.js            client-side store + actions (talks to the API)
    api.js               fetch wrapper
    dom.js                minimal safe DOM-builder (h())
    views/                one module per screen
```

## Notes / known limitations (carried over from the design brief)

- Card details never touch this server — Stripe Elements collects them
  client-side and the server only creates/verifies PaymentIntents.
- If stock changes between adding to cart and finalizing payment, the order
  is created with whatever stock remains (mirrors the prototype's lenient
  behavior) rather than blocking a captured payment.
- The story section's bench photograph is a fixed placeholder — per the
  design chat, editing it was explicitly locked for everyone, including
  admins.
