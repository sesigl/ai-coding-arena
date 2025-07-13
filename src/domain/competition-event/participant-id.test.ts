// ABOUTME: Tests for ParticipantId value object
// Focused on system vs regular participant behavior

import { describe, it, expect } from 'vitest';
import { ParticipantId } from './participant-id';

describe('ParticipantId', () => {
  describe('when creating system participant', () => {
    it('should identify as system', () => {
      const systemId = ParticipantId.system();

      expect(systemId.getValue()).toBe('SYSTEM');
      expect(systemId.isSystem()).toBe(true);
    });
  });

  describe('when creating regular participant', () => {
    it('should accept valid string', () => {
      const participantId = ParticipantId.fromString('participant-1');

      expect(participantId.getValue()).toBe('participant-1');
      expect(participantId.isSystem()).toBe(false);
    });

    it('should reject empty string', () => {
      expect(() => ParticipantId.fromString('')).toThrow('ParticipantId cannot be empty');
    });

    it('should reject whitespace-only string', () => {
      expect(() => ParticipantId.fromString('   ')).toThrow('ParticipantId cannot be empty');
    });
  });

  describe('when comparing instances', () => {
    it('should be equal when values match', () => {
      const id1 = ParticipantId.fromString('participant-1');
      const id2 = ParticipantId.fromString('participant-1');

      expect(id1.equals(id2)).toBe(true);
    });

    it('should not be equal when values differ', () => {
      const regularId = ParticipantId.fromString('participant-1');
      const systemId = ParticipantId.system();

      expect(regularId.equals(systemId)).toBe(false);
    });
  });
});
