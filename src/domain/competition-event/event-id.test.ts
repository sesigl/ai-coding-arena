// ABOUTME: Tests for EventId value object
// Focused on validation, equality behavior, and UUID generation

import { describe, it, expect } from 'vitest';
import { EventId } from './event-id';

describe('EventId', () => {
  describe('when creating with valid input', () => {
    it('should accept valid UUID strings', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const eventId = new EventId(uuid);
      expect(eventId.getValue()).toBe(uuid);
    });

    it('should accept any non-empty string', () => {
      const eventId = new EventId('test-id');
      expect(eventId.getValue()).toBe('test-id');
    });
  });

  describe('when creating with invalid input', () => {
    it('should reject empty strings', () => {
      expect(() => new EventId('')).toThrow('EventId must not be empty');
    });

    it('should reject whitespace-only strings', () => {
      expect(() => new EventId('   ')).toThrow('EventId must not be empty');
    });
  });

  describe('when generating new IDs', () => {
    it('should generate unique UUIDs', () => {
      const id1 = EventId.generate();
      const id2 = EventId.generate();

      expect(id1.getValue()).not.toBe(id2.getValue());
      expect(id1.getValue()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
    });
  });

  describe('when comparing instances', () => {
    it('should be equal when values match', () => {
      const id1 = new EventId('same-id');
      const id2 = new EventId('same-id');

      expect(id1.equals(id2)).toBe(true);
    });

    it('should not be equal when values differ', () => {
      const id1 = new EventId('id-1');
      const id2 = new EventId('id-2');

      expect(id1.equals(id2)).toBe(false);
    });
  });
});
