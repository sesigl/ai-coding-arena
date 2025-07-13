// ABOUTME: EventId value object for unique event identification
// Ensures event IDs are positive numbers with equality checking

export class EventId {
  constructor(private readonly value: number) {
    if (value < 0) {
      throw new Error('EventId must be positive');
    }
  }

  getValue(): number {
    return this.value;
  }

  equals(other: EventId): boolean {
    return this.value === other.value;
  }
}
