#!/usr/bin/env python3
"""Generate External Data CSVs for systems that the PRD places OUTSIDE Salesforce.

Per PRD §5.1 system-of-record table:
  - Orders / Order History  -> AWS (batch -> Data Cloud)
  - Loyalty Tier            -> AWS (batch -> Data Cloud)
  - Driver Availability     -> Snowflake (Zero Copy)
  - Driver GPS              -> Snowflake (Zero Copy, live)
  - Truck Telemetry (temp)  -> Snowflake (Zero Copy, live)
  - Average Delivery Time   -> Data Cloud (Calculated Insight)

These are written to ./External Data/ as CSV ONLY and are NOT uploaded anywhere.
Orders: 200 per restaurant x 20 restaurants = 4000, each tied to a real customer.
"""
import csv, os, random, datetime

random.seed(99)
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA = os.path.join(ROOT, "data")
EXT = os.path.join(ROOT, "External Data")
os.makedirs(EXT, exist_ok=True)

# Load real Salesforce Ids so external records cross-reference the org data
def load_csv(name):
    return list(csv.DictReader(open(os.path.join(DATA, name))))

restaurants = load_csv("_restaurants.json.csv") if os.path.exists(os.path.join(DATA,"_restaurants.json.csv")) else None
# restaurants come from the JSON we already have
import json
restaurants = json.load(open(os.path.join(DATA, "_restaurants.json")))["result"]["records"]
dishes = load_csv("_dishes.csv")
customers = load_csv("_customers.csv")
drivers = load_csv("_drivers.csv")

rest_ids = [r["Id"] for r in restaurants]
rest_name = {r["Id"]: r["Name"] for r in restaurants}
cust_ids = [c["Id"] for c in customers]
cust_email = {c["Id"]: c["Email"] for c in customers}
driver_ids = [d["Id"] for d in drivers]
dishes_by_rest = {}
for d in dishes:
    dishes_by_rest.setdefault(d["Restaurant__c"], []).append(d)

# price lookup by (RestaurantId, DishName) from the generated source file
price_map = {}
for d in load_csv("Dishes.csv"):
    price_map[(d["Restaurant__c"], d["Name"])] = float(d["Price__c"])

LOYALTY_TIERS = ["Bronze", "Silver", "Gold", "Platinum"]
STATUSES = ["Delivered", "Delivered", "Delivered", "Delivered", "Cancelled", "Refunded"]

EPOCH = datetime.datetime(2025, 1, 1)
def rand_dt(max_days=540):
    return EPOCH + datetime.timedelta(
        days=random.randint(0, max_days),
        minutes=random.randint(0, 1439))

# ---------------------------------------------------------------------------
# Orders.csv  (AWS) — 4000 rows, 200 per restaurant
# ---------------------------------------------------------------------------
order_rows = []
order_seq = 1
for rid in rest_ids:
    menu = dishes_by_rest.get(rid, [])
    for _ in range(200):
        oid = f"ORD-{order_seq:06d}"
        order_seq += 1
        cust = random.choice(cust_ids)
        dt = rand_dt()
        group_size = random.choices([1,2,4,6,10,12,15,20],
                                    weights=[20,20,15,12,10,8,10,5])[0]
        n_items = max(1, group_size // 2)
        items = random.sample(menu, min(n_items, len(menu))) if menu else []
        total = round(sum(price_map.get((rid, it["Name"]), 12.0) for it in items) if items else random.uniform(15, 180), 2)
        status = random.choice(STATUSES)
        delivery_min = random.randint(18, 65)
        order_rows.append([
            oid, cust, cust_email[cust], rid, rest_name[rid], group_size,
            len(items), total, status, delivery_min,
            dt.strftime("%Y-%m-%d %H:%M:%S")])

with open(os.path.join(EXT, "Orders.csv"), "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["OrderId","CustomerId","CustomerEmail","RestaurantId","RestaurantName",
                "GroupSize","ItemCount","OrderTotalEUR","Status","DeliveryMinutes","OrderDateTime"])
    w.writerows(order_rows)

