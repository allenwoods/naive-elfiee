use crate::models::Event;
use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};
use sqlx::Row;
use std::path::PathBuf;
use std::str::FromStr;

/// Event pool with database file path
///
/// This structure wraps SqlitePool with the database file path,
/// allowing the engine to derive temp_dir at runtime.
#[derive(Clone)]
pub struct EventPoolWithPath {
    /// SQLite connection pool for event storage
    pub pool: SqlitePool,

    /// Path to the events.db file (e.g., /tmp/xyz789/events.db)
    pub db_path: PathBuf,
}

/// Event store for persisting events to SQLite database.
///
/// This implementation uses sqlx for async database operations,
/// making it compatible with tokio runtime and safe to use across threads.
pub struct EventStore;

impl EventStore {
    /// Create a new event store and initialize the database schema.
    ///
    /// The path can be:
    /// - A file path like "events.db" or "./data/events.db"
    /// - ":memory:" for in-memory database (testing)
    ///
    /// Returns an EventPoolWithPath containing both the pool and db_path.
    pub async fn create(path: &str) -> Result<EventPoolWithPath, sqlx::Error> {
        let connection_string = if path == ":memory:" {
            "sqlite::memory:".to_string()
        } else {
            // Ensure parent directory exists
            if let Some(parent) = std::path::Path::new(path).parent() {
                std::fs::create_dir_all(parent).map_err(sqlx::Error::Io)?;
            }

            // Use sqlite: prefix for file paths
            format!("sqlite://{}", path)
        };

        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect_with(
                sqlx::sqlite::SqliteConnectOptions::from_str(&connection_string)?
                    .create_if_missing(true),
            )
            .await?;

        // Initialize schema
        Self::init_schema(&pool).await?;

        // Return both pool and path
        Ok(EventPoolWithPath {
            pool,
            db_path: PathBuf::from(path),
        })
    }

    /// Initialize the database schema (tables and indexes).
    async fn init_schema(pool: &SqlitePool) -> Result<(), sqlx::Error> {
        // Create events table
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS events (
                event_id TEXT PRIMARY KEY,
                entity TEXT NOT NULL,
                attribute TEXT NOT NULL,
                value TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                created_at TEXT NOT NULL
            )",
        )
        .execute(pool)
        .await?;

        // Create index on entity for faster lookups
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_entity ON events(entity)")
            .execute(pool)
            .await?;

        // Create index on attribute
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_attribute ON events(attribute)")
            .execute(pool)
            .await?;

