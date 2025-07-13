# DuckDB Node.js Best Practices

## Connection Management

### Instance Creation

```javascript
const instance = await DuckDBInstance.create('my_duckdb.db', {
  threads: '4',
});
```

### Instance Caching

Use instance caching to prevent duplicate database attachments:

```javascript
const instance = await DuckDBInstance.fromCache('my_duckdb.db');
```

### Connection Lifecycle

```javascript
// Create connection
const connection = await instance.connect();

// Use connection for queries
const result = await connection.run(sql);

// Always close when done
await connection.close();
```

## Prepared Statements

### Parameter Binding

Bind parameters with type inference or explicit typing:

```javascript
const prepared = await connection.prepare('select $a, $b, $c');
prepared.bind({
  a: 'duck',
  b: 42,
  c: listValue([10, 11, 12]),
});
```

### Named Parameters

Use named parameters ($name) instead of positional (?) for clarity:

```javascript
const stmt = await connection.prepare('INSERT INTO table VALUES ($id, $name, $value)');
await stmt.bind({ id: 1, name: 'test', value: 42 });
```

## Query Execution

### Run to Completion

```javascript
const result = await connection.run(sql);
```

### Streaming Results

For large result sets:

```javascript
const reader = await connection.streamAndReadAll(sql);
const rows = reader.getRowObjects();
```

### Limited Streaming

Read specific number of rows:

```javascript
const reader = await connection.streamAndReadUntil(sql, 1000);
```

## Error Handling

Always wrap database operations in try/catch:

```javascript
try {
  const result = await connection.run(sql);
  return ok(result);
} catch (error) {
  return err(new Error(`Query failed: ${error.message}`));
}
```

## Data Conversion

### Different Result Formats

```javascript
const rowsJson = reader.getRowsJson(); // JSON strings
const rowObjects = reader.getRowObjects(); // JavaScript objects
const rawRows = reader.getRows(); // Raw format
```

## Key Patterns for Event Store

### Safe Initialization

```javascript
async initialize(): Promise<Result<void, Error>> {
  try {
    this.instance = await DuckDBInstance.create(this.dbPath);
    this.connection = await this.instance.connect();

    // Run schema
    await this.connection.run(schemaSQL);
    return ok(undefined);
  } catch (error) {
    return err(error);
  }
}
```

### Parameterized Inserts

```javascript
async insertEvent(event: CompetitionEvent): Promise<Result<void, Error>> {
  try {
    const stmt = await this.connection.prepare(`
      INSERT INTO events (id, timestamp, competition_id, round_id, participant_id,
                         event_type, phase, data, success, duration_seconds)
      VALUES ($id, $timestamp, $competition_id, $round_id, $participant_id,
              $event_type, $phase, $data, $success, $duration_seconds)
    `);

    await stmt.bind({
      id: event.id,
      timestamp: event.timestamp.toISOString(),
      competition_id: event.competition_id,
      round_id: typeof event.round_id === 'number' ? event.round_id : event.round_id,
      participant_id: event.participant_id,
      event_type: event.event_type,
      phase: event.phase,
      data: JSON.stringify(event.data),
      success: event.success,
      duration_seconds: typeof event.duration_seconds === 'number' ? event.duration_seconds : event.duration_seconds
    });

    await stmt.run();
    return ok(undefined);
  } catch (error) {
    return err(error);
  }
}
```

### Safe Query Execution

```javascript
async getEvents(): Promise<Result<CompetitionEvent[], Error>> {
  try {
    const result = await this.connection.run('SELECT * FROM events ORDER BY timestamp ASC');
    const rows = result.getRowObjects();

    const events = rows.map(row => ({
      id: row.id,
      timestamp: new Date(row.timestamp),
      competition_id: row.competition_id,
      // ... map other fields
    }));

    return ok(events);
  } catch (error) {
    return err(error);
  }
}
```

### Proper Cleanup

```javascript
async close(): Promise<void> {
  if (this.connection) {
    await this.connection.close();
    this.connection = undefined;
  }
  if (this.instance) {
    await this.instance.close();
    this.instance = undefined;
  }
}
```

## Anti-Patterns to Avoid

1. **Don't use string concatenation for queries** - always use prepared statements
2. **Don't forget to close connections** - use try/finally or explicit cleanup
3. **Don't use synchronous methods** - always use async/await
4. **Don't ignore error handling** - wrap all database operations
5. **Don't create multiple instances for same database** - use caching
