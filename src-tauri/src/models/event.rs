use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Event {
    pub event_id: String,
    pub entity: String,
    pub attribute: String,
    pub value: serde_json::Value,
    pub timestamp: HashMap<String, i64>, // Vector clock
}

impl Event {
    pub fn new(
        entity: String,
        attribute: String,
        value: serde_json::Value,
        timestamp: HashMap<String, i64>,
    ) -> Self {
        Self {
            event_id: uuid::Uuid::new_v4().to_string(),
            entity,
            attribute,
            value,
            timestamp,
        }
    }
}
