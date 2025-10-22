use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Event {
    pub event_id: String,
    pub entity: String,
    pub attribute: String,
    pub value: serde_json::Value,
    pub timestamp: HashMap<String, u64>, // Vector clock
}

impl Event {
    pub fn new(
        entity: String,
        attribute: String,
        value: serde_json::Value,
        timestamp: HashMap<String, u64>,
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
