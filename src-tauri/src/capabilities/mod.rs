pub mod builtins;
pub mod core;
pub mod file_sync_wrapper;
pub mod grants;
pub mod registry;

pub use core::{CapResult, CapabilityHandler};
pub use file_sync_wrapper::{FileSyncEngineWrapper, FileSyncService};
pub use grants::GrantsTable;
pub use registry::CapabilityRegistry;
