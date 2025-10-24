use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Editor {
    pub editor_id: String,
    pub name: String,
}

impl Editor {
    pub fn new(name: String) -> Self {
        Self {
            editor_id: uuid::Uuid::new_v4().to_string(),
            name,
        }
    }
}
