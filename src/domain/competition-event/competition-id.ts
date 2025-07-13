// ABOUTME: CompetitionId value object for competition identification
// Ensures competition IDs are non-empty strings with validation

export class CompetitionId {
  constructor(private readonly value: string) {
    if (!value.trim()) {
      throw new Error('CompetitionId cannot be empty');
    }
  }

  getValue(): string {
    return this.value;
  }

  equals(other: CompetitionId): boolean {
    return this.value === other.value;
  }
}
