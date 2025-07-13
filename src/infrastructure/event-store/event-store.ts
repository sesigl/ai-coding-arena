// ABOUTME: EventStore infrastructure implementation for DuckDB event storage
// Handles connection management, initialization, and basic CRUD operations

import * as duckdb from 'duckdb';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { Result, ok, err } from 'neverthrow';
import { CompetitionEvent } from 'domain/competition-event/competition-event';
import { CompetitionId } from 'domain/competition-event/competition-id';
import { ParticipantId } from 'domain/competition-event/participant-id';
import { EventType } from 'domain/competition-event/event-type';

interface EventRow {
  id: number;
  timestamp: string | number;
  competition_id: string;
  round_id: string;
  participant_id: string;
  event_type: string;
  phase: string;
  data: string;
  success: boolean;
  duration_seconds: string;
}

export class EventStore {
  private asEventRow(row: unknown): EventRow {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as number,
      timestamp: r.timestamp as string | number,
      competition_id: r.competition_id as string,
      round_id: r.round_id as string,
      participant_id: r.participant_id as string,
      event_type: r.event_type as string,
      phase: r.phase as string,
      data: r.data as string,
      success: r.success as boolean,
      duration_seconds: r.duration_seconds as string,
    };
  }

  private asCountRow(row: unknown): { count: number } {
    const r = row as Record<string, unknown>;
    return { count: r.count as number };
  }
  private db: duckdb.Database | undefined;
  private readonly dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async initialize(): Promise<Result<void, Error>> {
    try {
      this.db = new duckdb.Database(this.dbPath);

      const schemaPath = join(__dirname, 'schema.sql');
      const schema = await readFile(schemaPath, 'utf-8');

      await this.exec(schema);
      return ok(undefined);
    } catch (error) {
      return err(error instanceof Error ? error : new Error('Failed to initialize database'));
    }
  }

  async insertEvent(event: CompetitionEvent): Promise<Result<void, Error>> {
    if (!this.db) {
      return err(new Error('Database not initialized'));
    }

    try {
      const query = `
        INSERT INTO events (
          id, timestamp, competition_id, round_id, participant_id,
          event_type, phase, data, success, duration_seconds
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const rawData = event.toRawData();
      const params = [
        rawData.id,
        rawData.timestamp.toISOString(),
        rawData.competition_id,
        typeof rawData.round_id === 'number' ? rawData.round_id.toString() : rawData.round_id,
        rawData.participant_id,
        rawData.event_type,
        rawData.phase,
        JSON.stringify(rawData.data),
        rawData.success,
        typeof rawData.duration_seconds === 'number'
          ? rawData.duration_seconds.toString()
          : rawData.duration_seconds,
      ];

      await this.run(query, params);
      return ok(undefined);
    } catch (error) {
      return err(error instanceof Error ? error : new Error('Failed to insert event'));
    }
  }

  async getEvents(): Promise<Result<CompetitionEvent[], Error>> {
    if (!this.db) {
      return err(new Error('Database not initialized'));
    }

    try {
      const query = 'SELECT * FROM events ORDER BY timestamp ASC';
      const rows = await this.all(query);

      const events: CompetitionEvent[] = rows.map(row => {
        const eventRow = this.asEventRow(row);
        return CompetitionEvent.fromRawData({
          id: eventRow.id,
          timestamp: new Date(eventRow.timestamp),
          competition_id: eventRow.competition_id,
          round_id: isNaN(Number(eventRow.round_id))
            ? (eventRow.round_id as 'NOT_APPLICABLE')
            : Number(eventRow.round_id),
          participant_id: eventRow.participant_id,
          event_type: eventRow.event_type,
          phase: eventRow.phase,
          data: JSON.parse(eventRow.data),
          success: eventRow.success,
          duration_seconds: isNaN(Number(eventRow.duration_seconds))
            ? (eventRow.duration_seconds as 'NOT_MEASURED')
            : Number(eventRow.duration_seconds),
        });
      });

      return ok(events);
    } catch (error) {
      return err(error instanceof Error ? error : new Error('Failed to get events'));
    }
  }

  async getEventsByCompetition(
    competitionId: CompetitionId
  ): Promise<Result<CompetitionEvent[], Error>> {
    if (!this.db) {
      return err(new Error('Database not initialized'));
    }

    try {
      const query = 'SELECT * FROM events WHERE competition_id = ? ORDER BY timestamp ASC';
      const rows = await this.all(query, [competitionId.getValue()]);

      const events: CompetitionEvent[] = rows.map(row => {
        const eventRow = this.asEventRow(row);
        return CompetitionEvent.fromRawData({
          id: eventRow.id,
          timestamp: new Date(eventRow.timestamp),
          competition_id: eventRow.competition_id,
          round_id: isNaN(Number(eventRow.round_id))
            ? (eventRow.round_id as 'NOT_APPLICABLE')
            : Number(eventRow.round_id),
          participant_id: eventRow.participant_id,
          event_type: eventRow.event_type,
          phase: eventRow.phase,
          data: JSON.parse(eventRow.data),
          success: eventRow.success,
          duration_seconds: isNaN(Number(eventRow.duration_seconds))
            ? (eventRow.duration_seconds as 'NOT_MEASURED')
            : Number(eventRow.duration_seconds),
        });
      });

      return ok(events);
    } catch (error) {
      return err(error instanceof Error ? error : new Error('Failed to get events by competition'));
    }
  }

  async getEventsByParticipant(
    participantId: ParticipantId
  ): Promise<Result<CompetitionEvent[], Error>> {
    if (!this.db) {
      return err(new Error('Database not initialized'));
    }

    try {
      const query = 'SELECT * FROM events WHERE participant_id = ? ORDER BY timestamp ASC';
      const rows = await this.all(query, [participantId.getValue()]);

      const events: CompetitionEvent[] = rows.map(row => {
        const eventRow = this.asEventRow(row);
        return CompetitionEvent.fromRawData({
          id: eventRow.id,
          timestamp: new Date(eventRow.timestamp),
          competition_id: eventRow.competition_id,
          round_id: isNaN(Number(eventRow.round_id))
            ? (eventRow.round_id as 'NOT_APPLICABLE')
            : Number(eventRow.round_id),
          participant_id: eventRow.participant_id,
          event_type: eventRow.event_type,
          phase: eventRow.phase,
          data: JSON.parse(eventRow.data),
          success: eventRow.success,
          duration_seconds: isNaN(Number(eventRow.duration_seconds))
            ? (eventRow.duration_seconds as 'NOT_MEASURED')
            : Number(eventRow.duration_seconds),
        });
      });

      return ok(events);
    } catch (error) {
      return err(error instanceof Error ? error : new Error('Failed to get events by participant'));
    }
  }

  async getEventsByType(eventType: EventType): Promise<Result<CompetitionEvent[], Error>> {
    if (!this.db) {
      return err(new Error('Database not initialized'));
    }

    try {
      const query = 'SELECT * FROM events WHERE event_type = ? ORDER BY timestamp ASC';
      const rows = await this.all(query, [eventType]);

      const events: CompetitionEvent[] = rows.map(row => {
        const eventRow = this.asEventRow(row);
        return CompetitionEvent.fromRawData({
          id: eventRow.id,
          timestamp: new Date(eventRow.timestamp),
          competition_id: eventRow.competition_id,
          round_id: isNaN(Number(eventRow.round_id))
            ? (eventRow.round_id as 'NOT_APPLICABLE')
            : Number(eventRow.round_id),
          participant_id: eventRow.participant_id,
          event_type: eventRow.event_type,
          phase: eventRow.phase,
          data: JSON.parse(eventRow.data),
          success: eventRow.success,
          duration_seconds: isNaN(Number(eventRow.duration_seconds))
            ? (eventRow.duration_seconds as 'NOT_MEASURED')
            : Number(eventRow.duration_seconds),
        });
      });

      return ok(events);
    } catch (error) {
      return err(error instanceof Error ? error : new Error('Failed to get events by type'));
    }
  }

  async getEventCount(): Promise<Result<number, Error>> {
    if (!this.db) {
      return err(new Error('Database not initialized'));
    }

    try {
      const query = 'SELECT COUNT(*) as count FROM events';
      const rows = await this.all(query);

      const countRow = this.asCountRow(rows[0] || {});
      const count = Number(countRow.count || 0);
      return ok(count);
    } catch (error) {
      return err(error instanceof Error ? error : new Error('Failed to count events'));
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = undefined;
    }
  }

  private async exec(query: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.exec(query, err => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private async run(query: string, params: unknown[]): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.run(query, ...params, err => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private async all(query: string, params: unknown[] = []): Promise<unknown[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      if (params.length > 0) {
        this.db.all(query, ...params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      } else {
        this.db.all(query, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      }
    });
  }
}
