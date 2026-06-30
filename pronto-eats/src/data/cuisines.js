// Presentation helpers. The org now gives us the REAL cuisine
// (Account.Restaurant_Type__c), REAL rating (Customer_Rating__c) and REAL
// coordinates/address — so we no longer synthesize those. What we still derive
// is purely cosmetic: a hero gradient + emoji per cuisine, an emoji per dish,
// a delivery-time estimate from the real avg prep time, and the dish category
// (because Dish__c.Category__c is randomly seeded — see salesforce.js).

const CUISINES = {
  greek:    { label: 'Greek',    emoji: '🥙', from: '#3a7bd5', to: '#00d2ff' },
  thai:     { label: 'Thai',     emoji: '🍜', from: '#f7971e', to: '#ffd200' },
  lebanese: { label: 'Lebanese', emoji: '🧆', from: '#11998e', to: '#38ef7d' },
  italian:  { label: 'Italian',  emoji: '🍝', from: '#e53935', to: '#e35d5b' },
  pizza:    { label: 'Pizza',    emoji: '🍕', from: '#f12711', to: '#f5af19' },
  burger:   { label: 'Burgers',  emoji: '🍔', from: '#c79081', to: '#dfa579' },
  mexican:  { label: 'Mexican',  emoji: '🌮', from: '#f7b733', to: '#fc4a1a' },
  chinese:  { label: 'Chinese',  emoji: '🥡', from: '#cb2d3e', to: '#ef473a' },
  sushi:    { label: 'Sushi',    emoji: '🍣', from: '#ee0979', to: '#ff6a00' },
  indian:   { label: 'Indian',   emoji: '🍛', from: '#ff8008', to: '#ffc837' },
  default:  { label: 'Restaurant', emoji: '🍽️', from: '#ED6A2C', to: '#E0481F' },
};

// Map the real Restaurant_Type__c picklist value → art. The picklist is
// Indian/Chinese/Pizza/Burger/Sushi/Thai/Mexican/Italian, but the seeded data
// also contains Greek and Lebanese, so we handle those too.
export function cuisineForType(type = '') {
  const key = String(type).trim().toLowerCase();
  return CUISINES[key] || CUISINES.default;
}

// Delivery estimate from the real avg prep time: prep + ~12 min ride, as a range.
export function deliveryFor(avgPrep = 20) {
  const base = avgPrep + 12;
  return { min: Math.max(15, base - 5), max: base + 5 };
}

// A small fee model so checkout looks real.
export const DELIVERY_FEE = 3.5;
export const SERVICE_RATE = 0.05;

const DISH_EMOJI = [
  [/pizza|margherita|napoli|diavola|marinara|bufalina|capricciosa|formaggi|stagioni|prosciutto|hawaiian|pepperoni|salami|vegetariana/i, '🍕'],
  [/burger|cheeseburger|smash|deluxe/i, '🍔'],
  [/sushi|maki|nigiri|sashimi|roll|chirashi|unagi|don\b/i, '🍣'],
  [/noodle|ramen|udon|pad thai|pad see ew|chow mein|chow fun|lo mein|drunken/i, '🍜'],
  [/taco|burrito|quesadilla|nacho|fajita|enchilada|tostada|tamale/i, '🌮'],
  [/salad|tabbouleh|fattoush|horiatiki|som tum|caprese|caesar/i, '🥗'],
  [/soup|tom yum|tom kha|miso|wonton|pozole/i, '🍲'],
  [/curry|masala|tikka|korma|biryani|vindaloo|rogan|makhani|paneer|saag|dal/i, '🍛'],
  [/gyros|souvlaki|kebab|shawarma|skewer|taouk|kofta|yakitori|satay/i, '🥙'],
  [/falafel|hummus|moussaka|spanakopita|baba|moutabal|muhammara|labneh|mezze|kibbeh/i, '🧆'],
  [/dumpling|gyoza|spring roll|wonton|bao|dim sum/i, '🥟'],
  [/dduck|peking|teriyaki|kung pao|sesame chicken|sweet and sour/i, '🍗'],
  [/fish|salmon|tuna|seafood|prawn|shrimp|squid|octopus|vongole|saganaki/i, '🐟'],
  [/baklava|tiramisu|gelato|ice cream|brownie|pudding|cannoli|churros|gulab|knafeh|loukoumades|panna cotta|sopapilla|mochi|sorbet|affogato|cake|yogurt|fortune cookie|sticky rice/i, '🍰'],
  [/coffee|espresso|latte|cappuccino|affogato/i, '☕'],
  [/\btea\b|chai|matcha/i, '🍵'],
  [/lassi|milkshake|horchata|lemonade|cola|float|soda|juice|drink/i, '🥤'],
  [/fries|chips|onion rings|coleslaw/i, '🍟'],
  [/bread|pita|naan|focaccia|roti|manakish/i, '🥖'],
  [/pasta|spaghetti|penne|linguine|fettuccine|lasagne|ravioli|gnocchi|risotto|arancini|pastitsio/i, '🍝'],
];

const CATEGORY_EMOJI = {
  Starter: '🥗', Main: '🍽️', Side: '🍟', Dessert: '🍰', Drink: '🥤',
};

