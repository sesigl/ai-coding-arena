// ABOUTME: RoundId value object for round identification
// Supports both numeric rounds and NOT_APPLICABLE state

export class RoundId {
  private constructor(private readonly value: number | 'NOT_APPLICABLE') {}

  static fromNumber(value: number): RoundId {
    if (value < 1) {
      throw new Error('Round number must be positive');
    }
    return new RoundId(value);
  }

  static notApplicable(): RoundId {
    return new RoundId('NOT_APPLICABLE');
  }

  getValue(): number | 'NOT_APPLICABLE' {
    return this.value;
  }

  isNumeric(): boolean {
    return typeof this.value === 'number';
  }

  equals(other: RoundId): boolean {
    return this.value === other.value;
  }
}