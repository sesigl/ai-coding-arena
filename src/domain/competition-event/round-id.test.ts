// ABOUTME: Tests for RoundId value object
// Focused on numeric vs not-applicable round behavior

import { describe, it, expect } from 'vitest';
import { RoundId } from './round-id';

describe('RoundId', () => {
  describe('when creating numeric round', () => {
    it('should accept positive numbers', () => {
      const roundId = RoundId.fromNumber(3);

      expect(roundId.getValue()).toBe(3);
      expect(roundId.isNumeric()).toBe(true);
    });

    it('should reject zero', () => {
      expect(() => RoundId.fromNumber(0)).toThrow('Round number must be positive');
    });

    it('should reject negative numbers', () => {
      expect(() => RoundId.fromNumber(-1)).toThrow('Round number must be positive');
    });
  });

  describe('when creating not-applicable round', () => {
    it('should identify as non-numeric', () => {
      const roundId = RoundId.notApplicable();

      expect(roundId.getValue()).toBe('NOT_APPLICABLE');
      expect(roundId.isNumeric()).toBe(false);
    });
  });

  describe('when comparing instances', () => {
    it('should be equal when values match', () => {
      const id1 = RoundId.fromNumber(2);
      const id2 = RoundId.fromNumber(2);

      expect(id1.equals(id2)).toBe(true);
    });

    it('should not be equal when types differ', () => {
      const numericId = RoundId.fromNumber(1);
      const notApplicableId = RoundId.notApplicable();

      expect(numericId.equals(notApplicableId)).toBe(false);
    });
  });
});
