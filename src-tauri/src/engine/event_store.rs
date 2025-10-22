use crate::models::Event;
use rusqlite::{Connection, Result};

pub struct EventStore {
    conn: Connection,
}

impl EventStore {
    pub fn new(path: &str) -> Result<Self> {
        let conn = Connection::open(path)?;
        conn.execute(
            "CREATE TABLE IF NOT EXISTS events (
                event_id TEXT PRIMARY KEY,
                entity TEXT NOT NULL,
                attribute TEXT NOT NULL,
                value TEXT NOT NULL,
                timestamp TEXT NOT NULL
            )",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_entity ON events(entity)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_attribute ON events(attribute)",
            [],
        )?;
        Ok(Self { conn })
    }

    pub fn append_events(&self, events: &[Event]) -> Result<()> {
        for event in events {
            let timestamp_json = serde_json::to_string(&event.timestamp)
                .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
            let value_json = serde_json::to_string(&event.value)
                .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;

            self.conn.execute(
                "INSERT INTO events (event_id, entity, attribute, value, timestamp) VALUES (?1, ?2, ?3, ?4, ?5)",
                rusqlite::params![
                    &event.event_id,
                    &event.entity,
                    &event.attribute,
                    &value_json,
                    &timestamp_json,
                ],
            )?;
        }
        Ok(())
    }

    pub fn get_all_events(&self) -> Result<Vec<Event>> {
        let mut stmt = self.conn.prepare("SELECT event_id, entity, attribute, value, timestamp FROM events ORDER BY rowid")?;
        let events = stmt
            .query_map([], |row| {
                let event_id: String = row.get(0)?;
                let entity: String = row.get(1)?;
                let attribute: String = row.get(2)?;
                let value_json: String = row.get(3)?;
                let timestamp_json: String = row.get(4)?;

                let value: serde_json::Value = serde_json::from_str(&value_json)
                    .map_err(|e| rusqlite::Error::FromSqlConversionFailure(3, rusqlite::types::Type::Text, Box::new(e)))?;
                let timestamp = serde_json::from_str(&timestamp_json)
                    .map_err(|e| rusqlite::Error::FromSqlConversionFailure(4, rusqlite::types::Type::Text, Box::new(e)))?;

                Ok(Event {
                    event_id,
                    entity,
                    attribute,
                    value,
                    timestamp,
                })
            })?
            .collect::<Result<Vec<_>>>()?;
        Ok(events)
    }

    pub fn get_events_by_entity(&self, entity: &str) -> Result<Vec<Event>> {
        let mut stmt = self.conn.prepare("SELECT event_id, entity, attribute, value, timestamp FROM events WHERE entity = ?1 ORDER BY rowid")?;
        let events = stmt
            .query_map([entity], |row| {
                let event_id: String = row.get(0)?;
                let entity: String = row.get(1)?;
                let attribute: String = row.get(2)?;
                let value_json: String = row.get(3)?;
                let timestamp_json: String = row.get(4)?;

                let value: serde_json::Value = serde_json::from_str(&value_json)
                    .map_err(|e| rusqlite::Error::FromSqlConversionFailure(3, rusqlite::types::Type::Text, Box::new(e)))?;
                let timestamp = serde_json::from_str(&timestamp_json)
                    .map_err(|e| rusqlite::Error::FromSqlConversionFailure(4, rusqlite::types::Type::Text, Box::new(e)))?;

                Ok(Event {
                    event_id,
                    entity,
                    attribute,
                    value,
                    timestamp,
                })
            })?
            .collect::<Result<Vec<_>>>()?;
        Ok(events)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn test_append_and_retrieve_events() {
        let store = EventStore::new(":memory:").unwrap();

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

        store.append_events(&events).unwrap();

        let retrieved = store.get_all_events().unwrap();
        assert_eq!(retrieved.len(), 2);
        assert_eq!(retrieved[0].entity, "block1");
        assert_eq!(retrieved[0].attribute, "name");
        assert_eq!(retrieved[1].attribute, "type");
    }

    #[test]
    fn test_get_events_by_entity() {
        let store = EventStore::new(":memory:").unwrap();

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

        store.append_events(&events).unwrap();

        let block1_events = store.get_events_by_entity("block1").unwrap();
        assert_eq!(block1_events.len(), 2);
        assert_eq!(block1_events[0].attribute, "name");
        assert_eq!(block1_events[1].attribute, "type");
    }
}
