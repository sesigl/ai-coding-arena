// ABOUTME: ParticipantId value object for participant identification
// Supports both named participants and SYSTEM participant

export class ParticipantId {
  private constructor(private readonly value: string) {}

  static fromString(value: string): ParticipantId {
    if (!value.trim()) {
      throw new Error('ParticipantId cannot be empty');
    }
    return new ParticipantId(value);
  }

  static system(): ParticipantId {
    return new ParticipantId('SYSTEM');
  }

  getValue(): string {
    return this.value;
  }

  isSystem(): boolean {
    return this.value === 'SYSTEM';
  }

  equals(other: ParticipantId): boolean {
    return this.value === other.value;
  }
}
