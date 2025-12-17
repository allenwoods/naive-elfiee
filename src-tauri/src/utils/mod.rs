/// Utility modules for Elfiee application
///
/// This module provides common utility functions used throughout the application.
pub mod time;

// Re-export ONLY the single primary public API
// All other functions are internal (pub(crate)) to enforce consistent time format usage
pub use time::{
    now_utc, // The ONLY public function: Get current UTC timestamp in RFC 3339 format
};
