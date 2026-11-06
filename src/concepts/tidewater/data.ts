// Tidewater Mechanical is a fictional heating, cooling and plumbing company.
// Every person, address, phone number (555-01xx) and dollar figure is sample
// data generated for the concept demo.
import { rng } from '../shared';

export type JobType = 'maint' | 'repair' | 'install' | 'estimate' | 'emergency';
export type Status = 'scheduled' | 'enroute' | 'onsite' | 'done';
export const typeInfo: Record<JobType, { label: string; short: string }> = {
  maint: { label: 'Maintenance', short: 'Maint.' },
  repair: { label: 'Repair', short: 'Repair' },
  install: { label: 'Install', short: 'Install' },
  estimate: { label: 'Estimate', short: 'Est.' },
  emergency: { label: 'Emergency', short: 'Urgent' },
};
export const statusLabel: Record<Status, string> = { scheduled: 'Scheduled', enroute: 'En route', onsite: 'On site', done: 'Complete' };

export interface Tech { id: string; name: string; role: string; skills: string; color: string; home: [number, number] }
export const techs: Tech[] = [
  { id: 'mb', name: 'Marcus Bell', role: 'Lead HVAC', skills: 'Heat pumps, boilers', color: '#0e7c86', home: [70, 80] },
  { id: 'ao', name: 'Ana Ortiz', role: 'HVAC tech', skills: 'Mini-splits, controls', color: '#6d5bd0', home: [120, 210] },
  { id: 'jw', name: 'Jordan Wells', role: 'Plumber', skills: 'Water heaters, drains', color: '#b4541a', home: [300, 70] },
  { id: 'pk', name: 'Priya Kumar', role: 'HVAC tech', skills: 'Furnaces, ductwork', color: '#2f7d3b', home: [340, 230] },
  { id: 'dl', name: 'Dev Lambert', role: 'Apprentice', skills: 'Maintenance', color: '#b0367a', home: [220, 140] },
  { id: 'sc', name: 'Sam Chen', role: 'Plumber', skills: 'Repipes, fixtures', color: '#2864b4', home: [250, 260] },
];

const first = ['Ellen', 'Raj', 'Tom', 'Grace', 'Luis', 'Nora', 'Owen', 'Maya', 'Paul', 'Hana', 'Ben', 'Iris', 'Cole', 'Dana', 'Eli', 'Faye', 'Gus', 'June', 'Kurt', 'Lena', 'Milo', 'Nina', 'Otis', 'Rosa', 'Seth', 'Tara', 'Vic', 'Wren', 'Zoe', 'Abe', 'Bea', 'Cy', 'Della', 'Ezra', 'Flo', 'Hank', 'Ivy', 'Jack', 'Kay', 'Lou'];
const last = ['Marsh', 'Patel', 'Hughes', 'Nolan', 'Reyes', 'Brennan', 'Fisk', 'Lund', 'Ames', 'Sato', 'Pryor', 'Vance', 'Doyle', 'Keane', 'Holt', 'Quinn', 'Reed', 'Shaw', 'Tate', 'Ward'];
const streets = ['Harbor Rd', 'Juniper Ln', 'Ledge St', 'Mill Pond Rd', 'Saltmarsh Way', 'Beacon Hill Rd', 'Kelp Ct', 'Osprey Dr', 'Shore Rd', 'Granite St', 'Birch Point Rd', 'Lantern Ave'];
const towns = ['Cape Linden', 'Cape Linden', 'North Linden', 'Whitcomb', 'Gull Harbor'];
const equipment = ['Gas furnace', 'Oil boiler', 'Ductless mini-split', 'Air-source heat pump', 'Central AC', 'Tank water heater', 'Tankless water heater', 'Well pump', 'Propane boiler'];
const brands = ['Carrier', 'Mitsubishi', 'Rheem', 'Navien', 'Weil-McLain', 'Bosch', 'Daikin', 'Lennox'];

export interface Customer {
  id: string; name: string; phone: string; email: string; address: string; town: string; plan: 'none' | 'comfort' | 'total';
  since: number; balance: number; lifetime: number; xy: [number, number];
  equipment: { kind: string; brand: string; year: number; lastService: string }[];
  history: { date: string; what: string; amount: number; tech: string }[];
  tags: string[];
}

