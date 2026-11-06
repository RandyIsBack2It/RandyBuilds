// Every project behind the vault, for the master-key index (/preview/vault/).
// Prospects: concept sites under /preview/<id>/. Clients (said yes): their full
// project under /clients/<id>/. Add a line here when you add a project.
export type Project = { id: string; name: string; area: 'preview' | 'clients'; place: string; what: string; current?: string };
export const projects: Project[] = [];
