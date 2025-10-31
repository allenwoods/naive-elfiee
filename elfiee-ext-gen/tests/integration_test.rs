use assert_cmd::Command;
use predicates::prelude::*;
use std::fs;
use std::path::Path;
use tempfile::TempDir;

fn copy_dir_recursive(src: &Path, dst: &Path) {
    for entry in walkdir::WalkDir::new(src) {
        let entry = entry.unwrap();
        let path = entry.path();
        let relative = path.strip_prefix(src).unwrap();
        let target = dst.join(relative);

        if path.is_dir() {
            fs::create_dir_all(&target).unwrap();
        } else {
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent).unwrap();
            }
            fs::copy(path, target).unwrap();
        }
    }
}

fn prepare_elfiee_workspace(root: &Path) {
    fs::create_dir_all(root.join("src-tauri/src/extensions")).unwrap();
    fs::create_dir_all(root.join("src-tauri/src/capabilities")).unwrap();

    fs::write(root.join("src-tauri/src/extensions/mod.rs"), "\n").unwrap();
    fs::write(
        root.join("src-tauri/src/capabilities/registry.rs"),
        "use std::sync::Arc;\n\npub struct CapabilityRegistry;\nimpl CapabilityRegistry {\n    fn register_extensions(&mut self) {}\n    fn register<T>(&mut self, _cap: Arc<T>) {}\n}\n",
    )
    .unwrap();
    fs::write(
        root.join("src-tauri/src/lib.rs"),
        "#[cfg(debug_assertions)]\nfn register_types(builder: &mut Vec<String>) {}\n",
    )
    .unwrap();

    let repo_root = Path::new(env!("CARGO_MANIFEST_DIR"));
    copy_dir_recursive(&repo_root.join("templates"), &root.join("templates"));
    copy_dir_recursive(&repo_root.join("rules"), &root.join("rules"));
}

#[test]
fn test_full_lifecycle_directory_extension() {
    let temp = TempDir::new().unwrap();
    let project_root = temp.path();
    prepare_elfiee_workspace(project_root);

    let mut cmd = Command::cargo_bin("elfiee-ext-gen").unwrap();
    cmd.current_dir(project_root)
        .arg("create")
        .arg("--name")
        .arg("directory_inspector")
        .arg("--block-type")
        .arg("directory")
        .arg("--capabilities")
        .arg("scan,trust");

    cmd.assert()
        .success()
        .stdout(predicate::str::contains("Created extensions/directory_inspector/"));
}