const r = rng(20261022);
const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
const today = new Date();
const ago = (days: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - days).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export const customers: Customer[] = Array.from({ length: 48 }, (_, i) => {
  const name = `${first[i % first.length]} ${last[(i * 7 + 3) % last.length]}`;
  const plan = r() < 0.38 ? (r() < 0.5 ? 'total' : 'comfort') : 'none';
  const nEq = 1 + Math.floor(r() * 3);
  const eq = Array.from({ length: nEq }, () => ({ kind: pick(equipment), brand: pick(brands), year: 2004 + Math.floor(r() * 21), lastService: ago(20 + Math.floor(r() * 500)) }));
  const nHist = 1 + Math.floor(r() * 6);
  const history = Array.from({ length: nHist }, (_, k) => {
    const what = pick(['Annual heating tune-up', 'No-heat call', 'Water heater flush', 'Mini-split cleaning', 'Thermostat install', 'Leak repair', 'Boiler service', 'AC tune-up', 'Drain clearing']);
    return { date: ago(30 + k * 90 + Math.floor(r() * 60)), what, amount: Math.round((90 + r() * 900) / 5) * 5, tech: pick(techs).name };
  });
  const lifetime = history.reduce((s, h) => s + h.amount, 0) + (r() < 0.25 ? 6000 + Math.round(r() * 9000) : 0);
  return {
    id: `C${1040 + i}`, name, phone: `(207) 555-01${String(i + 10).padStart(2, '0')}`,
    email: `${name.toLowerCase().replace(' ', '.')}@example.com`, address: `${10 + Math.floor(r() * 290)} ${pick(streets)}`, town: pick(towns), plan,
    since: 2014 + Math.floor(r() * 11), balance: r() < 0.14 ? Math.round(r() * 1400) : 0, lifetime, xy: [30 + Math.round(r() * 340), 40 + Math.round(r() * 220)],
    equipment: eq, history, tags: [r() < 0.15 ? 'Dog on site' : '', r() < 0.12 ? 'Gate code' : '', r() < 0.1 ? 'Prefers text' : ''].filter(Boolean),
  };
});

export interface Job {
  id: string; customer: string; type: JobType; title: string; tech: string | null; start: number; dur: number; value: number;
  status: Status; notes: string; checklist: { label: string; done: boolean }[];
}

/** The board shows a fixed demo morning so it always looks like a working day. */
export const DEMO_NOW = 11 * 60 + 40;
const titles: Record<JobType, string[]> = {
  maint: ['Heating tune-up', 'Boiler annual service', 'Mini-split cleaning', 'Heat pump check'],
  repair: ['No heat: furnace lockout', 'Leaking water heater', 'Short-cycling heat pump', 'Thermostat not responding', 'Drain backup'],
  install: ['Heat pump install, day 2', 'Tankless water heater swap', 'Smart thermostat install'],
  estimate: ['Boiler replacement quote', 'Whole-home heat pump quote', 'Repipe estimate'],
  emergency: ['No heat, elderly occupant', 'Burst pipe, basement'],
};
export const checklists: Record<JobType, string[]> = {
  maint: ['Check filters', 'Test safeties', 'Clean burners / coils', 'Record readings', 'Customer walkthrough'],
  repair: ['Diagnose', 'Quote repair', 'Customer approval', 'Repair', 'Test and photo'],
  install: ['Protect floors', 'Remove old unit', 'Set and connect', 'Commission', 'Clean up and handover'],
  estimate: ['Measure home', 'Photos of equipment', 'Good/better/best options', 'Review with customer'],
  emergency: ['Make safe', 'Diagnose', 'Temporary fix', 'Schedule follow-up'],
};

