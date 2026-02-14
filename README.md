# FinanceFlow (v1)

Production-oriented personal finance app with multi-account, multi-currency, and AI-assisted imports.

## 1) Stack Decision

### Option A: Next.js + Prisma + Postgres + pg-boss (Chosen)
- Pros: fastest full-stack delivery, one TypeScript codebase, strong dashboard UX, native file upload support, simple local dev.
- Cons: tighter coupling between frontend/backend layers; queue throughput lower than dedicated microservice architecture.

### Option B: NestJS API + React (Vite) frontend + Postgres + Redis/BullMQ
- Pros: stronger service boundaries and scalability.
- Cons: slower iteration, more ops overhead, higher local setup complexity.

### Why Option A won
- Best balance for v1 shippability, maintainability, local Mac setup simplicity, and cost.
- Postgres-backed jobs via `pg-boss` avoid adding Redis in v1.

## 2) Domain Model (Prisma)

Core tables:
- `User`: auth identity, base currency.
- `Account`: multiple financial accounts per user.
- `Category`: hierarchy (`level` + `parentId`) for major/subcategory.
- `ClassificationRule`: keyword -> category mapping with priority.
- `Transaction`: one account per transaction, original amount/currency + normalized base amount/currency.
- `FXRate`: cached rates by day and pair.
- `UploadedFile`: secure metadata + extracted raw text.
- `ImportJob`: statement/receipt import lifecycle and status.
- `ImportedTransaction`: dedupe decisions, confidence, proposed category.
- `AIAudit`: full prompt/output audit log for AI extractions.

Migration: `prisma/migrations/20260212230000_init/migration.sql`.

## 3) API Surface

