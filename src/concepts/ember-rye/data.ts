// Ember & Rye is a fictional restaurant. Every dish, price, allergen note,
// table, hour and policy here is sample data for the concept demo.

export type Tag = 'v' | 'vg' | 'gf' | 'spicy' | 'pick';
export const tagLabel: Record<Tag, string> = { v: 'Vegetarian', vg: 'Vegan', gf: 'Gluten-free', spicy: 'Spicy', pick: 'Chef’s pick' };
export const tagShort: Record<Tag, string> = { v: 'V', vg: 'VG', gf: 'GF', spicy: 'Hot', pick: 'Pick' };
export type Allergen = 'gluten' | 'dairy' | 'egg' | 'fish' | 'shellfish' | 'nuts';
export const allergenLabel: Record<Allergen, string> = { gluten: 'gluten', dairy: 'dairy', egg: 'egg', fish: 'fish', shellfish: 'shellfish', nuts: 'tree nuts' };

export interface Choice { id: string; label: string; price?: number }
export interface OptionGroup { id: string; label: string; type: 'one' | 'many'; required?: boolean; max?: number; choices: Choice[] }
export interface Item {
  id: string; cat: string; name: string; desc: string; price: number; tags: Tag[];
  /** Cooking note shown in the item dialog. */
  note?: string; options?: OptionGroup[];
  /** Sample allergen list. An empty list means none of the listed allergens. */
  contains: Allergen[];
  /** Served in the restaurant only: shown on the menu, not orderable for pickup. */
  dineIn?: string;
}

export const categories = [
  { id: 'small', label: 'Small plates' },
  { id: 'hearth', label: 'From the hearth' },
  { id: 'mains', label: 'Mains' },
  { id: 'sides', label: 'Sides' },
  { id: 'sweet', label: 'Dessert' },
  { id: 'drinks', label: 'Drinks' },
];

const crust: OptionGroup = { id: 'crust', label: 'Crust', type: 'one', required: true, choices: [
  { id: 'rye', label: 'House rye sourdough' }, { id: 'gf', label: 'Gluten-free base (same oven as wheat dough)', price: 3 },
] };
const pizzaAdd: OptionGroup = { id: 'add', label: 'Add toppings', type: 'many', max: 4, choices: [
  { id: 'egg', label: 'Farm egg', price: 2.5 }, { id: 'nduja', label: 'Nduja', price: 4 }, { id: 'mush', label: 'Roasted mushrooms', price: 3.5 },
  { id: 'chili', label: 'Hot honey', price: 1.5 }, { id: 'burrata', label: 'Burrata', price: 6 }, { id: 'anch', label: 'Anchovy', price: 2.5 },
] };
const temp: OptionGroup = { id: 'temp', label: 'Cooked to', type: 'one', required: true, choices: [
  { id: 'mr', label: 'Medium rare' }, { id: 'm', label: 'Medium' }, { id: 'mw', label: 'Medium well' },
] };

