// Salesforce OAuth (client_credentials) + read helpers for the customer portal.
// Tokens are cached in-memory and refreshed ~60s before expiry.

import crypto from 'crypto';

let cachedToken = null;
let tokenExpiry = 0;

const API_VERSION = process.env.SF_API_VERSION || '66.0';

export function isSalesforceConfigured() {
  return !!(
    process.env.SF_INSTANCE_URL &&
    process.env.SF_CLIENT_ID &&
    process.env.SF_CLIENT_SECRET
  );
}

export async function getSalesforceToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const res = await fetch(`${process.env.SF_INSTANCE_URL}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.SF_CLIENT_ID,
      client_secret: process.env.SF_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    throw new Error(`Salesforce OAuth failed (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  if (data.instance_url) process.env.SF_INSTANCE_URL = data.instance_url;
  tokenExpiry = Date.now() + ((data.expires_in ?? 3600) - 60) * 1000;
  return cachedToken;
}

/** Run a SOQL query and return all records (follows nextRecordsUrl pagination). */
export async function query(soql) {
  const token = await getSalesforceToken();
  let url = `${process.env.SF_INSTANCE_URL}/services/data/v${API_VERSION}/query?q=${encodeURIComponent(soql)}`;
  const records = [];

  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      throw new Error(`SOQL query failed (${res.status}): ${await res.text()}`);
    }
    const data = await res.json();
    records.push(...data.records);
    url = data.done ? null : `${process.env.SF_INSTANCE_URL}${data.nextRecordsUrl}`;
  }
  return records;
}

