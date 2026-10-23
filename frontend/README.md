# Training center payments: frontend

A phone-first page that lists the month's debtors and has a form to add a payment.
Built with React, TypeScript and Vite.

```bash
# 1. start the API (in ../backend)
npm run dev

# 2. start this app
npm install
npm run dev          # http://localhost:5173, also on your LAN IP for testing on a phone
```

In dev, requests to `/api/*` go through Vite's proxy to `http://localhost:3000`
(override with `API_URL=http://host:port npm run dev`). For a production build,
set `VITE_API_URL` to the API's address. The API must then allow that origin, or be
served from the same host under `/api`.

## What it does

- Month switcher (‹ ›) shows debtors for any past month or the current one, with the total debt.
- Each row shows the debt in red, the monthly fee, and a bar for how much is paid. Tap the phone icon to call.
- Tap a row to open the payment form with that student and their remaining debt filled in.
  "Добавить оплату" opens the same form with no student selected.
- The amount gets thousand separators as you type and uses the numeric keypad.
  If the payment date falls outside the month you're viewing, the form warns that it
  will count toward that other month.