Auth:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`

Core:
- `GET/POST /api/accounts`
- `PATCH /api/accounts/:id`
- `POST /api/accounts/:id/archive` (`archive`/`unarchive`)
- `GET /api/accounts/:id/impact`
- `DELETE /api/accounts/:id` (wizard payload: reassign or block)
- `GET/POST /api/categories`
- `PATCH /api/categories/:id`
- `POST /api/categories/:id/archive` (`archive`/`unarchive`)
- `GET /api/categories/:id/impact`
- `DELETE /api/categories/:id` (wizard payload: reassign or uncategorized, plus child strategy)
- `GET/POST /api/rules`
- `GET/POST /api/transactions`
- `POST /api/transactions/bulk` (bulk assign/clear category, soft delete, restore)
- `PATCH /api/transactions/:id` (full edit + restore)
- `DELETE /api/transactions/:id` (soft delete)
- `DELETE /api/transactions/:id/permanent` (permanent delete, deleted rows only)
- `POST /api/transactions/purge` (empty bin / bulk permanent delete for deleted rows)
- `GET /api/dashboard?preset=day|week|month|year|custom&from&to&currency=NGN|USD`

Imports:
- `POST /api/imports/statement`
- `POST /api/imports/receipt`
- `GET /api/imports/:id` (review with raw text + AI audit)
- `POST /api/imports/:id` (`confirm` / `reject`)

Privacy:
- `POST /api/settings/delete-data`

## 4) AI Pipelines

### Statement import wizard
1. Upload (`CSV/XLSX/PDF/TXT`) with size/type validation.
2. Deterministic parser for CSV/XLSX.
3. AI extraction for TXT/PDF via OpenAI structured JSON schema.
4. Dedupe hash generation and duplicate detection.
5. Rule-based category proposals (+ confidence).
6. Save candidates + transactions, mark job `NEEDS_REVIEW`.
7. User confirms/rejects import.

### Receipt import wizard
1. Upload image/PDF.
2. AI extraction of merchant/date/currency/total (with optional item text captured in notes).
3. Create a single transaction (no line-item rows).
4. User review/confirm.

### Auditing and safety
- Store extracted raw text in `UploadedFile.rawText`.
- Store model prompt + parsed output in `AIAudit`.
- Validate AI outputs with `zod` before persistence.

## 5) FX Strategy

- Store each transaction’s original amount/currency unchanged.
- Normalize into user base currency at write time (`amountBase`, `baseCurrency`).
- Cache FX rates daily in `FXRate`.
- Historical conversion: try Frankfurter day endpoint first for non-current dates.
- Fallback to latest provider (`FX_PROVIDER_URL`) if historical unavailable.
- Dashboard display currency switch converts from normalized base values at query time.

## 6) UI Pages

- `/dashboard`: day/week/month/year/custom filters; consolidated totals, per-account totals, trend, category %, top merchants.
- `/accounts`: multi-account management with edit/archive/delete wizard.
- `/categories`: hierarchy + classification rules + archive/delete lifecycle manager.
- `/transactions`: active transactions + Bin views, full edit, restore, delete (move to bin), permanent delete from Bin, and bulk actions.
- `/imports`: statement + receipt upload, review, confirm/reject with audit artifacts.
- `/settings`: logout + delete my data.

## 7) Local Setup (macOS)

### Prerequisites
- Node.js 20+
- Docker Desktop

### Single command sequence
```bash
cp .env.example .env && docker compose up -d && npm install && npm run prisma:migrate && npm run prisma:seed && npm run dev:all
```

Open [http://localhost:3000](http://localhost:3000)

Demo user from seed:
- Email: `demo@financeflow.local`
- Password: `DemoPass123!`

## 8) Tests

Current core tests:
- `tests/fx-utils.test.ts`
- `tests/categorization.test.ts`
- `tests/dedupe.test.ts`
- `tests/account-management.test.ts`
- `tests/transaction-lifecycle.test.ts`

Run:
```bash
npm test
```

## 9) Security & Privacy

- JWT session in `httpOnly` cookie.
- Secrets via environment variables only.
- Upload hard limits (MIME + size).
- File storage in local private folder (`storage/uploads`).
- Cascade delete + physical file cleanup in "Delete my data" flow.

## 10) Archive vs Delete Semantics

- Accounts:
  - Archive is the default removal mode; archived accounts are hidden from new-entry pickers/import account selection.
  - Existing transactions still reference archived accounts for historical integrity.
  - Explicit delete supports reassigning transactions to another active account, or blocking deletion when transactions exist.
- Transactions:
  - Delete moves a transaction to Bin (`deletedAt` set).
  - Deleted transactions are excluded from normal lists/dashboard by default.
  - Bin provides restore and permanent delete actions, plus empty bin.
- Archive is the default removal mode for categories/subcategories.
- Archived categories are hidden from new-entry pickers (manual entry/import classification), but existing transactions keep historical links and remain visible.
- Restore is supported via unarchive action.
- Delete is explicit and wizard-driven:
  - Reassign references to a target category, or
  - Move all references to system `Uncategorized` (auto-created if missing and protected from deletion).
- Delete operations run in one DB transaction and update references in:
  - transactions
  - classification rules
  - import proposed-category mappings
- Deleting a parent category requires a child strategy:
  - reassign children to another major category, or
  - archive children together, or
  - block until a decision is provided.

## 11) Screenshots (placeholders)

- `docs/screenshots/dashboard.png`
- `docs/screenshots/accounts.png`
- `docs/screenshots/transactions.png`
- `docs/screenshots/imports-review.png`

## 12) Next Improvements (Incoming Features)

1. Add row-level edit in import review so users can fix category/date/amount before confirm.
2. Add explicit account picker in import wizard instead of defaulting to the first account.
3. Add background job progress indicator with auto-refresh (reduce manual `Load job` polling).
4. Add failed-row/error report export (CSV) for unparsed or rejected rows.
5. Add bank/provider import templates (e.g., OPay, GTBank, Wise) with reusable mapping profiles.
6. Add header alias + fuzzy column mapping for non-standard statement headers.
7. Add row stitching for wrapped multi-line transaction descriptions.
8. Add OCR fallback pipeline for scanned PDFs (pdf->image rasterization + cleanup).
9. Add per-row validation diagnostics in review (missing date/amount, ambiguous fields, parse errors).
10. Add anomaly detection (unusual merchant/category spend).
11. Add recurring transaction rules.
12. Add budget planning and alerts by category/account.
13. Add 2FA + email verification.
14. Add export pack (`CSV/PDF`) and encrypted backup.