        Ok(())
    }

    /// Append events to the database.
    pub async fn append_events(pool: &SqlitePool, events: &[Event]) -> Result<(), sqlx::Error> {
        for event in events {
            let timestamp_json = serde_json::to_string(&event.timestamp)
                .map_err(|e| sqlx::Error::Encode(Box::new(e)))?;
            let value_json = serde_json::to_string(&event.value)
                .map_err(|e| sqlx::Error::Encode(Box::new(e)))?;

            sqlx::query(
                "INSERT INTO events (event_id, entity, attribute, value, timestamp, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6)",
            )
            .bind(&event.event_id)
            .bind(&event.entity)
            .bind(&event.attribute)
            .bind(&value_json)
            .bind(&timestamp_json)
            .bind(&event.created_at)
            .execute(pool)
            .await?;
        }
        Ok(())
    }

    /// Get all events from the database, ordered by insertion order (rowid).
    pub async fn get_all_events(pool: &SqlitePool) -> Result<Vec<Event>, sqlx::Error> {
        let rows = sqlx::query(
            "SELECT event_id, entity, attribute, value, timestamp, created_at
             FROM events
             ORDER BY rowid",
        )
        .fetch_all(pool)
        .await?;

        let mut events = Vec::new();
        for row in rows {
            let event = Self::row_to_event(row)?;
            events.push(event);
        }

        Ok(events)
    }

    /// Get events for a specific entity.
    pub async fn get_events_by_entity(
        pool: &SqlitePool,
        entity: &str,
    ) -> Result<Vec<Event>, sqlx::Error> {
        let rows = sqlx::query(
            "SELECT event_id, entity, attribute, value, timestamp, created_at
             FROM events
             WHERE entity = $1
             ORDER BY rowid",
        )
        .bind(entity)
        .fetch_all(pool)
        .await?;

        let mut events = Vec::new();
        for row in rows {
            let event = Self::row_to_event(row)?;
            events.push(event);
        }

        Ok(events)
    }

    /// Convert a database row to an Event.
    fn row_to_event(row: sqlx::sqlite::SqliteRow) -> Result<Event, sqlx::Error> {
        let event_id: String = row.try_get(0)?;
        let entity: String = row.try_get(1)?;
        let attribute: String = row.try_get(2)?;
        let value_json: String = row.try_get(3)?;
        let timestamp_json: String = row.try_get(4)?;
        let created_at: String = row.try_get(5)?;

        let value: serde_json::Value =
            serde_json::from_str(&value_json).map_err(|e| sqlx::Error::Decode(Box::new(e)))?;
        let timestamp =
            serde_json::from_str(&timestamp_json).map_err(|e| sqlx::Error::Decode(Box::new(e)))?;

        Ok(Event {
            event_id,
            entity,
            attribute,
            value,
            timestamp,
            created_at,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use tempfile::NamedTempFile;

    #[tokio::test]
    async fn test_event_pool_with_path_creation() {
        // 测试：EventPoolWithPath应该同时包含pool和db_path
        let temp_file = NamedTempFile::new().unwrap();
        let db_path = temp_file.path().to_str().unwrap();

        let result = EventStore::create(db_path).await.unwrap();

        // 验证pool可用
        assert!(!result.pool.is_closed());

        // 验证db_path正确
        assert_eq!(result.db_path.to_str().unwrap(), db_path);

        // 验证可以从db_path推导temp_dir
        let temp_dir = result.db_path.parent().unwrap();
        assert!(temp_dir.exists());
    }

    #[tokio::test]
    async fn test_temp_dir_derivation() {
        // 测试：应该能从db_path推导回temp_dir
        let temp_dir = tempfile::TempDir::new().unwrap();
        let db_path = temp_dir.path().join("events.db");

        let result = EventStore::create(db_path.to_str().unwrap()).await.unwrap();

        // 验证可以推导回temp_dir
        let derived_temp_dir = result.db_path.parent().unwrap();
        assert_eq!(derived_temp_dir, temp_dir.path());
    }

    #[tokio::test]
    async fn test_event_pool_with_path_memory_db() {
        // 测试：内存数据库应该使用特殊路径
        let result = EventStore::create(":memory:").await.unwrap();

        assert!(!result.pool.is_closed());
        assert_eq!(result.db_path.to_str().unwrap(), ":memory:");
    }

    #[tokio::test]
    async fn test_append_and_retrieve_events() {
        let event_pool_with_path = EventStore::create(":memory:").await.unwrap();

        let mut timestamp = HashMap::new();
        timestamp.insert("editor1".to_string(), 1);

        let events = vec![
            Event::new(
                "block1".to_string(),
                "name".to_string(),
                serde_json::json!("My Block"),
                timestamp.clone(),
            ),
            Event::new(
                "block1".to_string(),
                "type".to_string(),
                serde_json::json!("markdown"),
                timestamp.clone(),
            ),
        ];

        EventStore::append_events(&event_pool_with_path.pool, &events)
            .await
            .unwrap();

        let retrieved = EventStore::get_all_events(&event_pool_with_path.pool)
            .await
            .unwrap();
        assert_eq!(retrieved.len(), 2);
        assert_eq!(retrieved[0].entity, "block1");
        assert_eq!(retrieved[0].attribute, "name");
        assert_eq!(retrieved[1].attribute, "type");
    }

    #[tokio::test]
    async fn test_get_events_by_entity() {
        let event_pool_with_path = EventStore::create(":memory:").await.unwrap();

        let mut timestamp = HashMap::new();
        timestamp.insert("editor1".to_string(), 1);

        let events = vec![
            Event::new(
                "block1".to_string(),
                "name".to_string(),
                serde_json::json!("Block 1"),
                timestamp.clone(),
            ),
            Event::new(
                "block2".to_string(),
                "name".to_string(),
                serde_json::json!("Block 2"),
                timestamp.clone(),
            ),
            Event::new(
                "block1".to_string(),
                "type".to_string(),
                serde_json::json!("code"),
                timestamp.clone(),
            ),
        ];

        EventStore::append_events(&event_pool_with_path.pool, &events)
            .await
            .unwrap();

        let block1_events = EventStore::get_events_by_entity(&event_pool_with_path.pool, "block1")
            .await
            .unwrap();
        assert_eq!(block1_events.len(), 2);
        assert_eq!(block1_events[0].attribute, "name");
        assert_eq!(block1_events[1].attribute, "type");
    }
}
