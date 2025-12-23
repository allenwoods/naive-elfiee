use std::path::{Path, PathBuf};
use walkdir::WalkDir;

/// 文件信息结构
#[derive(Debug, Clone)]
pub struct FileInfo {
    /// 绝对路径
    pub absolute_path: PathBuf,
    /// 相对路径（相对于扫描根目录）
    pub relative_path: String,
    /// 文件名
    pub file_name: String,
    /// 文件扩展名（不含点）
    pub extension: String,
    /// 文件大小（字节）
    pub size: u64,
    /// 是否为目录
    pub is_directory: bool,
}

/// 扫描选项
#[derive(Debug, Clone)]
pub struct ScanOptions {
    /// 最大递归深度
    pub max_depth: usize,
    /// 是否跟随符号链接
    pub follow_symlinks: bool,
    /// 是否忽略隐藏文件
    pub ignore_hidden: bool,
    /// 忽略的目录名称列表
    pub ignore_patterns: Vec<String>,
    /// 最大文件大小（字节）
    pub max_file_size: u64,
    /// 最大文件数量
    pub max_files: usize,
}

impl Default for ScanOptions {
    fn default() -> Self {
        Self {
            max_depth: 100,
            follow_symlinks: false,
            ignore_hidden: true,
            ignore_patterns: vec![
                "node_modules".to_string(),
                ".git".to_string(),
                "target".to_string(),
                "dist".to_string(),
                "build".to_string(),
                ".DS_Store".to_string(),
            ],
            max_file_size: 10 * 1024 * 1024, // 10 MB
            max_files: 10_000,
        }
    }
}

/// 扫描目录并返回文件列表
pub fn scan_directory(root: &Path, options: &ScanOptions) -> Result<Vec<FileInfo>, String> {
    let mut files = Vec::new();
    let mut count = 0;

    let walker = WalkDir::new(root)
        .max_depth(options.max_depth)
        .follow_links(options.follow_symlinks);

    for entry in walker {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        // 检查文件数量限制
        count += 1;
        if count > options.max_files {
            return Err(format!("Too many files (limit: {})", options.max_files));
        }

        // 跳过隐藏文件
        if options.ignore_hidden {
            if let Some(name) = path.file_name() {
                if name.to_string_lossy().starts_with('.') {
                    continue;
                }
            }
        }

        // 跳过忽略的目录
        let should_skip = options.ignore_patterns.iter().any(|pattern| {
            path.components()
                .any(|c| c.as_os_str().to_string_lossy() == *pattern)
        });
        if should_skip {
            continue;
        }

        let metadata = entry
            .metadata()
            .map_err(|e| format!("Failed to read metadata: {}", e))?;

        // 跳过大文件
        if metadata.is_file() && metadata.len() > options.max_file_size {
            // log::warn!("Skipping large file: {:?} ({} bytes)", path, metadata.len());
            continue;
        }

        let relative_path = path
            .strip_prefix(root)
            .map_err(|e| format!("Failed to strip prefix: {}", e))?
            .to_string_lossy()
            .to_string();

        // 跳过根目录本身
        if relative_path.is_empty() {
            continue;
        }

        let file_info = FileInfo {
            absolute_path: path.to_path_buf(),
            relative_path: relative_path.clone(),
            file_name: path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string(),
            extension: path
                .extension()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string(),
            size: metadata.len(),
            is_directory: metadata.is_dir(),
        };

        files.push(file_info);
    }

    Ok(files)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_scan_empty_directory() {
        let temp_dir = TempDir::new().unwrap();
        let options = ScanOptions::default();

        let files = scan_directory(temp_dir.path(), &options).unwrap();
        assert_eq!(files.len(), 0);
    }

    #[test]
    fn test_scan_with_files() {
        let temp_dir = TempDir::new().unwrap();
        fs::write(temp_dir.path().join("file1.txt"), "content").unwrap();
        fs::write(temp_dir.path().join("file2.md"), "content").unwrap();

        let options = ScanOptions::default();
        let files = scan_directory(temp_dir.path(), &options).unwrap();

        assert_eq!(files.len(), 2);
        assert!(files.iter().any(|f| f.file_name == "file1.txt"));
        assert!(files.iter().any(|f| f.file_name == "file2.md"));
    }

    #[test]
    fn test_scan_ignores_hidden_files() {
        let temp_dir = TempDir::new().unwrap();
        fs::write(temp_dir.path().join(".hidden"), "content").unwrap();
        fs::write(temp_dir.path().join("visible.txt"), "content").unwrap();

        let options = ScanOptions::default();
        let files = scan_directory(temp_dir.path(), &options).unwrap();

        assert_eq!(files.len(), 1);
        assert_eq!(files[0].file_name, "visible.txt");
    }

    #[test]
    fn test_scan_respects_ignore_patterns() {
        let temp_dir = TempDir::new().unwrap();
        fs::create_dir(temp_dir.path().join("node_modules")).unwrap();
        fs::write(temp_dir.path().join("node_modules/package.json"), "{}").unwrap();
        fs::write(temp_dir.path().join("main.js"), "code").unwrap();

        let options = ScanOptions::default();
        let files = scan_directory(temp_dir.path(), &options).unwrap();

        assert_eq!(files.len(), 1);
        assert_eq!(files[0].file_name, "main.js");
    }
}