# NOTE: Per-customer order history is a rollup of Orders.csv (recomputable as a
# Data Cloud Calculated Insight), so no separate CSV is produced here.

# ---------------------------------------------------------------------------
# Customer_Loyalty_Tier.csv (AWS) — one row per customer
# ---------------------------------------------------------------------------
with open(os.path.join(EXT, "Customer_Loyalty_Tier.csv"), "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["CustomerId","CustomerEmail","LoyaltyTier","LoyaltyPoints","MemberSince"])
    for cust in cust_ids:
        tier = random.choices(LOYALTY_TIERS, weights=[40,30,20,10])[0]
        pts = {"Bronze":random.randint(0,499),"Silver":random.randint(500,1999),
               "Gold":random.randint(2000,4999),"Platinum":random.randint(5000,15000)}[tier]
        since = rand_dt(900)
        w.writerow([cust, cust_email[cust], tier, pts, since.strftime("%Y-%m-%d")])

# ---------------------------------------------------------------------------
# Driver_Availability.csv (Snowflake) — one row per driver
# ---------------------------------------------------------------------------
with open(os.path.join(EXT, "Driver_Availability.csv"), "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["DriverId","Status","ShiftStart","ShiftEnd","ActiveDeliveryId"])
    for did in driver_ids:
        status = random.choice(["Available","Available","On Delivery","Off Shift"])
        active = f"ORD-{random.randint(1,order_seq-1):06d}" if status=="On Delivery" else ""
        w.writerow([did, status, "08:00", "20:00", active])

# ---------------------------------------------------------------------------
# Driver_GPS.csv (Snowflake, live) — recent GPS pings per driver (Amsterdam)
# ---------------------------------------------------------------------------
with open(os.path.join(EXT, "Driver_GPS.csv"), "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["DriverId","Latitude","Longitude","SpeedKph","Heading","ReadingTimestamp"])
    base = datetime.datetime(2026, 6, 29, 12, 0, 0)
    for did in driver_ids:
        for ping in range(10):                      # 10 pings each = 100 rows
            lat = round(52.37 + random.uniform(-0.04, 0.04), 6)
            lon = round(4.90 + random.uniform(-0.04, 0.04), 6)
            ts = base + datetime.timedelta(minutes=ping*2)
            w.writerow([did, lat, lon, random.randint(0,50),
                        random.randint(0,359), ts.strftime("%Y-%m-%d %H:%M:%S")])

# ---------------------------------------------------------------------------
# Truck_Telemetry.csv (Snowflake, live) — temperature readings per active delivery
# Includes some breaches (> SAFE_THRESHOLD 7.0C) to exercise TC-05 logic.
# ---------------------------------------------------------------------------
SAFE_THRESHOLD = 7.0
with open(os.path.join(EXT, "Truck_Telemetry.csv"), "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["DeliveryId","DriverId","TruckTempC","SafeThresholdC","Breach","ReadingTimestamp"])
    base = datetime.datetime(2026, 6, 29, 12, 0, 0)
    for i in range(60):                             # 60 telemetry rows
        did = random.choice(driver_ids)
        delivery = f"ORD-{random.randint(1,order_seq-1):06d}"
        # ~20% breaches
        if random.random() < 0.2:
            temp = round(random.uniform(7.1, 14.0), 1)
        else:
            temp = round(random.uniform(1.0, 6.9), 1)
        ts = base + datetime.timedelta(minutes=i)
        w.writerow([delivery, did, temp, SAFE_THRESHOLD,
                    "true" if temp > SAFE_THRESHOLD else "false",
                    ts.strftime("%Y-%m-%d %H:%M:%S")])

# NOTE: Average delivery time is calculated elsewhere, so no CSV is produced here.

print("External Data written to:", EXT)
for fn in sorted(os.listdir(EXT)):
    n = sum(1 for _ in open(os.path.join(EXT, fn))) - 1
    print(f"  {fn}: {n} rows")
