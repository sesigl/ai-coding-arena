// ABOUTME: Custom error type for game state violations and invalid operations
// Provides clear error messaging for fail-fast behavior in competition logic

export class GameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GameError';
  }
}
