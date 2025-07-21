// ABOUTME: EventId value object for unique event identification
// Uses UUID for guaranteed uniqueness across concurrent operations

import { v4 as uuidv4 } from 'uuid';

export class EventId {
  constructor(private readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('EventId must not be empty');
    }
  }

  static generate(): EventId {
    return new EventId(uuidv4());
  }

  getValue(): string {
    return this.value;
  }

  equals(other: EventId): boolean {
    return this.value === other.value;
  }
}