// [tech, start(h), dur(min), type]
const plan: [string | null, number, number, JobType][] = [
  ['mb', 7.5, 90, 'maint'], ['mb', 9.5, 120, 'repair'], ['mb', 12.5, 90, 'maint'], ['mb', 14.5, 120, 'estimate'],
  ['ao', 7.5, 480, 'install'], ['ao', 16, 60, 'maint'],
  ['jw', 8, 120, 'repair'], ['jw', 10.5, 90, 'repair'], ['jw', 13, 150, 'install'],
  ['pk', 8, 60, 'maint'], ['pk', 9.25, 90, 'maint'], ['pk', 11, 120, 'repair'], ['pk', 14, 90, 'maint'],
  ['dl', 8.5, 60, 'maint'], ['dl', 10, 60, 'maint'], ['dl', 13, 60, 'maint'], ['dl', 14.5, 60, 'maint'],
  ['sc', 7.75, 180, 'install'], ['sc', 11.5, 90, 'repair'], ['sc', 14, 120, 'estimate'],
  [null, 0, 90, 'emergency'], [null, 0, 60, 'repair'], [null, 0, 60, 'maint'], [null, 0, 120, 'estimate'],
];

export const jobs: Job[] = plan.map(([tech, h, dur, type], i) => {
  const start = Math.round(h * 60);
  const status: Status = !tech ? 'scheduled' : start + dur <= DEMO_NOW ? 'done' : start <= DEMO_NOW ? 'onsite' : start - 45 <= DEMO_NOW ? 'enroute' : 'scheduled';
  const value = { maint: 189, repair: 420, install: 6800, estimate: 0, emergency: 560 }[type] + Math.round(r() * 8) * 25 * (type === 'install' ? 20 : 1);
  const steps = checklists[type];
  const doneSteps = status === 'done' ? steps.length : status === 'onsite' ? Math.ceil(steps.length / 2) : 0;
  return {
    id: `J-${7310 + i}`, customer: customers[(i * 5 + 2) % customers.length].id, type, title: pick(titles[type]), tech, start, dur, value, status,
    notes: pick(['Customer works from home; call 15 minutes ahead.', 'Basement access through bulkhead.', 'Second visit. Parts arrived Tuesday.', 'Member: 15% off repairs.', 'Unit is in the attic. Bring the tall ladder.', 'Text on arrival; doorbell is broken.']),
    checklist: steps.map((label, k) => ({ label, done: k < doneSteps })),
  };
});

export interface PriceItem { id: string; cat: string; name: string; price: number; unit?: string }
export const pricebook: PriceItem[] = [
  { id: 'diag', cat: 'Service', name: 'Diagnostic visit', price: 129 },
  { id: 'tune', cat: 'Service', name: 'Heating system tune-up', price: 189 },
  { id: 'after', cat: 'Service', name: 'After-hours surcharge', price: 95 },
  { id: 'labor', cat: 'Service', name: 'Labor, technician', price: 135, unit: 'hr' },
  { id: 'ign', cat: 'Parts', name: 'Hot surface igniter', price: 148 },
  { id: 'flame', cat: 'Parts', name: 'Flame sensor', price: 96 },
  { id: 'cap', cat: 'Parts', name: 'Dual run capacitor', price: 165 },
  { id: 'tstat', cat: 'Parts', name: 'Smart thermostat, installed', price: 389 },
  { id: 'exp', cat: 'Parts', name: 'Expansion tank', price: 210 },
  { id: 'hp-std', cat: 'Systems', name: 'Heat pump, 2-zone standard', price: 9800 },
  { id: 'hp-hi', cat: 'Systems', name: 'Heat pump, 3-zone cold-climate', price: 15400 },
  { id: 'boil', cat: 'Systems', name: 'High-efficiency combi boiler', price: 11900 },
  { id: 'wh-tank', cat: 'Systems', name: '50 gal water heater', price: 2450 },
  { id: 'wh-tankless', cat: 'Systems', name: 'Tankless water heater', price: 4650 },
  { id: 'permit', cat: 'Fees', name: 'Permit and inspection', price: 175 },
  { id: 'haul', cat: 'Fees', name: 'Old equipment removal', price: 250 },
  { id: 'plan', cat: 'Plans', name: 'Total Comfort plan, first year', price: 228 },
];
export const TAX = 0.055;
