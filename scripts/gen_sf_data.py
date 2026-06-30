#!/usr/bin/env python3
"""Generate Salesforce-bound test data CSVs (parents only: restaurants,
customers, drivers). Child records (dishes, ingredients) and external data are
produced by later steps that need the loaded record Ids."""
import csv, os, random

random.seed(42)
OUT = os.path.join(os.path.dirname(__file__), "..", "data")
OUT = os.path.abspath(OUT)
os.makedirs(OUT, exist_ok=True)

CUISINES = ["Indian", "Chinese", "Pizza", "Burger", "Sushi", "Thai", "Mexican",
            "Italian", "Greek", "Lebanese"]
ALLERGENS = ["Nuts", "Gluten", "Dairy", "Shellfish", "Soy", "Eggs", "Fish", "Sesame"]
CLUSTER = "Amsterdam-Centrum-Cluster"

# Amsterdam streets for plausible addresses
STREETS = ["Damrak", "Prinsengracht", "Herengracht", "Kalverstraat", "Leidsestraat",
           "Rokin", "Nieuwezijds Voorburgwal", "Spuistraat", "Utrechtsestraat",
           "Haarlemmerstraat", "Jodenbreestraat", "Weteringschans", "Vijzelstraat",
           "Ferdinand Bolstraat", "Overtoom", "Wibautstraat", "Czaar Peterstraat",
           "Javastraat", "Bilderdijkstraat", "Van Woustraat"]

def amsterdam_address(i):
    return f"{random.randint(1,250)} {STREETS[i % len(STREETS)]}, 10{random.randint(10,99)} AB Amsterdam"

# ---------------------------------------------------------------------------
# Restaurants (Account, Restaurant record type) — 20, first 5 clustered
# ---------------------------------------------------------------------------
NAMES = ["Taj Palace", "Golden Dragon", "Bella Napoli", "Burger Boulevard",
         "Sakura Sushi", "Bangkok Bites", "El Sombrero", "Trattoria Roma",
         "Athena Grill", "Beirut Garden", "Spice Route", "Wok This Way",
         "Pizza Pronto", "Patty Stack", "Tokyo Table", "Chiang Mai Kitchen",
         "Casa Mexicana", "Milano Mia", "Olympus Eats", "Cedar & Sumac"]

with open(os.path.join(OUT, "Restaurants.csv"), "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["Name", "Restaurant_Address__c", "Restaurant_Type__c",
                "Customer_Rating__c", "Cluster_Group__c", "RecordTypeId"])
    for i, name in enumerate(NAMES):
        cuisine = CUISINES[i % len(CUISINES)]
        rating = round(random.uniform(3.5, 4.9), 1)
        cluster = CLUSTER if i < 5 else ""
        # RecordTypeId resolved at load time via record-type developerName mapping
        w.writerow([name, amsterdam_address(i), cuisine, rating, cluster, "Restaurant"])

# ---------------------------------------------------------------------------
# Customers (Contact) — 50, with allergies/address/preferences
# ---------------------------------------------------------------------------
FIRST = ["Sanne", "Daan", "Emma", "Lucas", "Julia", "Sem", "Tess", "Finn", "Sara",
         "Bram", "Lotte", "Thomas", "Anna", "Milan", "Eva", "Noah", "Fleur", "Liam",
         "Sophie", "Levi", "Mila", "Jesse", "Nora", "Ruben", "Roos", "Tim", "Lara",
         "Stijn", "Maud", "Gijs", "Femke", "Niels", "Iris", "Sven", "Lieke", "Bas",
         "Esther", "Joost", "Marit", "Pim", "Yara", "Koen", "Sterre", "Wout",
         "Britt", "Teun", "Noor", "Jens", "Amber", "Floris"]
LAST = ["de Vries", "Jansen", "van Dijk", "Bakker", "Visser", "Smit", "Meijer",
        "Mulder", "de Boer", "Bos", "Vos", "Peters", "Hendriks", "van Leeuwen",
        "Dekker", "Brouwer", "de Wit", "Dijkstra", "Smits", "de Graaf"]

def pick_allergies():
    r = random.random()
    if r < 0.45:
        return ""                       # ~45% no allergies (TC-01 path)
    n = random.choice([1, 1, 2])
    return ";".join(random.sample(ALLERGENS, n))

with open(os.path.join(OUT, "Customers.csv"), "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["FirstName", "LastName", "Email", "Phone",
                "Delivery_Address__c", "Allergies__c", "Preferences__c"])
    for i in range(50):
        fn = FIRST[i % len(FIRST)]
        ln = LAST[i % len(LAST)]
        email = f"{fn.lower()}.{ln.split()[-1].lower()}{i+1}@example.com"
        phone = f"+316{random.randint(10000000,99999999)}"
        prefs = random.choice(["Vegetarian-friendly", "Loves spicy", "Low-budget",
                               "Prefers fast delivery", "Family portions", ""])
        w.writerow([fn, ln, email, phone, amsterdam_address(i),
                    pick_allergies(), prefs])

# ---------------------------------------------------------------------------
# Drivers (Driver__c) — 10
# ---------------------------------------------------------------------------
with open(os.path.join(OUT, "Drivers.csv"), "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["Name", "Available__c", "Phone__c", "Current_Latitude__c",
                "Current_Longitude__c", "Vehicle_Plate__c"])
    for i in range(10):
        fn = FIRST[(i*3) % len(FIRST)]
        ln = LAST[(i*2) % len(LAST)]
        lat = round(52.37 + random.uniform(-0.03, 0.03), 6)
        lon = round(4.90 + random.uniform(-0.03, 0.03), 6)
        plate = f"{random.randint(10,99)}-{random.choice('ABFGHJKLNPRST')}{random.choice('ABFGHJKLNPRST')}{random.choice('ABFGHJKLNPRST')}-{random.randint(1,9)}"
        w.writerow([f"{fn} {ln}", "true" if random.random() > 0.2 else "false",
                    f"+316{random.randint(10000000,99999999)}", lat, lon, plate])

print("Generated Restaurants.csv (20), Customers.csv (50), Drivers.csv (10) in", OUT)
