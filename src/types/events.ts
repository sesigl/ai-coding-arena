// ABOUTME: Core event types and interfaces for competition event storage
// Defines all event structures used in the event-sourced architecture

export interface CompetitionEvent {
  readonly id: number;
  readonly timestamp: Date;
  readonly competition_id: string;
  readonly round_id: number | 'NOT_APPLICABLE';
  readonly participant_id: string | 'SYSTEM';
  readonly event_type: EventType;
  readonly phase: Phase;
  readonly data: Record<string, unknown>;
  readonly success: boolean;
  readonly duration_seconds: number | 'NOT_MEASURED';
}

export type EventType =
  | 'competition_started'
  | 'round_started'
  | 'baseline_creation_started'
  | 'cli_command_executed'
  | 'file_created'
  | 'file_modified'
  | 'file_deleted'
  | 'tests_executed'
  | 'baseline_completed'
  | 'bug_injection_started'
  | 'bug_injection_completed'
  | 'fix_attempt_started'
  | 'fix_attempt_completed'
  | 'round_completed'
  | 'competition_completed';

export type Phase = 'baseline' | 'bug_injection' | 'fix_attempt' | 'system';

export interface EventInsertRequest {
  readonly competition_id: string;
  readonly round_id: number | 'NOT_APPLICABLE';
  readonly participant_id: string | 'SYSTEM';
  readonly event_type: EventType;
  readonly phase: Phase;
  readonly data: Record<string, unknown>;
  readonly success: boolean;
  readonly duration_seconds: number | 'NOT_MEASURED';
}