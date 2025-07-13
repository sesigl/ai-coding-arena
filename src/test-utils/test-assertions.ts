// ABOUTME: Custom test assertions for CompetitionEvent testing
// Provides reusable assertion methods to reduce duplication and improve readability

import { expect } from 'vitest';
import { Result } from 'neverthrow';
import { CompetitionEvent } from 'domain/competition-event/competition-event';
import { EventType } from 'domain/competition-event/event-type';

export const TestAssertions = {
  expectResultOk<T>(result: Result<T, Error>): void {
    if (result.isErr()) {
      // Error details will be shown by the test framework
      throw new Error(`Expected success but got error: ${result.error.message}`);
    }
    expect(result.isOk()).toBe(true);
  },

  expectEventArrayLength<T extends CompetitionEvent[]>(
    result: Result<T, Error>,
    expectedLength: number
  ): void {
    this.expectResultOk(result);
    if (result.isOk()) {
      expect(result.value).toHaveLength(expectedLength);
    }
  },

  expectAllEventsHaveCompetition(
    result: Result<CompetitionEvent[], Error>,
    expectedCompetitionId: string
  ): void {
    this.expectResultOk(result);
    if (result.isOk()) {
      result.value.forEach((event: CompetitionEvent) => {
        expect(event.getCompetitionId().getValue()).toBe(expectedCompetitionId);
      });
    }
  },

  expectAllEventsHaveParticipant(
    result: Result<CompetitionEvent[], Error>,
    expectedParticipantId: string
  ): void {
    this.expectResultOk(result);
    if (result.isOk()) {
      result.value.forEach((event: CompetitionEvent) => {
        expect(event.getParticipantId().getValue()).toBe(expectedParticipantId);
      });
    }
  },

  expectAllEventsHaveType(
    result: Result<CompetitionEvent[], Error>,
    expectedEventType: EventType
  ): void {
    this.expectResultOk(result);
    if (result.isOk()) {
      result.value.forEach((event: CompetitionEvent) => {
        expect(event.getEventType()).toBe(expectedEventType);
      });
    }
  },
};
