/// Infer Block Type from file extension.
///
/// Strategy:
/// 1. Known markdown extensions -> "markdown"
/// 2. Known code/config extensions -> "code"
/// 3. Known binary extensions (images, executables, etc.) -> None (Skip)
/// 4. Unknown extensions -> Some("code") (Treat as plain text fallback)
pub fn infer_block_type(extension: &str) -> Option<String> {
    let ext = extension.to_lowercase();

    // 1. Explicit Binary Blacklist - Do NOT import these into DB as text
    match ext.as_str() {
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "ico" | // Images
        "mp4" | "mov" | "avi" | "mkv" |                          // Video
        "mp3" | "wav" | "ogg" | "flac" |                         // Audio
        "pdf" | "zip" | "tar" | "gz" | "7z" | "rar" |            // Archives
        "exe" | "dll" | "so" | "dylib" | "bin" | "obj" | "o" |   // Binary/Compiled
        "pyc" | "class" | "wasm" |                               // Bytecode
        "db" | "sqlite" | "sqlite3" => return None,              // Databases
        _ => {}
    }

    // 2. Specific Type Mapping
    match ext.as_str() {
        // Markdown
        "md" | "markdown" => Some("markdown".to_string()),

        // Code (Handled by 'code' block type)
        "rs" | "py" | "js" | "ts" | "jsx" | "tsx" | "c" | "cpp" | "h" | "hpp" | "java" | "go"
        | "rb" | "php" | "swift" | "kt" | "cs" | "scala" | "json" | "toml" | "yaml" | "yml"
        | "xml" | "ini" | "conf" | "sh" | "bash" | "zsh" | "fish" | "html" | "htm" | "css"
        | "scss" | "sass" | "less" | "sql" => Some("code".to_string()),

        // 3. Fallback: Treat everything else as plain text 'code' block
        // This ensures we don't miss .env, .gitignore, license files, etc.
        _ => Some("code".to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_markdown_extensions() {
        assert_eq!(infer_block_type("md"), Some("markdown".to_string()));
        assert_eq!(infer_block_type("MD"), Some("markdown".to_string()));
    }

    #[test]
    fn test_known_code_extensions() {
        assert_eq!(infer_block_type("rs"), Some("code".to_string()));
        assert_eq!(infer_block_type("json"), Some("code".to_string()));
    }

    #[test]
    fn test_binary_blacklist() {
        assert_eq!(infer_block_type("png"), None);
        assert_eq!(infer_block_type("exe"), None);
        assert_eq!(infer_block_type("wasm"), None);
        assert_eq!(infer_block_type("db"), None);
    }

    #[test]
    fn test_fallback_to_code() {
        // Unknown or missing extensions should be treated as text
        assert_eq!(infer_block_type("env"), Some("code".to_string()));
        assert_eq!(infer_block_type("gitignore"), Some("code".to_string()));
        assert_eq!(infer_block_type("LICENSE"), Some("code".to_string()));
        assert_eq!(infer_block_type(""), Some("code".to_string()));
    }
}
