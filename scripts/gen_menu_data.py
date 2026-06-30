#!/usr/bin/env python3
"""Generate dishes (20/restaurant) and ingredients (8/dish) CSVs, keyed to the
actual restaurant Account Ids queried from the org. Run AFTER restaurants load.

Dishes CSV uses the restaurant Id directly in the Restaurant__c lookup column.
Ingredients reference their parent dish by a temporary external key resolved
after dishes are loaded (handled by the loader step)."""
import csv, json, os, random

random.seed(7)
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA = os.path.join(ROOT, "data")

restaurants = json.load(open(os.path.join(DATA, "_restaurants.json")))["result"]["records"]

ALLERGENS = ["Nuts", "Gluten", "Dairy", "Shellfish", "Soy", "Eggs", "Fish", "Sesame"]
CATEGORIES = ["Starter", "Main", "Side", "Dessert", "Drink"]

# Cuisine -> dish names (>=20 each so every restaurant gets 20 distinct dishes)
DISHES = {
    "Indian": ["Chicken Tikka Masala","Lamb Rogan Josh","Palak Paneer","Butter Chicken",
        "Vegetable Biryani","Chicken Korma","Dal Makhani","Aloo Gobi","Tandoori Chicken",
        "Chicken Vindaloo","Samosa Chaat","Garlic Naan","Onion Bhaji","Saag Aloo",
        "Prawn Masala","Chana Masala","Paneer Tikka","Mango Lassi","Gulab Jamun","Raita"],
    "Chinese": ["Kung Pao Chicken","Sweet and Sour Pork","Beef Chow Mein","Spring Rolls",
        "Egg Fried Rice","Dim Sum Platter","Mapo Tofu","Peking Duck","Wonton Soup",
        "Char Siu Pork","Hot and Sour Soup","Sesame Chicken","Dumplings","Chow Fun",
        "Salt and Pepper Squid","Crispy Beef","Vegetable Spring Roll","Fortune Cookie",
        "Prawn Toast","Egg Drop Soup"],
    "Pizza": ["Margherita","Pepperoni","Quattro Formaggi","Diavola","Marinara",
        "Capricciosa","Hawaiian","Prosciutto e Funghi","Vegetariana","Calzone",
        "Garlic Bread","Bruschetta","Caprese Salad","Tiramisu","Bufalina",
        "Quattro Stagioni","Napoli","Salami Piccante","Focaccia","Panna Cotta"],
    "Burger": ["Classic Cheeseburger","Bacon Deluxe","Veggie Burger","Double Smash",
        "BBQ Burger","Mushroom Swiss","Spicy Jalapeno","Chicken Burger","Fish Burger",
        "Sweet Potato Fries","Onion Rings","Loaded Fries","Caesar Salad","Milkshake",
        "Pulled Pork Burger","Halloumi Burger","Truffle Fries","Coleslaw","Brownie","Cola Float"],
    "Sushi": ["Salmon Nigiri","Tuna Sashimi","California Roll","Spicy Tuna Roll",
        "Dragon Roll","Tempura Prawn Roll","Miso Soup","Edamame","Eel Avocado Roll",
        "Rainbow Roll","Gyoza","Seaweed Salad","Chicken Teriyaki","Unagi Don",
        "Salmon Avocado Roll","Vegetable Maki","Chirashi Bowl","Mochi Ice Cream",
        "Yakitori","Green Tea"],
    "Thai": ["Pad Thai","Green Curry","Red Curry","Tom Yum Soup","Massaman Curry",
        "Som Tum Salad","Spring Rolls","Satay Skewers","Pad See Ew","Khao Pad",
        "Tom Kha Gai","Panang Curry","Larb Gai","Mango Sticky Rice","Pad Krapow",
        "Thai Fish Cakes","Drunken Noodles","Coconut Soup","Thai Iced Tea","Roti"],
    "Mexican": ["Chicken Tacos","Beef Burrito","Quesadilla","Nachos Supreme","Enchiladas",
        "Carnitas Bowl","Guacamole and Chips","Chilli Con Carne","Fajitas","Churros",
        "Fish Tacos","Veggie Burrito","Elote","Tamales","Tostada","Pozole",
        "Sopapilla","Horchata","Refried Beans","Salsa Verde"],
    "Italian": ["Spaghetti Carbonara","Lasagne","Penne Arrabbiata","Risotto Funghi",
        "Fettuccine Alfredo","Ravioli","Gnocchi","Minestrone","Bruschetta","Tiramisu",
        "Osso Buco","Linguine Vongole","Caprese Salad","Panna Cotta","Spaghetti Bolognese",
        "Margherita Flatbread","Arancini","Cannoli","Garlic Focaccia","Affogato"],
    "Greek": ["Gyros Plate","Souvlaki Skewers","Greek Salad","Moussaka","Spanakopita",
        "Tzatziki and Pita","Dolmades","Halloumi Fries","Lamb Kleftiko","Baklava",
        "Pastitsio","Keftedes","Fava Dip","Octopus Salad","Feta Saganaki",
        "Chicken Souvlaki Wrap","Loukoumades","Greek Yogurt Bowl","Horiatiki","Ouzo Sorbet"],
    "Lebanese": ["Chicken Shawarma","Falafel Wrap","Hummus and Pita","Tabbouleh","Fattoush",
        "Lamb Kofta","Baba Ganoush","Mixed Mezze","Manakish","Baklava",
        "Shish Taouk","Kibbeh","Moutabal","Vine Leaves","Lentil Soup",
        "Halloumi Skewers","Muhammara","Knafeh","Labneh Bowl","Rose Lemonade"],
}

