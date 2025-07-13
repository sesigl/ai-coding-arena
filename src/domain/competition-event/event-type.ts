// ABOUTME: EventType enumeration for all competition event types
// Defines all possible event types in the system

export enum EventType {
  COMPETITION_STARTED = 'competition_started',
  ROUND_STARTED = 'round_started',
  BASELINE_CREATION_STARTED = 'baseline_creation_started',
  CLI_COMMAND_EXECUTED = 'cli_command_executed',
  FILE_CREATED = 'file_created',
  FILE_MODIFIED = 'file_modified',
  FILE_DELETED = 'file_deleted',
  TESTS_EXECUTED = 'tests_executed',
  BASELINE_COMPLETED = 'baseline_completed',
  BUG_INJECTION_STARTED = 'bug_injection_started',
  BUG_INJECTION_COMPLETED = 'bug_injection_completed',
  FIX_ATTEMPT_STARTED = 'fix_attempt_started',
  FIX_ATTEMPT_COMPLETED = 'fix_attempt_completed',
  ROUND_COMPLETED = 'round_completed',
  COMPETITION_COMPLETED = 'competition_completed',
}
