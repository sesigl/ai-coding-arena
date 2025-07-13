// ABOUTME: EventStore infrastructure implementation for DuckDB event storage
// Handles connection management, initialization, and basic CRUD operations

import * as duckdb from 'duckdb';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { Result, ok, err } from 'neverthrow';
import { CompetitionEvent } from 'domain/competition-event';

export class EventStore {
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
        typeof rawData.duration_seconds === 'number' ? rawData.duration_seconds.toString() : rawData.duration_seconds
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
      
      const events: CompetitionEvent[] = rows.map(row => 
        CompetitionEvent.fromRawData({
          id: row.id,
          timestamp: new Date(row.timestamp),
          competition_id: row.competition_id,
          round_id: isNaN(Number(row.round_id)) ? row.round_id as 'NOT_APPLICABLE' : Number(row.round_id),
          participant_id: row.participant_id,
          event_type: row.event_type,
          phase: row.phase,
          data: JSON.parse(row.data),
          success: row.success,
          duration_seconds: isNaN(Number(row.duration_seconds)) ? row.duration_seconds as 'NOT_MEASURED' : Number(row.duration_seconds)
        })
      );

      return ok(events);
    } catch (error) {
      return err(error instanceof Error ? error : new Error('Failed to get events'));
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
      
      this.db.exec(query, (err) => {
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
      
      this.db.run(query, ...params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private async all(query: string, params: unknown[] = []): Promise<any[]> {
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