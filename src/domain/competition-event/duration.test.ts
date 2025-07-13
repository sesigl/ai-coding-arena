// ABOUTME: Tests for Duration value object
// Focused on measured vs not-measured duration behavior

import { describe, it, expect } from 'vitest';
import { Duration } from './duration';

describe('Duration', () => {
  describe('when creating measured duration', () => {
    it('should accept zero seconds', () => {
      const duration = Duration.fromSeconds(0);

      expect(duration.getValue()).toBe(0);
      expect(duration.isMeasured()).toBe(true);
    });

    it('should accept positive seconds', () => {
      const duration = Duration.fromSeconds(45);

      expect(duration.getValue()).toBe(45);
      expect(duration.isMeasured()).toBe(true);
    });

    it('should reject negative seconds', () => {
      expect(() => Duration.fromSeconds(-1)).toThrow('Duration cannot be negative');
    });
  });

  describe('when creating not-measured duration', () => {
    it('should identify as unmeasured', () => {
      const duration = Duration.notMeasured();

      expect(duration.getValue()).toBe('NOT_MEASURED');
      expect(duration.isMeasured()).toBe(false);
    });
  });

  describe('when comparing instances', () => {
    it('should be equal when values match', () => {
      const duration1 = Duration.fromSeconds(15);
      const duration2 = Duration.fromSeconds(15);

      expect(duration1.equals(duration2)).toBe(true);
    });

    it('should not be equal when types differ', () => {
      const measuredDuration = Duration.fromSeconds(10);
      const notMeasuredDuration = Duration.notMeasured();

      expect(measuredDuration.equals(notMeasuredDuration)).toBe(false);
    });
  });
});
