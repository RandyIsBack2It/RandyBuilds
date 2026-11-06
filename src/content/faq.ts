// Every answer here is a fact Randy confirmed (2026-10-12; typical project
// sizes 2026-10-22, figures from content/pricing.ts). Reply time and the free
// project review live in the Contact section. Ask before adding answers
// about timelines, self-editing, phone calls, domains, analytics or training —
// none of those are confirmed.
import { priceSummary } from './pricing';

export const faq = [
  { q: 'What do I need to get started?', a: 'An idea, or a problem you want solved. If you have text, photos or a logo, send them along. If not, I can help with those too.' },
  { q: 'What does a project usually cost?', a: priceSummary },
  { q: 'How is the price set?', a: 'I quote a fixed price for the agreed scope, in writing, before any work starts. I don’t charge by the hour. If you want to add something later, I quote it first.' },
  { q: 'Who owns the finished site?', a: 'You do. The site, its code and its content are yours.' },
  { q: 'Can you host it for me?', a: 'Yes. I can host your site, or work with the host you already have. Hosting is quoted separately.' },
  { q: 'What if I need changes later?', a: 'Ask me any time. Updates, fixes and other changes are quoted before I start.' },
  { q: 'Where are you available to work?', a: 'I take on projects across New England, and remote projects too.' },
];
