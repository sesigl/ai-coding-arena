// ABOUTME: Tests for CompetitionEvent domain entity
// Behavior-driven tests focused on what matters for coverage

import { describe, it, expect } from 'vitest';
import { CompetitionEvent } from './competition-event';
import { CompetitionEventFactory } from 'test-utils/competition-event-factory';
import { EventType } from './event-type';
import { Phase } from './phase';

describe('CompetitionEvent', () => {
  describe('when getting event properties', () => {
    it('should return all properties correctly', () => {
      const event = CompetitionEventFactory.create();

      expect(event.getId().getValue()).toBe('test-id-1');
      expect(event.getTimestamp()).toEqual(new Date('2024-01-01'));
      expect(event.getCompetitionId().getValue()).toBe('comp-1');
      expect(event.getRoundId().getValue()).toBe(1);
      expect(event.getParticipantId().getValue()).toBe('participant-1');
      expect(event.getEventType()).toBe(EventType.BASELINE_CREATION_STARTED);
      expect(event.getPhase()).toBe(Phase.BASELINE);
      expect(event.getData()).toEqual({ key: 'value' });
      expect(event.isSuccess()).toBe(true);
      expect(event.getDuration().getValue()).toBe(10);
    });

    it('should return defensive copies of mutable objects', () => {
      const originalDate = new Date('2024-01-01');
      const originalData = { key: 'value' };

      const event = CompetitionEventFactory.create({
        timestamp: originalDate,
        data: originalData,
      });

      const timestamp = event.getTimestamp();
      const data = event.getData();

      timestamp.setFullYear(2025);
      data.key = 'modified';

      expect(event.getTimestamp()).toEqual(new Date('2024-01-01'));
      expect(event.getData()).toEqual({ key: 'value' });
    });
  });

  describe('when checking event classification', () => {
    it('should identify system events', () => {
      const systemEvent = CompetitionEventFactory.createSystemEvent();
      const regularEvent = CompetitionEventFactory.create();

      expect(systemEvent.isSystemEvent()).toBe(true);
      expect(regularEvent.isSystemEvent()).toBe(false);
    });

    it('should identify round events', () => {
      const roundEvent = CompetitionEventFactory.create({ roundId: 1 });
      const systemEvent = CompetitionEventFactory.createSystemEvent();

      expect(roundEvent.isRoundEvent()).toBe(true);
      expect(systemEvent.isRoundEvent()).toBe(false);
    });
  });

  describe('when creating from raw data', () => {
    it('should handle numeric values correctly', () => {
      const rawData = CompetitionEventFactory.createRawData({
        id: 42,
        round_id: 5,
        participant_id: 'test-participant',
        duration_seconds: 25,
      });

      const event = CompetitionEvent.fromRawData(rawData);

      expect(event.getId().getValue()).toBe('42');
      expect(event.getRoundId().getValue()).toBe(5);
      expect(event.getParticipantId().getValue()).toBe('test-participant');
      expect(event.getDuration().getValue()).toBe(25);
    });

    it('should handle special string values correctly', () => {
      const rawData = CompetitionEventFactory.createRawData({
        round_id: 'NOT_APPLICABLE',
        participant_id: 'SYSTEM',
        duration_seconds: 'NOT_MEASURED',
        success: false,
      });

      const event = CompetitionEvent.fromRawData(rawData);

      expect(event.getRoundId().getValue()).toBe('NOT_APPLICABLE');
      expect(event.getParticipantId().getValue()).toBe('SYSTEM');
      expect(event.getDuration().getValue()).toBe('NOT_MEASURED');
      expect(event.isSuccess()).toBe(false);
    });
  });

  describe('when converting to raw data', () => {
    it('should preserve all data correctly', () => {
      const event = CompetitionEventFactory.create({
        id: 'test-event-99',
        competitionId: 'test-comp',
        success: false,
      });

      const rawData = event.toRawData();

      expect(rawData.id).toBe('test-event-99');
      expect(rawData.competition_id).toBe('test-comp');
      expect(rawData.success).toBe(false);
      expect(rawData.round_id).toBe(1);
      expect(rawData.participant_id).toBe('participant-1');
    });
  });
});
