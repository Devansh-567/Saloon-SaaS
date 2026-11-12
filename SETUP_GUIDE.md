# Setup guide (logo, email, online payments)

## 1. Your company logo
Put **one** file in the folder `public/brand/` and name it exactly:

| File name | Notes |
|---|---|
| `logo.png` | Best choice. Wide logo, about 600 x 150 px, transparent background. |
| `logo.webp`, `logo.jpg` or `logo.svg` | Also work. The first one found is used (png, webp, jpg, svg). |

The grey "YOUR LOGO HERE" `logo.svg` already in that folder is only a placeholder; adding `logo.png` replaces it.

Optional: `public/brand/login-bg.jpg` (about 1600 x 1000) becomes a soft background behind the sign-in card.

Then open `src/lib/brand.ts`, set `name`, `tagline` (and `website` if you want), and redeploy.
The logo shows on the sign-in page, the side menu ("Powered by"), the platform admin, and bills / PDFs.

## 2. Forgot-password emails (SMTP)
Set these in your hosting service's environment variables, then redeploy:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=yourname@gmail.com
SMTP_PASS=<Google App Password>
MAIL_FROM="Your Company <yourname@gmail.com>"
APP_URL=https://your-live-address      # reset links use this address
```

* **Gmail:** turn on 2-Step Verification, then create an "App password" at https://myaccount.google.com/apppasswords. Use that 16-letter password as `SMTP_PASS` (not your normal password).
* **Free alternative:** Brevo (300 emails/day free) gives you `SMTP_HOST=smtp-relay.brevo.com`, port 587, and a login/key.
* **Test it** (from your computer, with the same variables in a `.env` file): `npm run email:test -- someone@example.com`
* Until SMTP is set, the "Forgot password" page tells people to ask their salon owner. You can always reset one by hand: `npm run admin:reset-password -- email@x.com NewPassword123`

## 3. Online payments (Razorpay)
Razorpay has no setup fee or monthly fee for the standard plan; it takes a small percentage of each online payment. (Easebuzz is similar, but this project uses Razorpay Payment Links.)

1. Create an account at https://razorpay.com and complete the business verification (KYC) to go live. You can test first with **Test Mode**.
2. Dashboard > Settings > API Keys > generate keys. Set:
   ```
   RAZORPAY_KEY_ID=rzp_live_xxxxx        (or rzp_test_xxxxx for testing)
   RAZORPAY_KEY_SECRET=xxxxx
   ```
3. Dashboard > Settings > Webhooks > Add new webhook:
   * URL: `https://your-live-address/api/webhooks/razorpay`
   * Secret: make up a long random text, and set the same text as `RAZORPAY_WEBHOOK_SECRET`
   * Event to tick: **Payment Link > payment_link.paid**
4. Redeploy. On any unpaid bill, a **Get Payment Link** button now appears. Send the link on WhatsApp; when the customer pays by UPI, card or net banking, the bill updates to Paid by itself.

Notes: works in Indian Rupees only. All payments go to the one Razorpay account whose keys you set (fine for one business; paying several separate salons needs Razorpay Route, which is a bigger change).

## 4. Database changes
This update adds migrations. They run automatically with the Docker setup; otherwise run `npx prisma migrate deploy` (use Neon's direct, non-pooled connection string for that command).

## 5. Speed and many users at once
What is already built in: fast native password hashing (old accounts upgrade automatically the first time they sign in), a single session lookup per page, the sign-in audit log written after the page responds, and database queries that run side by side.

What you must set up on your hosting for the best speed:
* **Same region.** Put the app server and the Neon database in the same region (for India: Mumbai/Singapore for both). Different regions add 100 to 250 ms to every database call.
* **Neon pooled connection.** Use Neon's *pooled* connection string (the host contains `-pooler`) as `DATABASE_URL`, with `?sslmode=require&pgbouncer=true&connection_limit=10`. For `prisma migrate deploy`, temporarily use the direct (non-pooled) string.
* **Keep the database awake.** On Neon's free plan the database sleeps after 5 idle minutes and the next request waits 1 to 3 seconds. Use a paid plan with "scale to zero" turned off, or ping `https://your-live-address/api/health` every few minutes.
* **More than one app server.** The app keeps no data in memory, so you can run several copies behind a load balancer. Sessions, rate limits and files must then use the shared database; set `STORAGE_ROOT` to a shared or persistent disk.
* **CPU.** Give each app server at least 1 full vCPU. Password checks run on background threads (`UV_THREADPOOL_SIZE=16` is already set in the Dockerfile).
