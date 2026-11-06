// Cove is a fictional massage, physical therapy and acupuncture studio.
// Practitioners, services, prices and availability are sample data.

export type Cat = 'massage' | 'pt' | 'acu' | 'recovery';
export const cats: { id: Cat; label: string }[] = [
  { id: 'massage', label: 'Massage' }, { id: 'pt', label: 'Physical therapy' }, { id: 'acu', label: 'Acupuncture' }, { id: 'recovery', label: 'Recovery' },
];
export interface Service { id: string; cat: Cat; name: string; blurb: string; options: { min: number; price: number }[]; who: string[] }
export const services: Service[] = [
  { id: 'deep', cat: 'massage', name: 'Deep tissue massage', blurb: 'Slow, firm work for chronic tension in the back, neck and shoulders.', options: [{ min: 60, price: 125 }, { min: 90, price: 175 }], who: ['lena', 'marco', 'ines'] },
  { id: 'swedish', cat: 'massage', name: 'Relaxation massage', blurb: 'Long flowing strokes to calm the nervous system. Ideal for a first visit.', options: [{ min: 60, price: 110 }, { min: 90, price: 155 }], who: ['lena', 'ines'] },
  { id: 'prenatal', cat: 'massage', name: 'Prenatal massage', blurb: 'Side-lying with full support, from the second trimester on.', options: [{ min: 60, price: 125 }], who: ['ines'] },
  { id: 'sports', cat: 'massage', name: 'Sports massage', blurb: 'Targeted work before an event or during recovery from training.', options: [{ min: 45, price: 95 }, { min: 75, price: 140 }], who: ['marco'] },
  { id: 'pt-eval', cat: 'pt', name: 'Physical therapy evaluation', blurb: 'Assessment, a clear diagnosis and a written plan you can follow at home.', options: [{ min: 60, price: 165 }], who: ['dana', 'theo'] },
  { id: 'pt-follow', cat: 'pt', name: 'Physical therapy follow-up', blurb: 'Hands-on treatment and progressions to your plan.', options: [{ min: 45, price: 120 }], who: ['dana', 'theo'] },
  { id: 'acu', cat: 'acu', name: 'Acupuncture', blurb: 'For pain, sleep and stress. Includes a short intake conversation.', options: [{ min: 60, price: 115 }], who: ['mei'] },
  { id: 'cupping', cat: 'acu', name: 'Cupping', blurb: 'Glass and silicone cups to release tight fascia.', options: [{ min: 30, price: 65 }, { min: 45, price: 85 }], who: ['mei', 'marco'] },
  { id: 'sauna', cat: 'recovery', name: 'Infrared sauna', blurb: 'Private suite with shower and a chilled towel.', options: [{ min: 40, price: 45 }], who: ['any'] },
  { id: 'compress', cat: 'recovery', name: 'Compression therapy', blurb: 'Pneumatic boots for tired legs after long runs or long shifts.', options: [{ min: 30, price: 40 }], who: ['any'] },
];
export interface Pro { id: string; name: string; title: string; focus: string; initials: string; tone: string; days: number[] }
export const pros: Pro[] = [
  { id: 'lena', name: 'Lena Ruiz', title: 'Licensed massage therapist', focus: 'Neck and shoulder pain, desk posture', initials: 'LR', tone: '#c0714f', days: [1, 2, 3, 5, 6] },
  { id: 'marco', name: 'Marco Bellini', title: 'Licensed massage therapist', focus: 'Runners, cyclists, sports recovery', initials: 'MB', tone: '#4f7a6d', days: [2, 3, 4, 5, 6] },
  { id: 'ines', name: 'Inés Okafor', title: 'Licensed massage therapist', focus: 'Prenatal and postpartum care', initials: 'IO', tone: '#8d6aa8', days: [1, 3, 4, 6, 0] },
  { id: 'dana', name: 'Dana Whitfield, DPT', title: 'Physical therapist', focus: 'Low back, hips and knees', initials: 'DW', tone: '#3e6c8f', days: [1, 2, 4, 5] },
  { id: 'theo', name: 'Theo Park, DPT', title: 'Physical therapist', focus: 'Shoulders and return to sport', initials: 'TP', tone: '#a5803a', days: [1, 3, 5, 6] },
  { id: 'mei', name: 'Mei Tanaka, LAc', title: 'Licensed acupuncturist', focus: 'Sleep, stress and headaches', initials: 'MT', tone: '#6f8a3c', days: [2, 4, 5, 6] },
];
export const addons = [
  { id: 'stones', name: 'Warm stones', price: 20 }, { id: 'cbd', name: 'Arnica and CBD balm', price: 15 }, { id: 'scalp', name: 'Scalp and face finish', price: 15 },
];
export const regions = ['Head and neck', 'Shoulders', 'Upper back', 'Lower back', 'Arms', 'Hands', 'Hips and glutes', 'Thighs', 'Knees', 'Calves', 'Feet'] as const;

export const plans = [
  { id: 'monthly', name: 'Cove Monthly', price: 99, desc: 'One 60-minute massage or acupuncture visit each month.', perks: ['Rollover for one month', '10% off extra visits', 'Free sauna add-on once a month'] },
  { id: 'reset', name: 'Reset', price: 179, desc: 'Two visits a month for steady progress.', perks: ['Any service up to 60 minutes', '15% off extra visits', 'Priority booking 3 weeks out', 'Unlimited sauna'], featured: true },
  { id: 'pt', name: 'Recovery Plan', price: 229, desc: 'Physical therapy with home program check-ins.', perks: ['Two PT follow-ups a month', 'Messaging with your therapist', 'Compression therapy included'] },
];
export const giftThemes = [
  { id: 'tide', name: 'Tide' }, { id: 'sage', name: 'Sage' }, { id: 'dusk', name: 'Dusk' }, { id: 'sand', name: 'Sand' },
];
/** Studio hours, minutes since midnight. */
export const OPEN = 9 * 60, CLOSE = 19 * 60;
