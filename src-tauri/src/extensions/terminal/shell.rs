//! Shell initialization script generation
//!
//! Generates platform-specific shell initialization scripts that:
//! - Set up the ELF_WORK_DIR environment variable
//! - Override the `cd` command to intercept `cd ~` and redirect to the workspace

use std::path::Path;

/// Generate shell initialization script.
///
/// Overrides the `cd` command to intercept when the user's home directory
/// is passed (after shell expansion of `~`) and redirects to the .elf workspace.
///
/// # Arguments
/// * `work_dir` - The .elf temporary workspace directory
/// * `shell` - The shell type: "bash", "zsh", or "powershell"
///
/// # Returns
/// * `Ok(String)` - The initialization script (empty for PowerShell which uses profile)
/// * `Err(String)` - Error for unsupported shell types
///
/// # Example
/// ```ignore
/// let script = generate_shell_init(Path::new("/tmp/workspace"), "bash")?;
/// // Script sets up cd ~ to redirect to /tmp/workspace
/// ```
pub fn generate_shell_init(work_dir: &Path, shell: &str) -> Result<String, String> {
    let work_dir_str = work_dir
        .to_str()
        .ok_or("Failed to convert work directory path to string")?;

    match shell {
        "bash" | "zsh" => Ok(format!(
            r#"clear
export ELF_WORK_DIR="{}"
cd() {{
    # Check if path equals user's home directory (shell expands ~ to $HOME)
    if [ "$1" = "$HOME" ] || [ "$1" = "~" ]; then
        builtin cd "$ELF_WORK_DIR"
    elif [ -z "$1" ]; then
        builtin cd "$HOME"
    else
        builtin cd "$@"
    fi
}}
"#,
            work_dir_str
        )),
        // PowerShell uses a separate profile script mechanism
        // The initialization is handled in terminal_init.rs
        "powershell" => Ok(String::new()),
        _ => Err(format!("Unsupported shell: {}", shell)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_bash_init_script_generation() {
        let work_dir = PathBuf::from("/tmp/test-elf-workspace");
        let script = generate_shell_init(&work_dir, "bash");
        assert!(script.is_ok(), "Should generate bash script");

        let script = script.unwrap();
        assert!(
            script.contains("export ELF_WORK_DIR="),
            "Script should export ELF_WORK_DIR"
        );
        assert!(
            script.contains("/tmp/test-elf-workspace"),
            "Script should contain the work directory path"
        );
        assert!(
            script.contains("cd()"),
            "Script should define cd function override"
        );
        assert!(
            script.contains("builtin cd"),
            "Script should use builtin cd"
        );
        assert!(script.contains("clear"), "Script should clear the screen");
    }

    #[test]
    fn test_zsh_init_script_generation() {
        let work_dir = PathBuf::from("/home/user/.elf-workspace");
        let script = generate_shell_init(&work_dir, "zsh");
        assert!(script.is_ok(), "Should generate zsh script");

        let script = script.unwrap();
        assert!(script.contains("clear"));
        assert!(script.contains("export ELF_WORK_DIR="));
        assert!(script.contains("/home/user/.elf-workspace"));
        assert!(script.contains("cd()"));
    }

    #[test]
    fn test_powershell_returns_empty() {
        let work_dir = PathBuf::from("C:\\Users\\test\\.elf-workspace");
        let script = generate_shell_init(&work_dir, "powershell");
        assert!(script.is_ok(), "Should handle PowerShell");
        assert_eq!(
            script.unwrap(),
            "",
            "PowerShell should return empty string (uses profile instead)"
        );
    }

    #[test]
    fn test_unsupported_shell() {
        let work_dir = PathBuf::from("/tmp/test");
        let result = generate_shell_init(&work_dir, "fish");
        assert!(result.is_err(), "Should reject unsupported shell");
        assert!(result.unwrap_err().contains("Unsupported shell"));
    }

    #[test]
    fn test_path_with_special_characters() {
        let work_dir = PathBuf::from("/tmp/elfiee workspace/test-123");
        let script = generate_shell_init(&work_dir, "bash");
        assert!(script.is_ok(), "Should handle paths with spaces");
        assert!(script.unwrap().contains("/tmp/elfiee workspace/test-123"));
    }

    #[test]
    fn test_bash_script_cd_home_logic() {
        let work_dir = PathBuf::from("/tmp/elfiee-workspace");
        let script = generate_shell_init(&work_dir, "bash").unwrap();

        assert!(
            script.contains(r#"if [ "$1" = "$HOME" ] || [ "$1" = "~" ]"#),
            "Script should check for both $HOME and ~"
        );
        assert!(
            script.contains(r#"builtin cd "$ELF_WORK_DIR""#),
            "Script should redirect to ELF_WORK_DIR"
        );
    }
}