export const menu: Item[] = [
  { id: 'bread', cat: 'small', name: 'Hearth rye & cultured butter', desc: 'Warm rye sourdough from the oven, smoked sea salt, whipped butter.', price: 7, tags: ['v', 'pick'], contains: ['gluten', 'dairy'] },
  { id: 'oysters', cat: 'small', name: 'Ember-roasted oysters', desc: 'Six local oysters, charred leek butter, lemon, rye crumb.', price: 21, tags: [], contains: ['shellfish', 'dairy', 'gluten'], dineIn: 'Dine-in only. Roasted oysters don’t travel well.' },
  { id: 'carrots', cat: 'small', name: 'Coal-blistered carrots', desc: 'Harissa yogurt, pistachio dukkah, mint.', price: 13, tags: ['v', 'gf', 'spicy'], contains: ['dairy', 'nuts'] },
  { id: 'squid', cat: 'small', name: 'Grilled squid', desc: 'Charred lemon, chili oil, white beans, parsley.', price: 16, tags: ['gf', 'spicy'], contains: ['shellfish'] },
  { id: 'burrata', cat: 'small', name: 'Burrata & roasted squash', desc: 'Brown butter, sage, toasted seeds, aged balsamic.', price: 15, tags: ['v', 'gf'], contains: ['dairy'] },
  { id: 'margherita', cat: 'hearth', name: 'Margherita', desc: 'San Marzano tomato, fior di latte, basil, olive oil.', price: 18, tags: ['v'], note: 'Baked at 850°F for about 90 seconds.', options: [crust, pizzaAdd], contains: ['gluten', 'dairy'] },
  { id: 'smoke', cat: 'hearth', name: 'Smoke & Honey', desc: 'Smoked mozzarella, soppressata, hot honey, Calabrian chili.', price: 22, tags: ['spicy', 'pick'], note: 'Our most ordered pie.', options: [crust, pizzaAdd], contains: ['gluten', 'dairy'] },
  { id: 'forager', cat: 'hearth', name: 'Forager', desc: 'Roasted mushrooms, fontina, garlic cream, thyme, egg yolk.', price: 21, tags: ['v'], options: [crust, pizzaAdd], contains: ['gluten', 'dairy', 'egg'] },
  { id: 'green', cat: 'hearth', name: 'Garden green', desc: 'Pistachio pesto, charred broccolini, lemon, cashew ricotta.', price: 20, tags: ['vg'], options: [crust, pizzaAdd], contains: ['gluten', 'nuts'] },
  { id: 'steak', cat: 'mains', name: 'Oak-fired hanger steak', desc: '10 oz, salsa verde, ember potatoes, watercress.', price: 36, tags: ['gf'], options: [temp], contains: [] },
  { id: 'halibut', cat: 'mains', name: 'Halibut in the coals', desc: 'Wrapped in fig leaf, brown butter, capers, charred lemon.', price: 38, tags: ['gf', 'pick'], contains: ['fish', 'dairy'] },
  { id: 'chicken', cat: 'mains', name: 'Half chicken, spit-roasted', desc: 'Brined 24 hours, schmaltz bread, pan jus, pickled shallot.', price: 29, tags: [], contains: ['gluten'] },
  { id: 'risotto', cat: 'mains', name: 'Smoked barley risotto', desc: 'Roasted squash, sage, aged cheddar, toasted hazelnut.', price: 26, tags: ['v'],
    options: [{ id: 'add', label: 'Add', type: 'many', choices: [{ id: 'mush', label: 'Wild mushrooms', price: 5 }, { id: 'egg', label: 'Crispy egg', price: 3 }] }], contains: ['gluten', 'dairy', 'nuts'] },
  { id: 'fries', cat: 'sides', name: 'Tallow fries', desc: 'Rosemary salt, smoked aioli.', price: 8, tags: ['gf'], contains: ['egg'] },
  { id: 'greens', cat: 'sides', name: 'Little gem salad', desc: 'Buttermilk dressing, radish, herbs, rye crumb.', price: 11, tags: ['v'], contains: ['gluten', 'dairy'] },
  { id: 'kale', cat: 'sides', name: 'Charred kale', desc: 'Garlic, lemon, chili flakes.', price: 9, tags: ['vg', 'gf', 'spicy'], contains: [] },
  { id: 'skillet', cat: 'sweet', name: 'Skillet cookie', desc: 'Brown butter, dark chocolate, sea salt, vanilla ice cream.', price: 12, tags: ['v', 'pick'], note: 'Baked to order. Allow 12 minutes.', contains: ['gluten', 'dairy', 'egg'] },
  { id: 'panna', cat: 'sweet', name: 'Smoked maple panna cotta', desc: 'Roasted pear, oat crumble.', price: 10, tags: ['gf'], contains: ['dairy'] },
  { id: 'sorbet', cat: 'sweet', name: 'Cider sorbet', desc: 'Two scoops, apple chips.', price: 8, tags: ['vg', 'gf'], contains: [] },
  { id: 'soda', cat: 'drinks', name: 'House ginger soda', desc: 'Fresh ginger, lime, cane sugar.', price: 5, tags: ['vg', 'gf'], contains: [] },
  { id: 'spritz', cat: 'drinks', name: 'Blood orange spritz (zero proof)', desc: 'Bitter orange, rosemary, sparkling water.', price: 9, tags: ['vg', 'gf'], contains: [] },
  { id: 'coldbrew', cat: 'drinks', name: 'Smoked cold brew', desc: 'Oak-smoked beans. Black, or with whole or oat milk.', price: 6, tags: ['vg', 'gf'],
    options: [{ id: 'milk', label: 'Milk', type: 'one', required: true, choices: [{ id: 'none', label: 'Black' }, { id: 'whole', label: 'Whole milk (dairy)' }, { id: 'oat', label: 'Oat milk', price: 0.75 }] }], contains: [] },
];

export const TAX = 0.08;
export const TIPS = [0, 10, 15, 20];

/** Sample pickup rules. Online orders are taken from opening until
 *  ORDER_CUTOFF minutes before closing; pickup times run until PICKUP_END
 *  minutes before closing. */
export const ORDER_CUTOFF = 30;
export const PICKUP_END = 15;
export const HOLD_MINUTES = 30;
export const MAX_QTY = 20;
/** Sample prep time by number of items. */
export const prepMinutes = (items: number) => (items <= 4 ? 20 : items <= 10 ? 30 : 40);

/** Opening hours by weekday (0 = Sunday), minutes since midnight. Monday closed. */
export const hours: ([number, number] | null)[] = [
  [16 * 60, 21 * 60], null, [16 * 60, 22 * 60], [16 * 60, 22 * 60], [16 * 60, 22 * 60], [16 * 60, 23 * 60], [12 * 60, 23 * 60],
];
export const MAX_PARTY = 8;
export const TABLE_HOLD = 15;
export const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Sample reservation rules. Dinner seatings every half hour from 5 pm (or
 *  opening) until 90 minutes before closing. Each seating takes up to
 *  SEATING_COVERS guests and LARGE_PER_SEATING parties of LARGE_PARTY or more;
 *  the restaurant assigns tables itself. */
export const SEATING_STEP = 30;
export const SEATING_COVERS = 20;
export const LARGE_PARTY = 5;
export const LARGE_PER_SEATING = 2;
export const BOOKING_DAYS = 30;
/** Same-day bookings close this many minutes before the seating. */
export const BOOKING_LEAD = 60;
