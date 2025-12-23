/// 根据文件扩展名推断 Block 类型
pub fn infer_block_type(extension: &str) -> Option<String> {
    let ext = extension.to_lowercase();

    match ext.as_str() {
        // Markdown
        "md" | "markdown" => Some("markdown".to_string()),

        // Code
        "rs" | "py" | "js" | "ts" | "jsx" | "tsx" | "c" | "cpp" | "h" | "hpp" | "java" | "go"
        | "rb" | "php" | "swift" | "kt" | "cs" | "scala" => Some("code".to_string()),

        // Config/Data
        "json" | "toml" | "yaml" | "yml" | "xml" | "ini" | "conf" => Some("code".to_string()),

        // Shell scripts
        "sh" | "bash" | "zsh" | "fish" => Some("code".to_string()),

        // Web
        "html" | "htm" | "css" | "scss" | "sass" | "less" => Some("code".to_string()),

        // SQL
        "sql" => Some("code".to_string()),

        // 未支持的类型
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_markdown_extensions() {
        assert_eq!(infer_block_type("md"), Some("markdown".to_string()));
        assert_eq!(infer_block_type("markdown"), Some("markdown".to_string()));
        assert_eq!(infer_block_type("MD"), Some("markdown".to_string()));
    }

    #[test]
    fn test_code_extensions() {
        assert_eq!(infer_block_type("rs"), Some("code".to_string()));
        assert_eq!(infer_block_type("py"), Some("code".to_string()));
        assert_eq!(infer_block_type("js"), Some("code".to_string()));
        assert_eq!(infer_block_type("json"), Some("code".to_string()));
    }

    #[test]
    fn test_unsupported_extensions() {
        assert_eq!(infer_block_type("png"), None);
        assert_eq!(infer_block_type("jpg"), None);
        assert_eq!(infer_block_type("pdf"), None);
        assert_eq!(infer_block_type("exe"), None);
    }

    #[test]
    fn test_case_insensitive() {
        assert_eq!(infer_block_type("RS"), Some("code".to_string()));
        assert_eq!(infer_block_type("Py"), Some("code".to_string()));
    }
}
