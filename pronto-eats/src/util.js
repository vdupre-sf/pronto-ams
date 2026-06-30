// Dishes and prices come straight from Salesforce (Dish__c.Price__c, a currency
// field). The org's data is in US dollars, so format as USD.
export const usd = (n) => '$' + Number(n || 0).toFixed(2);

/**
 * Dish__c.Allergens__c is a free-text field shaped like
 *   "Contains: Shellfish, Soy. Ingredients: Crab, Soy Sauce, Potato."
 * or "No known allergens. Ingredients: Lime, Black Pepper, …".
 * Split it into a clean allergen warning + the ingredient list.
 */
export function parseAllergens(raw) {
  if (!raw) return { contains: [], ingredients: [], hasAllergens: false };
  const ingMatch = raw.match(/Ingredients:\s*(.+?)\.?\s*$/i);
  const ingredients = ingMatch
    ? ingMatch[1].split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const containsMatch = raw.match(/Contains:\s*(.+?)\.\s*(?:Ingredients:|$)/i);
  const contains = containsMatch
    ? containsMatch[1].split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  return { contains, ingredients, hasAllergens: contains.length > 0 };
}
