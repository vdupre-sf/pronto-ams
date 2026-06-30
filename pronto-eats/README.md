# Pronto Eats — customer food-ordering portal

A customer-facing food-delivery portal (Uber-Eats style) for the Pronto demo.
Browse restaurants and menus pulled live from Salesforce, build a cart, and
place an order. Built to later embed an Agentforce ordering assistant.

## Stack

- **React 19 + Vite 7** front end
- **Express 5** server — serves the built `dist/` **and** `/api/*` on one Heroku dyno
- **Salesforce REST** via OAuth `client_credentials` (the `Data360_MCP` External
  Client App, which has the friendly-name `Api` scope added so core REST works)

## Data model (sandbox `l3sandbox`)

- `Account` → restaurant: `Name`, `Restaurant_Type__c` (cuisine),
  `Customer_Rating__c`, `Restaurant_Address__c`, `Latitude__c`/`Longitude__c`
  (real Amsterdam coordinates). `Phone`/`Website`/`Description` are empty.
- `Dish__c` → menu item, related to a restaurant via `Restaurant__c`
  (`Name`, `Price__c` (USD), `Prep_Time_Minutes__c`, `Allergens__c`, `Available__c`)
- `Contact` → customer (login is by `Email`, no password — demo simplification)

Cuisine, rating, address and coordinates are **real Account fields**. Only the
cosmetic bits are derived (`src/data/cuisines.js`): a hero gradient + emoji per
cuisine, a per-dish emoji, and a delivery-time estimate from the real average
`Prep_Time_Minutes__c`.

> **`Dish__c.Category__c` is unusable** — its values are randomly seeded (every
> restaurant has exactly 4 dishes in each of the 5 categories, a round-robin
> fill, so e.g. Baklava was tagged `Drink` and Moussaka `Dessert`). Dishes are
> therefore **classified by name** in `src/data/cuisines.js` (`dishCategory`),
> not by trusting the field.

## API

| Route | Purpose |
|-------|---------|
| `POST /api/login` | Look up a Contact by email → `{ ok, user }` (404 if none) |
| `GET /api/catalog` | All available dishes grouped into restaurants + dishes-by-restaurant (`?refresh=1` busts the 5-min cache) |
| `POST /api/order` | **Client-side only** — echoes back an order number + ETA, logs to console, does **not** write to Salesforce yet |
| `GET /api/health` | Reports whether Salesforce env vars **and** push (VAPID) are configured |
| `GET /api/push/public-key` | Returns the VAPID public key the browser subscribes with |
| `POST /api/push/subscribe` | Registers a device subscription → upserts a `Push_Subscription__c` record |
| `POST /api/push/send` | **Secret-protected** (`X-Push-Secret`). Sends a web push to one contact (`contactId`) or every active subscriber (`all:true`). Called by the Salesforce Apex action |

> Orders are intentionally not persisted. The future Agentforce action / Apex
> will own writing real orders.

## Progressive Web App + push notifications

The site installs to an iPhone home screen and can push notifications to
installed users, triggered from a Salesforce **Flow**.

**Install (iOS):** open the site in Safari → Share → *Add to Home Screen*. iOS
only allows Web Push for PWAs launched from the home screen (iOS 16.4+), so the
in-app 🔔 bell guides users to install first, then to allow notifications.

**How a push flows end-to-end:**

```
PWA (service worker)                Heroku (Express)                 Salesforce
  subscribe ───────────────────────▶ POST /api/push/subscribe ─────▶ upsert Push_Subscription__c
                                                                       (dedup on SHA-256 of endpoint)
  Flow "Pronto Send Push" ──▶ Apex PushNotificationAction (callout) ──▶ POST /api/push/send
                                      query active subs ◀───────────── (X-Push-Secret header)
  showNotification ◀── web-push ◀──── sign + deliver per device
                                      404/410 → deactivate stale sub ─▶ Active__c = false
```

Salesforce can't do Web Push payload encryption, so Heroku is the transport.
The Apex action ([`PushNotificationAction`](salesforce/force-app/main/default/classes/PushNotificationAction.cls))
is invocable from any Flow and supports **single-contact** or **broadcast**
(`broadcastToAll`) targeting. Run the **Pronto Send Push** flow with inputs
`title`, `message`, and either `contactId` or `broadcastToAll = true`.

### Salesforce metadata (`salesforce/`, deployed to `l3sandbox`)

| Component | Purpose |
|-----------|---------|
| `Push_Subscription__c` | One record per opted-in device (Contact lookup, endpoint, keys, `Active__c`, `Subscription_Key__c` external-id hash for upsert) |
| `PushNotificationAction` (Apex) | `@InvocableMethod` (`callout=true`) that POSTs to `/api/push/send` |
| `Pronto Send Push` (Flow) | Autolaunched flow wrapping the action |
| `Push_Endpoint_URL` / `Push_Shared_Secret` (Custom Labels) | Backend URL + shared secret read by the Apex (the label file is **gitignored** — it holds the secret) |
| `Pronto_Push` (Remote Site Setting) | Allows the Apex callout to the Heroku app |

> Two org-specific gotchas were hit and worked around:
> 1. **This SDO sandbox rejects all CustomMetadata-record deploys** with
>    `UNKNOWN_EXCEPTION`, so config lives in **Custom Labels** instead of a
>    custom metadata type.
> 2. **MDAPI-deployed custom fields get no field-level security** by default —
>    the integration user's SOQL failed with *"No such column"* until FLS was
>    granted via the `Admin` profile (`profiles/Admin.profile-meta.xml`).

## Local development

```bash
npm install
cp .env.example .env      # fill in the four SF_* values
npm run dev               # Vite on :5173, proxies /api → Express on :3000
# in another shell:
node server.js            # Express API on :3000
```

For a production-like run (Express serves the built app):

```bash
npm run build && node server.js   # http://localhost:3000
```

## Environment variables

| Var | Description |
|-----|-------------|
| `SF_INSTANCE_URL` | Salesforce My Domain URL |
| `SF_CLIENT_ID` | Connected/External Client App consumer key |
| `SF_CLIENT_SECRET` | Consumer secret |
| `SF_API_VERSION` | REST API version (default `66.0`) |
| `VAPID_PUBLIC_KEY` | Web Push VAPID public key (sent to the browser) |
| `VAPID_PRIVATE_KEY` | Web Push VAPID private key (server only) |
| `VAPID_SUBJECT` | Contact for the VAPID claim. **Use an `https:` site URL, not `mailto:`** — Apple's Web Push gateway rejects `mailto:` subjects on bogus/reserved domains (e.g. `.example`) with `403 BadJwtToken` (FCM/Mozilla accept them). Currently `https://pronto-eats-demo-4c0e46028dae.herokuapp.com` |
| `PUSH_SHARED_SECRET` | Shared secret required on `/api/push/send` (must match the `Push_Shared_Secret` custom label) |

Generate a VAPID key pair once with:
`node -e "console.log(require('web-push').generateVAPIDKeys())"`

## Deploy (Heroku)

```bash
heroku create <app-name>
heroku config:set SF_INSTANCE_URL=… SF_CLIENT_ID=… SF_CLIENT_SECRET=… SF_API_VERSION=66.0
git push heroku master:main      # local branch is master; Heroku builds main
```

`heroku-postbuild` runs `npm run build`, and the `web` dyno runs `node server.js`.
