// ABOUTME: Tests for EventId value object
// Focused on validation and equality behavior

import { describe, it, expect } from 'vitest';
import { EventId } from './event-id';

describe('EventId', () => {
  describe('when creating with valid input', () => {
    it('should accept positive numbers', () => {
      const eventId = new EventId(42);
      expect(eventId.getValue()).toBe(42);
    });
  });

  describe('when creating with invalid input', () => {
    it('should accept zero', () => {
      const eventId = new EventId(0);
      expect(eventId.getValue()).toBe(0);
    });

    it('should reject negative numbers', () => {
      expect(() => new EventId(-1)).toThrow('EventId must be positive');
    });
  });

  describe('when comparing instances', () => {
    it('should be equal when values match', () => {
      const id1 = new EventId(5);
      const id2 = new EventId(5);

      expect(id1.equals(id2)).toBe(true);
    });

    it('should not be equal when values differ', () => {
      const id1 = new EventId(5);
      const id2 = new EventId(10);

      expect(id1.equals(id2)).toBe(false);
    });
  });
});
