// ABOUTME: Score card interface tracking detailed statistics for each participant
// Records fixes, bugs solved, baseline failures, and bug injection failures

export interface ScoreCard {
  readonly fixes: number;
  readonly bugsSolved: number;
  readonly baselineFailures: number;
  readonly bugInjectionFailures: number;
}
