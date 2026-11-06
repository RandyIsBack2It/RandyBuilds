// Frost Heave Creamery is a fictional ice cream shop in a fictional Maine
// town. Every flavor, price, hour and person here is sample data for the
// concept demo.
//
// This file is the one place the shop's details live, written so an owner
// (or whoever helps them) can change it without touching the page:
// - flavors:  add a flavor, or give it `months` to make it seasonal.
// - sizes, cones, treats, takeHome: the menu board.
// - seasons:  opening hours by season; `closures` for one-off days.
// Day-to-day changes (a sold-out flavor, a closing-early notice) are made in
// the demo's owner panel instead, and stay in that browser.

export const shop = {
  name: 'Frost Heave Creamery',
  short: 'Frost Heave',
  town: 'Wessick Falls',
  street: '211 River Road',
  state: 'Maine',
  phone: '(207) 555-0163',
  tel: '+12075550163',
  email: 'hello@frostheave.example',
  handle: '@frostheave.creamery',
};

/* ---------- flavors ---------- */

export type Tag = 'df' | 'vg' | 'new';
export const tagLabel: Record<Tag, string> = { df: 'Dairy-free', vg: 'Vegan', new: 'New this year' };

/** How a scoop is drawn (scoop.ts): base colour, optional ribbon and mix-ins. */
export interface Look { base: string; swirl?: string; bits?: string; bit?: 'speck' | 'chunk' | 'berry' }

export interface Flavor {
  id: string;
  name: string;
  cat: 'classic' | 'season' | 'dairyfree';
  /** One line for the flavor list. */
  desc: string;
  tags: Tag[];
  look: Look;
  /** Seasonal flavors: the months (1–12) they're in the case. Omit for every day. */
  months?: number[];
}

export const flavorCats = [
  { id: 'classic', label: 'House classics', note: 'In the case every day we’re open.' },
  { id: 'season', label: 'In season', note: 'They follow the farms and the weather, so they come and go.' },
  { id: 'dairyfree', label: 'Dairy-free & sorbet', note: 'Made on the same machines, cleaned between batches.' },
] as const;

