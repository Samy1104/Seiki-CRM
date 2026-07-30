export interface ParsedContactName {
  genre: string;
  prenom: string;
  nom: string;
}

/**
  Parses a full contact_name string into individual genre, prenom, and nom fields.
  Example:
  "M. Jean Dupont" -> { genre: 'M.', prenom: 'Jean', nom: 'Dupont' }
  "Mme Marie Curie" -> { genre: 'Mme', prenom: 'Marie', nom: 'Curie' }
  "Jean Dupont" -> { genre: '', prenom: 'Jean', nom: 'Dupont' }
 */
export function parseContactName(fullName: string | null | undefined): ParsedContactName {
  if (!fullName || fullName.trim() === '' || fullName.trim() === '—') {
    return { genre: '', prenom: '', nom: '' };
  }

  const trimmed = fullName.trim();
  const parts = trimmed.split(/\s+/);

  let genre = '';
  let startIndex = 0;

  if (parts.length > 0) {
    const firstLower = parts[0].toLowerCase();
    if (['m.', 'mr', 'mr.', 'monsieur'].includes(firstLower)) {
      genre = 'M.';
      startIndex = 1;
    } else if (['mme', 'mme.', 'mrs', 'mrs.', 'ms', 'ms.', 'madame'].includes(firstLower)) {
      genre = 'Mme';
      startIndex = 1;
    } else if (['autre', 'mx', 'mx.'].includes(firstLower)) {
      genre = 'Autre';
      startIndex = 1;
    }
  }

  const nameParts = parts.slice(startIndex);
  if (nameParts.length === 0) {
    return { genre, prenom: '', nom: '' };
  }
  if (nameParts.length === 1) {
    return { genre, prenom: nameParts[0], nom: '' };
  }

  return {
    genre,
    prenom: nameParts[0],
    nom: nameParts.slice(1).join(' '),
  };
}

/**
  Formats genre, prenom, and nom back into a single contact_name string.
 */
export function formatContactName(genre: string, prenom: string, nom: string): string {
  const formattedNom = nom.trim().toUpperCase();
  const parts = [genre.trim(), prenom.trim(), formattedNom].filter(Boolean);
  return parts.join(' ') || '—';
}

/**
 * Formats a genre string into a full polite title for email templates.
 * 'M.' / 'Monsieur' -> 'Monsieur'
 * 'Mme' / 'Madame' -> 'Madame'
 */
export function formatGenreDisplay(genre: string | null | undefined): string {
  if (!genre) return '';
  const g = genre.trim().toLowerCase();
  if (['m.', 'm', 'mr', 'mr.', 'monsieur'].includes(g)) {
    return 'Monsieur';
  }
  if (['mme', 'mme.', 'mrs', 'mrs.', 'ms', 'ms.', 'madame'].includes(g)) {
    return 'Madame';
  }
  return genre.trim();
}