/** SOQL string-literal escaping (single quotes + backslashes). */
function soqlEscape(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Look up a Contact by email (case-insensitive). Returns a lightweight user
 * object, or null if no contact has that email. This is the "login" — no
 * password, by design (demo: identify any contact in the org by email).
 */
export async function findContactByEmail(email) {
  const recs = await query(
    `SELECT Id, Name, FirstName, Email, Phone, Account.Name, MailingCity
     FROM Contact
     WHERE Email = '${soqlEscape(email.trim())}'
     LIMIT 1`
  );
  if (!recs.length) return null;
  const c = recs[0];
  return {
    id: c.Id,
    name: c.Name,
    firstName: c.FirstName,
    email: c.Email,
    phone: c.Phone,
    city: c.MailingCity,
    accountName: c.Account?.Name || null,
  };
}

/**
 * Fetch the full catalog: every available dish (with its restaurant), grouped
 * server-side into a restaurants list + a dishes-by-restaurant map. One round
 * trip to Salesforce; cached in-memory for a few minutes.
 */
let catalogCache = null;
let catalogExpiry = 0;
const CATALOG_TTL_MS = 5 * 60 * 1000;

export async function getCatalog({ force = false } = {}) {
  if (!force && catalogCache && Date.now() < catalogExpiry) return catalogCache;

  // Note: Dish__c.Category__c exists in the org but its values are randomly
  // seeded (every restaurant has exactly 4 dishes in each of the 5 categories —
  // a round-robin fill, not real categorization). We pass the raw value through
  // but the client classifies dishes by name instead (see src/data/cuisines.js).
  const dishes = await query(
    `SELECT Id, Name, Category__c, Price__c, Prep_Time_Minutes__c, Allergens__c,
            Restaurant__c, Restaurant__r.Name, Restaurant__r.Restaurant_Type__c,
            Restaurant__r.Customer_Rating__c, Restaurant__r.Latitude__c,
            Restaurant__r.Longitude__c, Restaurant__r.Restaurant_Address__c,
            Restaurant__r.Phone, Restaurant__r.Website, Restaurant__r.Description
     FROM Dish__c
     WHERE Available__c = true AND Restaurant__c != null
     ORDER BY Restaurant__r.Name, Name`
  );

  const byRestaurant = new Map();
  for (const d of dishes) {
    const rid = d.Restaurant__c;
    if (!byRestaurant.has(rid)) {
      const a = d.Restaurant__r || {};
      byRestaurant.set(rid, {
        id: rid,
        name: a.Name || 'Restaurant',
        cuisine: a.Restaurant_Type__c || null,        // real picklist (Greek, Thai, Pizza, …)
        rating: a.Customer_Rating__c ?? null,         // real Customer_Rating__c
        lat: a.Latitude__c ?? null,                   // real Amsterdam coordinates
        lng: a.Longitude__c ?? null,
        address: a.Restaurant_Address__c || null,
        phone: a.Phone || null,
        website: a.Website || null,
        description: a.Description || null,
        dishes: [],
      });
    }
    byRestaurant.get(rid).dishes.push({
      id: d.Id,
      name: d.Name,
      category: d.Category__c || null,                // raw (unreliable) — client reclassifies by name
      price: d.Price__c ?? 0,
      prepMinutes: d.Prep_Time_Minutes__c ?? null,
      allergens: d.Allergens__c || null,
    });
  }

  const restaurants = [...byRestaurant.values()].map((r) => {
    const prices = r.dishes.map((d) => d.price).filter((p) => p != null);
    const preps = r.dishes.map((d) => d.prepMinutes).filter((p) => p != null);
    const avgPrep = preps.length ? Math.round(preps.reduce((a, b) => a + b, 0) / preps.length) : 20;
    return {
      id: r.id,
      name: r.name,
      cuisine: r.cuisine,
      rating: r.rating,
      lat: r.lat,
      lng: r.lng,
      address: r.address,
      phone: r.phone,
      website: r.website,
      description: r.description,
      dishCount: r.dishes.length,
      minPrice: prices.length ? Math.min(...prices) : 0,
      maxPrice: prices.length ? Math.max(...prices) : 0,
      avgPrep,
    };
  });

  const dishesById = {};
  for (const [rid, r] of byRestaurant) dishesById[rid] = r.dishes;

  catalogCache = { restaurants, dishes: dishesById, totalDishes: dishes.length };
  catalogExpiry = Date.now() + CATALOG_TTL_MS;
  return catalogCache;
}

// ---------------------------------------------------------------------------
// Push subscriptions (Push_Subscription__c)
//
// Each opted-in device is one record, linked to its Contact. The browser's
// push endpoint is long, so we store it in a Long Text Area and dedupe on a
// SHA-256 hash kept in the Subscription_Key__c external-id field (upsert key).
// ---------------------------------------------------------------------------

function subscriptionKey(endpoint) {
  return crypto.createHash('sha256').update(endpoint).digest('hex');
}

/** Insert-or-update a device subscription, keyed by the endpoint hash. */
export async function upsertPushSubscription({ subscription, contactId, email }) {
  const token = await getSalesforceToken();
  const key = subscriptionKey(subscription.endpoint);
  const body = {
    Contact__c: contactId || null,
    User_Email__c: email || null,
    Endpoint__c: subscription.endpoint,
    P256dh__c: subscription.keys?.p256dh || null,
    Auth__c: subscription.keys?.auth || null,
    Active__c: true,
  };
  const url = `${process.env.SF_INSTANCE_URL}/services/data/v${API_VERSION}` +
    `/sobjects/Push_Subscription__c/Subscription_Key__c/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Subscription upsert failed (${res.status}): ${await res.text()}`);
  }
  return true;
}

/** Active subscriptions — all of them, or just one Contact's. */
export async function getPushSubscriptions({ contactId } = {}) {
  let soql =
    `SELECT Id, Endpoint__c, P256dh__c, Auth__c, Contact__c, User_Email__c ` +
    `FROM Push_Subscription__c WHERE Active__c = true`;
  if (contactId) soql += ` AND Contact__c = '${soqlEscape(contactId)}'`;
  return query(soql);
}

/** Mark a subscription inactive (e.g. the endpoint returned 404/410 = expired). */
export async function deactivatePushSubscription(id) {
  const token = await getSalesforceToken();
  const url = `${process.env.SF_INSTANCE_URL}/services/data/v${API_VERSION}/sobjects/Push_Subscription__c/${id}`;
  await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ Active__c: false }),
  });
}