export const flavors: Flavor[] = [
  { id: 'sweet-cream', name: 'Sweet Cream', cat: 'classic', desc: 'Our cream, cane sugar and a pinch of salt. Nothing else.', tags: [], look: { base: '#fbf1d9' } },
  { id: 'vanilla', name: 'Double Vanilla', cat: 'classic', desc: 'Custard base, steeped with split vanilla pods twice.', tags: [], look: { base: '#f6e3b4', bits: '#3b2a1e', bit: 'speck' } },
  { id: 'black-ice', name: 'Black Ice', cat: 'classic', desc: 'Black cocoa ice cream with a crackly dark-chocolate shell.', tags: [], look: { base: '#3a2a2a', swirl: '#1d1414', bits: '#120c0c', bit: 'chunk' } },
  { id: 'mud-season', name: 'Mud Season', cat: 'classic', desc: 'Coffee ice cream, fudge ruts and chocolate-dipped pretzels.', tags: [], look: { base: '#a77b5a', swirl: '#4a2e22', bits: '#2f1e17', bit: 'chunk' } },
  { id: 'salt-truck', name: 'Salt Truck', cat: 'classic', desc: 'Burnt-sugar caramel ice cream, sea salt, butter toffee.', tags: [], look: { base: '#d9a25f', swirl: '#9b5b26', bits: '#f3d9a6', bit: 'chunk' } },
  { id: 'maple-walnut', name: 'Maple Walnut', cat: 'classic', desc: 'Dark maple syrup from up the road, toasted walnuts.', tags: [], look: { base: '#e2b97d', bits: '#7a4f2c', bit: 'chunk' } },
  { id: 'blueberry-crumble', name: 'Wild Blueberry Crumble', cat: 'classic', desc: 'Wild Maine blueberries, sweet cream, brown-sugar oat crumble.', tags: [], look: { base: '#ece0ee', swirl: '#4b3a8c', bits: '#c99b5e', bit: 'chunk' } },
  { id: 'black-raspberry', name: 'Black Raspberry', cat: 'classic', desc: 'The old New England stand-by, made with whole berries.', tags: [], look: { base: '#9c4a85' } },
  { id: 'mint', name: 'Fresh Mint Chip', cat: 'classic', desc: 'Garden mint steeped in cream, shaved dark chocolate.', tags: [], look: { base: '#eef3e2', bits: '#2a1c18', bit: 'speck' } },
  { id: 'fluffernutter', name: 'Fluffernutter', cat: 'classic', desc: 'Peanut butter ice cream, marshmallow swirl. The sandwich, frozen.', tags: [], look: { base: '#d9b07a', swirl: '#fffaf0' } },
  { id: 'whoopie', name: 'Whoopie Pie', cat: 'classic', desc: 'Chocolate cake chunks and a marshmallow-cream swirl.', tags: [], look: { base: '#f7eedd', swirl: '#ffffff', bits: '#3b2723', bit: 'chunk' } },
  { id: 'snow-day', name: 'Snow Day', cat: 'classic', desc: 'Toasted marshmallow, graham crumbs, chocolate flecks.', tags: [], look: { base: '#f4ead6', bits: '#b9824f', bit: 'speck' } },

  { id: 'sugar-snow', name: 'Sugar on Snow', cat: 'season', desc: 'Maple taffy ribbons in sweet cream, with a sour pickle on the side if you dare.', tags: [], look: { base: '#f8efdc', swirl: '#c9893b' }, months: [3, 4] },
  { id: 'rhubarb', name: 'Rhubarb Crisp', cat: 'season', desc: 'Roasted rhubarb, vanilla, oat-and-butter crisp.', tags: [], look: { base: '#f3c7c9', swirl: '#c2465e', bits: '#c99b5e', bit: 'chunk' }, months: [5, 6] },
  { id: 'strawberry', name: 'Strawberry Shortcake', cat: 'season', desc: 'Pick-your-own strawberries, buttermilk biscuit pieces.', tags: [], look: { base: '#f6b3c0', bits: '#e9c88f', bit: 'chunk' }, months: [6, 7] },
  { id: 'corn-blackberry', name: 'Sweet Corn & Blackberry', cat: 'season', desc: 'Sweet-corn custard with a blackberry jam ripple.', tags: [], look: { base: '#f7dc86', swirl: '#4a1f4e' }, months: [8, 9] },
  { id: 'peach', name: 'Roasted Peach Pie', cat: 'season', desc: 'Roasted peaches, brown butter, pie-crust pieces.', tags: [], look: { base: '#f8c48c', swirl: '#e4844d', bits: '#e8c48d', bit: 'chunk' }, months: [8] },
  { id: 'cider-donut', name: 'Cider Donut', cat: 'season', desc: 'Boiled-cider ice cream, cinnamon sugar, cider donut pieces.', tags: [], look: { base: '#ecc791', bits: '#9a5f2e', bit: 'chunk' }, months: [9, 10, 11] },
  { id: 'honeycrisp', name: 'Honeycrisp Caramel', cat: 'season', desc: 'Roasted apples folded through salted caramel.', tags: [], look: { base: '#f2dba6', swirl: '#a8612a', bits: '#c74a3a', bit: 'chunk' }, months: [9, 10, 11] },
  { id: 'pumpkin', name: 'Pumpkin Whoopie', cat: 'season', desc: 'Spiced pumpkin with cream-cheese frosting swirl.', tags: ['new'], look: { base: '#e99b4d', swirl: '#fff5e4', bits: '#7b4120', bit: 'chunk' }, months: [10, 11] },
  { id: 'gingerbread', name: 'Molasses Gingerbread', cat: 'season', desc: 'Molasses ice cream, gingerbread cookie, a little candied ginger.', tags: [], look: { base: '#9b6337', bits: '#5c3418', bit: 'chunk' }, months: [12, 1] },
  { id: 'peppermint', name: 'Peppermint Stick', cat: 'season', desc: 'Pink peppermint ice cream with crushed candy cane.', tags: [], look: { base: '#f7cbd6', bits: '#d6283f', bit: 'speck' }, months: [12, 1] },
  { id: 'cocoa', name: 'Hot Cocoa', cat: 'season', desc: 'Milk-chocolate ice cream, toasted marshmallow, cinnamon.', tags: [], look: { base: '#8a5a44', swirl: '#f6ecd9' }, months: [1, 2, 3] },

  { id: 'lemon-sorbet', name: 'Lemon Sorbet', cat: 'dairyfree', desc: 'Sharp, bright, made with whole lemons.', tags: ['df', 'vg'], look: { base: '#fbe98a', bits: '#f2d22c', bit: 'speck' } },
  { id: 'blueberry-sorbet', name: 'Wild Blueberry Sorbet', cat: 'dairyfree', desc: 'Wild Maine blueberries and a little lime.', tags: ['df', 'vg'], look: { base: '#4f3d8f', bits: '#2c2163', bit: 'berry' } },
  { id: 'oat-chocolate', name: 'Chocolate Oat', cat: 'dairyfree', desc: 'Dark chocolate made on oat milk. Rich, not dusty.', tags: ['df', 'vg'], look: { base: '#5a3b2e', bits: '#2a1a14', bit: 'speck' } },
  { id: 'coconut-lime', name: 'Toasted Coconut Lime', cat: 'dairyfree', desc: 'Coconut cream, toasted flakes, lime zest.', tags: ['df', 'vg'], look: { base: '#f5f1e6', bits: '#c99a5e', bit: 'speck' }, months: [5, 6, 7, 8, 9, 10] },
];

