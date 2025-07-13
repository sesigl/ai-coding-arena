// ABOUTME: Tests for CompetitionId value object
// Simple tests covering validation and equality

import { describe, it, expect } from 'vitest';
import { CompetitionId } from './competition-id';

describe('CompetitionId', () => {
  it('should create with valid value', () => {
    const id = new CompetitionId('comp-1');
    expect(id.getValue()).toBe('comp-1');
  });

  it('should throw on empty string', () => {
    expect(() => new CompetitionId('')).toThrow('CompetitionId cannot be empty');
  });

  it('should throw on whitespace-only string', () => {
    expect(() => new CompetitionId('   ')).toThrow('CompetitionId cannot be empty');
  });

  it('should check equality correctly', () => {
    const id1 = new CompetitionId('comp-1');
    const id2 = new CompetitionId('comp-1');
    const id3 = new CompetitionId('comp-2');

    expect(id1.equals(id2)).toBe(true);
    expect(id1.equals(id3)).toBe(false);
  });
});
