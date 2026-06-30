#!/usr/bin/env python3
"""Generate Salesforce metadata for the PRonto Group Ordering PRD.

Objects created in Salesforce (per PRD §5.2 + user instruction that drivers
live in Salesforce):
  - Account: Restaurant record type + fields (Restaurant modeled as Account per PRD)
  - Contact: customer fields (Customer modeled as Contact per PRD)
  - Restaurant_Food_Option__c (menu items)
  - Menu_Ingredient__c (ingredients/allergens)
  - Driver__c (drivers)
External data (Snowflake/AWS/Data Cloud) is NOT modeled here; it goes to CSV.
"""
import os, textwrap

BASE = os.path.join(os.path.dirname(__file__), "..", "force-app", "main", "default")
BASE = os.path.abspath(BASE)

def write(path, content):
    full = os.path.join(BASE, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w") as f:
        f.write(content.rstrip() + "\n")
    print("wrote", os.path.relpath(full, BASE))

# ---------------------------------------------------------------------------
# Field builders
# ---------------------------------------------------------------------------
def field_meta(name, body):
    return (f'<?xml version="1.0" encoding="UTF-8"?>\n'
            f'<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">\n'
            f'    <fullName>{name}</fullName>\n{body}\n</CustomField>\n')

def text_field(name, label, length=255, body_extra=""):
    return field_meta(name, f"""    <label>{label}</label>
    <type>Text</type>
    <length>{length}</length>{body_extra}""")

def textarea_field(name, label):
    return field_meta(name, f"""    <label>{label}</label>
    <type>TextArea</type>""")

def number_field(name, label, precision=18, scale=0):
    return field_meta(name, f"""    <label>{label}</label>
    <type>Number</type>
    <precision>{precision}</precision>
    <scale>{scale}</scale>""")

def currency_field(name, label, precision=18, scale=2):
    return field_meta(name, f"""    <label>{label}</label>
    <type>Currency</type>
    <precision>{precision}</precision>
    <scale>{scale}</scale>""")

def checkbox_field(name, label, default="false"):
    return field_meta(name, f"""    <label>{label}</label>
    <type>Checkbox</type>
    <defaultValue>{default}</defaultValue>""")

def picklist_field(name, label, values, multi=False, length=255):
    vlines = "\n".join(
        f"""            <value>
                <fullName>{v}</fullName>
                <default>false</default>
                <label>{v}</label>
            </value>""" for v in values)
    extra = f"\n    <visibleLines>4</visibleLines>" if multi else ""
    ptype = "MultiselectPicklist" if multi else "Picklist"
    return field_meta(name, f"""    <label>{label}</label>
    <type>{ptype}</type>{extra}
    <valueSet>
        <restricted>true</restricted>
        <valueSetDefinition>
            <sorted>false</sorted>
{vlines}
        </valueSetDefinition>
    </valueSet>""")

def lookup_field(name, label, ref, rellabel, relname, required=False):
    req = "true" if required else "false"
    dc = "Restrict" if required else "SetNull"
    return field_meta(name, f"""    <label>{label}</label>
    <type>Lookup</type>
    <referenceTo>{ref}</referenceTo>
    <relationshipLabel>{rellabel}</relationshipLabel>
    <relationshipName>{relname}</relationshipName>
    <required>{req}</required>
    <deleteConstraint>{dc}</deleteConstraint>""")

def custom_object(label, plural, description, namefield_label, namefield_type="Text",
                  display_format=None, sharing="ReadWrite"):
    if namefield_type == "AutoNumber":
        nf = f"""    <nameField>
        <label>{namefield_label}</label>
        <type>AutoNumber</type>
        <displayFormat>{display_format}</displayFormat>
        <startingNumber>1</startingNumber>
    </nameField>"""
    else:
        nf = f"""    <nameField>
        <label>{namefield_label}</label>
        <type>Text</type>
    </nameField>"""
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>{label}</label>
    <pluralLabel>{plural}</pluralLabel>
    <description>{description}</description>
    <deploymentStatus>Deployed</deploymentStatus>
    <sharingModel>{sharing}</sharingModel>
    <enableActivities>true</enableActivities>
    <enableReports>true</enableReports>
    <enableSearch>true</enableSearch>
{nf}
    <visibility>Public</visibility>
</CustomObject>
"""

ALLERGENS = ["Nuts", "Gluten", "Dairy", "Shellfish", "Soy", "Eggs", "Fish", "Sesame"]
CUISINES = ["Indian", "Chinese", "Pizza", "Burger", "Sushi", "Thai", "Mexican",
            "Italian", "Greek", "Lebanese"]
CATEGORIES = ["Starter", "Main", "Side", "Dessert", "Drink"]

# ---------------------------------------------------------------------------
# Account (Restaurant) — fields + record type
# ---------------------------------------------------------------------------
write("objects/Account/fields/Restaurant_Address__c.field-meta.xml",
      textarea_field("Restaurant_Address__c", "Restaurant Address"))
write("objects/Account/fields/Restaurant_Type__c.field-meta.xml",
      picklist_field("Restaurant_Type__c", "Restaurant Type", CUISINES))
write("objects/Account/fields/Customer_Rating__c.field-meta.xml",
      number_field("Customer_Rating__c", "Customer Rating", precision=3, scale=1))
write("objects/Account/fields/Cluster_Group__c.field-meta.xml",
      text_field("Cluster_Group__c", "Cluster Group", length=80))

# Restaurant record type (picklist value assignment for Restaurant_Type__c)
rt_values = "\n".join(
    f"""        <values>
            <fullName>{v}</fullName>
            <default>false</default>
        </values>""" for v in CUISINES)
write("objects/Account/recordTypes/Restaurant.recordType-meta.xml",
f"""<?xml version="1.0" encoding="UTF-8"?>
<RecordType xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Restaurant</fullName>
    <active>true</active>
    <label>Restaurant</label>
    <description>Restaurants available for Pronto group ordering (Amsterdam set, v1).</description>
    <picklistValues>
        <picklist>Restaurant_Type__c</picklist>
{rt_values}
    </picklistValues>
</RecordType>
""")

# ---------------------------------------------------------------------------
# Contact (Customer) — fields
# ---------------------------------------------------------------------------
write("objects/Contact/fields/Delivery_Address__c.field-meta.xml",
      textarea_field("Delivery_Address__c", "Delivery Address"))
write("objects/Contact/fields/Allergies__c.field-meta.xml",
      picklist_field("Allergies__c", "Allergies", ALLERGENS, multi=True, length=255))
write("objects/Contact/fields/Preferences__c.field-meta.xml",
      text_field("Preferences__c", "Preferences", length=255))

# ---------------------------------------------------------------------------
# Restaurant_Food_Option__c (menu items)
# ---------------------------------------------------------------------------
write("objects/Restaurant_Food_Option__c/Restaurant_Food_Option__c.object-meta.xml",
      custom_object("Restaurant Food Option", "Restaurant Food Options",
        "Menu items (dishes) offered by a Pronto restaurant, including price, category, availability, and prep time. Drives the agent's menu sizing and recommendation logic.",
        "Dish Name"))
write("objects/Restaurant_Food_Option__c/fields/Restaurant__c.field-meta.xml",
      lookup_field("Restaurant__c", "Restaurant", "Account", "Food Options",
                   "Food_Options", required=True))
write("objects/Restaurant_Food_Option__c/fields/Price__c.field-meta.xml",
      currency_field("Price__c", "Price"))
write("objects/Restaurant_Food_Option__c/fields/Category__c.field-meta.xml",
      picklist_field("Category__c", "Category", CATEGORIES))
write("objects/Restaurant_Food_Option__c/fields/Available__c.field-meta.xml",
      checkbox_field("Available__c", "Available", default="true"))
write("objects/Restaurant_Food_Option__c/fields/Prep_Time_Minutes__c.field-meta.xml",
      number_field("Prep_Time_Minutes__c", "Prep Time (Minutes)", precision=4, scale=0))

# ---------------------------------------------------------------------------
# Menu_Ingredient__c (ingredients / allergens)
# ---------------------------------------------------------------------------
write("objects/Menu_Ingredient__c/Menu_Ingredient__c.object-meta.xml",
      custom_object("Menu Ingredient", "Menu Ingredients",
        "Ingredients that make up a menu item, each optionally flagged with an allergen type. The agent compares these against customer allergies to keep group orders food-safe.",
        "Ingredient Name"))
write("objects/Menu_Ingredient__c/fields/Food_Option__c.field-meta.xml",
      lookup_field("Food_Option__c", "Food Option", "Restaurant_Food_Option__c",
                   "Ingredients", "Ingredients", required=True))
write("objects/Menu_Ingredient__c/fields/Allergen_Type__c.field-meta.xml",
      picklist_field("Allergen_Type__c", "Allergen Type", ["None"] + ALLERGENS))

# ---------------------------------------------------------------------------
# Driver__c (drivers — user requested in Salesforce)
# ---------------------------------------------------------------------------
write("objects/Driver__c/Driver__c.object-meta.xml",
      custom_object("Driver", "Drivers",
        "Pronto delivery drivers. Holds availability and last-known GPS coordinates used during live delivery and disruption handling. (In production GPS/telemetry federate from Snowflake; modeled in Salesforce here for v1 test data.)",
        "Driver Name"))
write("objects/Driver__c/fields/Available__c.field-meta.xml",
      checkbox_field("Available__c", "Available", default="true"))
write("objects/Driver__c/fields/Phone__c.field-meta.xml",
      text_field("Phone__c", "Phone", length=40))
write("objects/Driver__c/fields/Current_Latitude__c.field-meta.xml",
      number_field("Current_Latitude__c", "Current Latitude", precision=9, scale=6))
write("objects/Driver__c/fields/Current_Longitude__c.field-meta.xml",
      number_field("Current_Longitude__c", "Current Longitude", precision=9, scale=6))
write("objects/Driver__c/fields/Vehicle_Plate__c.field-meta.xml",
      text_field("Vehicle_Plate__c", "Vehicle Plate", length=20))

print("\nMetadata generation complete.")