export const flavorById = Object.fromEntries(flavors.map((f) => [f.id, f])) as Record<string, Flavor>;

/* ---------- menu (sample prices) ---------- */

/** Scoops = how many flavors fit. */
export const sizes = [
  { label: 'Kiddie', scoops: 1, price: 4.25, note: 'Ages 10 and under' },
  { label: 'Small', scoops: 1, price: 5.5, note: 'One flavor' },
  { label: 'Medium', scoops: 2, price: 7.25, note: 'Up to two flavors' },
  { label: 'Large', scoops: 3, price: 8.75, note: 'Up to three flavors' },
];
export const cones = [
  { label: 'Cup or sugar cone', price: 0 },
  { label: 'House waffle cone', price: 1.25 },
  { label: 'Chocolate-dipped waffle cone', price: 2 },
];
export const treats = [
  { name: 'Frappe', price: 8.5, desc: 'Two scoops blended with milk.' },
  { name: 'Hot fudge sundae', price: 9.75, desc: 'Two scoops, house fudge, whipped cream.' },
  { name: 'Ice cream whoopie pie', price: 6.75, desc: 'Any flavor between two chocolate cakes.' },
  { name: 'Root beer float', price: 7, desc: 'Sweet Cream in a local root beer.' },
  { name: 'Pup cup', price: 0, desc: 'A small cup of dog-safe vanilla. Free for dogs.' },
];
export const takeHome = [
  { name: 'Hand-packed pint', price: 9.5, desc: 'Any flavor in the case, packed while you wait.' },
  { name: 'Hand-packed quart', price: 16, desc: 'Same as the pint, twice as much.' },
  { name: 'Ice cream cake, 8-inch', price: 42, desc: 'Two flavors on a cookie crust. Call two days ahead.' },
];

/* ---------- hours ---------- */

/** [open, close] in minutes after midnight, or null when closed. Index 0 = Sunday. */
export type Week = ([number, number] | null)[];
export interface Season { id: string; label: string; /** MM-DD, inclusive */ from: string; to: string; week: Week; note: string }

const h = (a: number, b: number): [number, number] => [a * 60, b * 60];
export const seasons: Season[] = [
  { id: 'spring', label: 'Spring hours', from: '04-01', to: '05-31', week: [h(12, 8 + 12), null, null, h(13, 20), h(13, 20), h(13, 21), h(12, 21)], note: 'The window opens April 1, rain or shine.' },
  { id: 'summer', label: 'Summer hours', from: '06-01', to: '09-07', week: [h(12, 21.5), h(12, 21.5), h(12, 21.5), h(12, 21.5), h(12, 21.5), h(12, 22), h(12, 22)], note: 'Open every day. The line moves faster than it looks.' },
  { id: 'fall', label: 'Fall hours', from: '09-08', to: '10-31', week: [h(12, 20), null, null, h(13, 20), h(13, 20), h(13, 20.5), h(12, 20.5)], note: 'Closed Mondays and Tuesdays after Labor Day.' },
  { id: 'winter', label: 'Winter pint window', from: '11-01', to: '03-31', week: [h(12, 18), null, null, null, null, h(15, 19), h(12, 18)], note: 'Pints, cakes and the shop counter only. No cones in winter, except on request.' },
];
/** One-off closures. YYYY-MM-DD. */
export const closures = [
  { date: '2026-11-26', label: 'Thanksgiving' },
  { date: '2026-12-25', label: 'Christmas Day' },
  { date: '2027-01-01', label: 'New Year’s Day' },
];

export const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
