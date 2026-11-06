// Optional choices on the contact form (Randy, 2026-10-22). Values are sent
// as plain text, so they read well in the email. A ?topic=<service> link
// picks the project type; ?similar=<slug> (on /work/) picks the example.
import { budgets } from './pricing';
import { inquiryDemos, type Demo } from './demos';

export const projectTypes: { label: string; services: string[] }[] = [
  { label: 'A new business website or landing page', services: ['websites'] },
  { label: 'A website redesign', services: ['redesigns'] },
  { label: 'A custom application or business tool', services: ['web-apps'] },
  { label: 'Improvements to my current website', services: ['existing-projects'] },
  { label: 'Website management or hosting', services: ['website-management'] },
  { label: 'Server setup or deployment', services: ['server-setup'] },
  { label: 'Not sure yet', services: [] },
];

/** service slug → project type label, for ?topic= links. */
export const typeByService: Record<string, string> = Object.fromEntries(
  projectTypes.flatMap((t) => t.services.map((s) => [s, t.label])),
);

/** The project type an example suggests. */
export const typeForDemo = (d: Demo) => projectTypes[d.group === 'websites' ? 0 : 2].label;

/** slug → what the form needs to preselect that example. */
export const demoChoices = Object.fromEntries(inquiryDemos.map((d) => [d.slug, { title: d.title, type: typeForDemo(d) }]));

export { budgets, inquiryDemos };