# Ingredient -> allergen mapping (so allergen flags are realistic & TC-02/TC-06 work)
ALLERGEN_INGREDIENTS = {
    "Nuts": ["Peanuts","Cashews","Almonds","Peanut Sauce","Pistachios"],
    "Gluten": ["Wheat Flour","Soy Sauce","Breadcrumbs","Naan Bread","Pasta","Pita Bread","Flour Tortilla"],
    "Dairy": ["Cheese","Cream","Butter","Yogurt","Milk","Paneer","Feta","Halloumi"],
    "Shellfish": ["Prawns","Shrimp","Crab","Squid","Lobster"],
    "Soy": ["Tofu","Soy Sauce","Edamame","Soybean Oil"],
    "Eggs": ["Egg","Mayonnaise","Egg Noodles"],
    "Fish": ["Salmon","Tuna","Eel","Anchovy","Fish Sauce"],
    "Sesame": ["Sesame Seeds","Sesame Oil","Tahini"],
}
NEUTRAL = ["Onion","Garlic","Tomato","Bell Pepper","Coriander","Cumin","Rice","Olive Oil",
           "Lemon","Ginger","Chilli","Salt","Black Pepper","Spinach","Carrot","Potato",
           "Basil","Parsley","Chickpeas","Lettuce","Mint","Paprika","Lime","Scallion"]

dish_rows = []         # (Restaurant__c[Id], Name, Price, Category, Available, Prep)
ingredient_rows = []   # (RestaurantId, DishName, IngredientName, AllergenType)

for r in restaurants:
    rid = r["Id"]
    cuisine = r["Restaurant_Type__c"]
    names = DISHES.get(cuisine, DISHES["Italian"])[:20]
    for di, dname in enumerate(names):
        price = round(random.uniform(4.5, 24.0), 2)
        category = CATEGORIES[di % len(CATEGORIES)]
        avail = "true" if random.random() > 0.08 else "false"
        prep = random.randint(8, 35)
        dish_rows.append([rid, dname, price, category, avail, prep])

        # 8 ingredients per dish; bias allergen presence by dish name keywords
        # Decide 0-3 allergens for this dish
        n_all = random.choices([0,1,2,3], weights=[35,35,20,10])[0]
        chosen_allergens = random.sample(ALLERGENS, n_all)
        ing_set = []
        for a in chosen_allergens:
            ing_set.append((random.choice(ALLERGEN_INGREDIENTS[a]), a))
        # fill remainder with neutral ingredients up to 8
        neutrals = random.sample(NEUTRAL, 8 - len(ing_set))
        for n in neutrals:
            ing_set.append((n, "None"))
        random.shuffle(ing_set)
        for iname, atype in ing_set[:8]:
            ingredient_rows.append([rid, dname, iname, atype])

# Write dishes CSV (loaded directly — Restaurant__c holds the Account Id)
with open(os.path.join(DATA, "Dishes.csv"), "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["Restaurant__c", "Name", "Price__c", "Category__c",
                "Available__c", "Prep_Time_Minutes__c"])
    w.writerows(dish_rows)

# Write ingredients staging CSV (RestaurantId+DishName resolved to Food_Option__c Id later)
with open(os.path.join(DATA, "Ingredients_staging.csv"), "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["RestaurantId", "DishName", "Name", "Allergen_Type__c"])
    w.writerows(ingredient_rows)

print(f"dishes: {len(dish_rows)} (expect 400), ingredients: {len(ingredient_rows)} (expect 3200)")
