use serde::{Deserialize, Serialize};
use specta::Type;

/// Metadata for a capability.
/// Actual handler functions are registered separately.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Capability {
    pub cap_id: String,
    pub name: String,
    pub target: String, // block_type this capability applies to
}
