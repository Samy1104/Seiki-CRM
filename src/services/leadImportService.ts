export const LEAD_IMPORT_HEADERS = [
  'Nom de la société',
  'Segment',
  'Nom du contact',
  'Email',
  'Téléphone',
  'URL LinkedIn',
  'Site web',
  'Source',
  "Valeur de l'affaire (k€)",
  'Note',
] as const;

export const ALLOWED_SEGMENTS = ['Media', 'Retail', 'Instit'] as const;
export type LeadSegment = (typeof ALLOWED_SEGMENTS)[number];

export const ALLOWED_SOURCES = [
  'LinkedIn',
  'Événement',
  'Réseau',
  'AndZup',
  'Inbound',
  'Chrome Extension',
  'Autre',
] as const;
