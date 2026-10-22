# Everyday Essentials Retail

A frontend-only retail management prototype for a single-location shop. The app demonstrates inventory, point of sale, sales receipts, purchases, suppliers, expenses, customer records, reporting, and local workspace settings.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sample records are loaded on the first visit. Changes persist in the current browser using local storage; use the same browser profile to see them after a refresh.

## Checks

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## Prototype notes

- No backend, authentication, payment gateway, or external API is connected.
- The profile switcher previews owner and cashier navigation. It is not authentication or authorization.
- Payment entries are locally recorded confirmations only. Verify Mobile Money and card payments outside this prototype.
- Receipt printing uses the browser print dialog; choose “Save as PDF” to download a PDF.
- Profit reports estimate gross profit using sale-time item costs and subtract paid operating expenses dated in the selected period. Unpaid expenses and accrual accounting are excluded.
- Data in local storage is browser-local and is not a secure or production database.


