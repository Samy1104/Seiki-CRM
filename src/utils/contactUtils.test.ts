import { describe, it, expect } from 'vitest';
import { parseContactName, formatContactName, formatGenreDisplay } from './contactUtils';

describe('contactUtils', () => {
  describe('parseContactName', () => {
    it('returns empty fields for null/undefined/empty/dash', () => {
      expect(parseContactName(null)).toEqual({ genre: '', prenom: '', nom: '' });
      expect(parseContactName('')).toEqual({ genre: '', prenom: '', nom: '' });
      expect(parseContactName('—')).toEqual({ genre: '', prenom: '', nom: '' });
    });

    it('parses genre M., prenom, and nom correctly', () => {
      expect(parseContactName('M. Jean Dupont')).toEqual({ genre: 'M.', prenom: 'Jean', nom: 'Dupont' });
      expect(parseContactName('Monsieur Jean Dupont')).toEqual({ genre: 'M.', prenom: 'Jean', nom: 'Dupont' });
    });

    it('parses genre Mme, prenom, and nom correctly', () => {
      expect(parseContactName('Mme Marie Curie')).toEqual({ genre: 'Mme', prenom: 'Marie', nom: 'Curie' });
    });

    it('parses genre Autre correctly', () => {
      expect(parseContactName('Autre Alex Smith')).toEqual({ genre: 'Autre', prenom: 'Alex', nom: 'Smith' });
    });

    it('parses name without genre correctly', () => {
      expect(parseContactName('Jean Dupont')).toEqual({ genre: '', prenom: 'Jean', nom: 'Dupont' });
      expect(parseContactName('Jean')).toEqual({ genre: '', prenom: 'Jean', nom: '' });
    });

    it('handles compound last names correctly', () => {
      expect(parseContactName('M. Jean de La Fontaine')).toEqual({ genre: 'M.', prenom: 'Jean', nom: 'de La Fontaine' });
    });
  });

  describe('formatContactName', () => {
    it('formats genre, prenom, and nom into full string with uppercase nom', () => {
      expect(formatContactName('M.', 'Jean', 'Dupont')).toBe('M. Jean DUPONT');
      expect(formatContactName('', 'Jean', 'Dupont')).toBe('Jean DUPONT');
      expect(formatContactName('', 'Jean', '')).toBe('Jean');
    });

    it('returns dash if all fields are empty', () => {
      expect(formatContactName('', '', '')).toBe('—');
      expect(formatContactName('  ', ' ', '')).toBe('—');
    });
  });

  describe('formatGenreDisplay', () => {
    it('maps M. to Monsieur and Mme to Madame', () => {
      expect(formatGenreDisplay('M.')).toBe('Monsieur');
      expect(formatGenreDisplay('m.')).toBe('Monsieur');
      expect(formatGenreDisplay('Monsieur')).toBe('Monsieur');
      expect(formatGenreDisplay('Mme')).toBe('Madame');
      expect(formatGenreDisplay('mme.')).toBe('Madame');
      expect(formatGenreDisplay('Madame')).toBe('Madame');
    });

    it('returns empty string for null/empty', () => {
      expect(formatGenreDisplay(null)).toBe('');
      expect(formatGenreDisplay('')).toBe('');
    });
  });
});
