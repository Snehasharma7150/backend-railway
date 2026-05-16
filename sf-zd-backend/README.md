# Salesforce ↔ Zendesk Sync Backend

Node.js + Express backend that powers the Zendesk sidebar app and keeps
Salesforce and Zendesk in sync.

## Directory structure

```
sf-zd-backend/
├── .env.example
├── package.json
├── scripts/
│   └── migrate.js          # creates SQLite tables (run once)
└── src/
    ├── index.js             # Express entry point
    ├── db/
    │   ├── index.js         # SQLite singleton
    │   └── mappings.js      # all DB read/write helpers
    ├── middleware/
    │   └── auth.js          # X-App-Secret validation
    ├── routes/
    │   ├── cases.js         # GET /cases/:id, POST /sync/:id
    │   ├── webhooks.js      # POST /webhooks/salesforce|zendesk
    │   └── health.js        # GET /health
    └── services/
        ├── salesforce.js    # jsforce connection + queries
        ├── zendesk.js       # node-zendesk wrappers
        └── sync.js          # the three sync flows + sidebar payload
```

## Quick start

```bash
cp .env.example .env        # fill in your credentials
npm install
npm run migrate             # creates data/mappings.db
npm run dev                 # starts with nodemon
```

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /health | none | Liveness check + last 5 sync events |
| GET | /cases/:sfCaseId | X-App-Secret | Sidebar data payload |
| POST | /sync/:sfCaseId | X-App-Secret | Manual sync trigger |
| POST | /webhooks/salesforce | none* | Inbound SF event |
| POST | /webhooks/zendesk | none* | Inbound ZD webhook |

*Add Salesforce Outbound Message certificate verification or Zendesk
webhook signature validation before going to production.

## Sync flows

1. **Account → Org**: finds or creates a Zendesk Organization by name,
   stores `sf_account_id ↔ zd_org_id` in SQLite.

2. **Contact → User**: deduplicates by email, creates/updates the Zendesk
   user, links to the org from step 1.

3. **Case → Ticket**: creates/updates the Zendesk ticket, stores the
   SF Case ID in a custom ticket field, links requester + org from steps 1–2.

All flows are idempotent — safe to call on every webhook event.

## Deploy

Works out of the box on Railway, Render, or Fly.io.  
Set all env vars from `.env.example` in your hosting dashboard.

For AWS Lambda, wrap `src/index.js` with `serverless-http`.
