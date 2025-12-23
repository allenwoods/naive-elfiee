use std::fs;
use std::path::Path;

/// 检查路径是否安全（防止路径遍历攻击）
pub fn is_safe_path(path: &Path) -> Result<(), String> {
    // 1. 获取规范路径（如果路径存在）
    // 注意：如果路径不存在，canonicalize 会失败。
    // 对于导入/刷新，路径必须存在。
    let canonical = path
        .canonicalize()
        .map_err(|e| format!("Invalid path: {}", e))?;

    // 2. 拒绝系统敏感目录 (简单检查)
    let forbidden = ["/etc", "/sys", "/proc", "/dev", "/bin", "/sbin"];
    for forbidden_dir in &forbidden {
        if canonical.starts_with(forbidden_dir) {
            return Err(format!(
                "Access to system directory is forbidden: {}",
                forbidden_dir
            ));
        }
    }

    // 3. 检测符号链接
    let metadata =
        fs::symlink_metadata(&canonical).map_err(|e| format!("Failed to read metadata: {}", e))?;

    if metadata.is_symlink() {
        return Err("Symbolic links are not allowed".to_string());
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_valid_path() {
        let temp_dir = TempDir::new().unwrap();
        let result = is_safe_path(temp_dir.path());
        assert!(result.is_ok());
    }

    #[test]
    fn test_nonexistent_path() {
        let path = Path::new("/nonexistent/path/12345");
        let result = is_safe_path(path);
        assert!(result.is_err());
    }

    #[test]
    #[cfg(unix)]
    fn test_forbidden_directory() {
        let path = Path::new("/etc/passwd");
        if path.exists() {
            let result = is_safe_path(path);
            assert!(result.is_err());
            assert!(result
                .unwrap_err()
                .contains("Access to system directory is forbidden"));
        }
    }
}