export function dishEmoji(name = '', category = '') {
  return DISH_EMOJI.find(([re]) => re.test(name))?.[1] || CATEGORY_EMOJI[category] || '🍽️';
}

export const CATEGORY_ORDER = ['Starter', 'Main', 'Side', 'Dessert', 'Drink'];

// Dish__c.Category__c is unusable (randomly seeded), so classify by dish name.
// Explicit map for the 194 seeded dishes; a keyword fallback covers anything new.
const DISH_CATEGORY = {
  // Drinks
  'cola float': 'Drink', 'green tea': 'Drink', 'horchata': 'Drink',
  'mango lassi': 'Drink', 'milkshake': 'Drink', 'rose lemonade': 'Drink',
  'thai iced tea': 'Drink',
  // Desserts
  'affogato': 'Dessert', 'baklava': 'Dessert', 'brownie': 'Dessert',
  'cannoli': 'Dessert', 'churros': 'Dessert', 'fortune cookie': 'Dessert',
  'greek yogurt bowl': 'Dessert', 'gulab jamun': 'Dessert', 'knafeh': 'Dessert',
  'loukoumades': 'Dessert', 'mango sticky rice': 'Dessert',
  'mochi ice cream': 'Dessert', 'ouzo sorbet': 'Dessert', 'panna cotta': 'Dessert',
  'sopapilla': 'Dessert', 'tiramisu': 'Dessert',
  // Sides
  'baba ganoush': 'Side', 'coleslaw': 'Side', 'edamame': 'Side',
  'egg fried rice': 'Side', 'elote': 'Side', 'fava dip': 'Side',
  'focaccia': 'Side', 'garlic bread': 'Side', 'garlic focaccia': 'Side',
  'garlic naan': 'Side', 'guacamole and chips': 'Side', 'halloumi fries': 'Side',
  'hummus and pita': 'Side', 'labneh bowl': 'Side', 'loaded fries': 'Side',
  'manakish': 'Side', 'moutabal': 'Side', 'muhammara': 'Side',
  'onion rings': 'Side', 'raita': 'Side', 'refried beans': 'Side',
  'roti': 'Side', 'saag aloo': 'Side', 'salsa verde': 'Side',
  'sweet potato fries': 'Side', 'truffle fries': 'Side', 'tzatziki and pita': 'Side',
  // Starters
  'arancini': 'Starter', 'bruschetta': 'Starter', 'caesar salad': 'Starter',
  'caprese salad': 'Starter', 'coconut soup': 'Starter', 'dim sum platter': 'Starter',
  'dolmades': 'Starter', 'dumplings': 'Starter', 'egg drop soup': 'Starter',
  'fattoush': 'Starter', 'feta saganaki': 'Starter', 'greek salad': 'Starter',
  'gyoza': 'Starter', 'halloumi skewers': 'Starter', 'horiatiki': 'Starter',
  'hot and sour soup': 'Starter', 'keftedes': 'Starter', 'kibbeh': 'Starter',
  'larb gai': 'Starter', 'lentil soup': 'Starter', 'minestrone': 'Starter',
  'miso soup': 'Starter', 'mixed mezze': 'Starter', 'nachos supreme': 'Starter',
  'octopus salad': 'Starter', 'onion bhaji': 'Starter', 'paneer tikka': 'Starter',
  'prawn toast': 'Starter', 'salt and pepper squid': 'Starter', 'samosa chaat': 'Starter',
  'satay skewers': 'Starter', 'seaweed salad': 'Starter', 'som tum salad': 'Starter',
  'spanakopita': 'Starter', 'spring rolls': 'Starter', 'tabbouleh': 'Starter',
  'thai fish cakes': 'Starter', 'tom kha gai': 'Starter', 'tom yum soup': 'Starter',
  'vegetable spring roll': 'Starter', 'vine leaves': 'Starter', 'wonton soup': 'Starter',
  'yakitori': 'Starter',
  // (everything else falls through to Main)
};

const CATEGORY_KEYWORDS = [
  [/\b(tea|lassi|milkshake|lemonade|horchata|cola|float|soda|juice|smoothie|ayran)\b/i, 'Drink'],
  [/(baklava|tiramisu|cannoli|brownie|churros|gulab|knafeh|loukoumades|mochi|ice cream|panna cotta|sopapilla|affogato|sorbet|gelato|cake|pudding|halva|flan|fortune cookie|sticky rice|yogurt bowl)/i, 'Dessert'],
  [/(fries|naan|garlic bread|focaccia|roti|coleslaw|onion rings|refried beans|raita|hummus|tzatziki|baba ganoush|moutabal|muhammara|labneh|fava dip|edamame|fried rice|guacamole)/i, 'Side'],
  [/(soup|salad|spring roll|dumpling|gyoza|samosa|bhaji|mezze|bruschetta|satay|prawn toast|arancini|kibbeh|dolmades|vine leaves|saganaki|keftedes|squid|dim sum|wonton|fish cake|spanakopita|tom yum|tom kha)/i, 'Starter'],
];

export function dishCategory(name = '') {
  const key = String(name).trim().toLowerCase();
  if (DISH_CATEGORY[key]) return DISH_CATEGORY[key];
  for (const [re, cat] of CATEGORY_KEYWORDS) if (re.test(name)) return cat;
  return 'Main';
}
