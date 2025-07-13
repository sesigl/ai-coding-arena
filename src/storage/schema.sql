-- ABOUTME: Database schema for event storage in DuckDB
-- Creates events table with indexes for efficient querying

CREATE TABLE events (
  id BIGINT PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL,
  competition_id TEXT NOT NULL,
  round_id TEXT NOT NULL, -- number as string or 'NOT_APPLICABLE'
  participant_id TEXT NOT NULL, -- participant name or 'SYSTEM'
  event_type TEXT NOT NULL,
  phase TEXT NOT NULL, -- 'baseline' | 'bug_injection' | 'fix_attempt' | 'system'
  data JSON NOT NULL,
  success BOOLEAN NOT NULL,
  duration_seconds TEXT NOT NULL -- number as string or 'NOT_MEASURED'
);

-- Indexes for efficient querying
CREATE INDEX idx_events_competition ON events(competition_id);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_participant ON events(participant_id);
CREATE INDEX idx_events_phase ON events(phase);