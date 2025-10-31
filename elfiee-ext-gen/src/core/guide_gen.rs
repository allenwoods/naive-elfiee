/// Intelligent guide generator based on test analysis.
///
/// Following generator-dev-plan.md Phase 2.3 (line 650-742)

use crate::core::analyzer::{AnalysisReport, TestAnalyzer};
use serde::Deserialize;
use std::process::Command;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

// ============================================================================
// Data Structures
// ============================================================================

/// Guide generator for creating development instructions.
pub struct GuideGenerator {
    analyzer: TestAnalyzer,
    next_steps: HashMap<String, NextStepRule>,
}

#[derive(Debug, Deserialize, Clone)]
struct NextStepRule {
    #[serde(default)]
    priority: usize,
    message: String,
}

impl GuideGenerator {
    /// Create a new GuideGenerator.
    ///
    /// # Arguments
    /// * `analyzer` - TestAnalyzer instance for analyzing test output
    ///
    /// # Examples
    /// ```no_run
    /// use elfiee_ext_gen::core::analyzer::TestAnalyzer;
    /// use elfiee_ext_gen::core::guide_gen::GuideGenerator;
    ///
    /// let analyzer = TestAnalyzer::new().unwrap();
    /// let guide_gen = GuideGenerator::new(analyzer);
    /// ```
    pub fn new(analyzer: TestAnalyzer) -> Self {
        let next_steps = Self::load_next_steps().unwrap_or_default();
        Self {
            analyzer,
            next_steps,
        }
    }

    /// Generate development guide for an extension.
    ///
    /// # Arguments
    /// * `extension_name` - Name of the extension to analyze
    ///
    /// # Returns
    /// * `Ok(String)` - Formatted guide with test results and suggestions
    /// * `Err(String)` - Error message if tests cannot be run
    pub fn generate_guide(&self, extension_name: &str) -> Result<String, String> {
        // Run tests and capture output
        let test_output = self.run_tests(extension_name)?;

        // Analyze test results
        let report = self.analyzer.analyze(&test_output);

        // Format the report
        let formatted = self.format_report(&report);

        Ok(formatted)
    }

    /// Run tests and capture output.
    ///
    /// # Arguments
    /// * `extension_name` - Extension name for test filtering
    ///
    /// # Returns
    /// * `Ok(String)` - Test output
    /// * `Err(String)` - Error if command fails
    fn run_tests(&self, extension_name: &str) -> Result<String, String> {
        // Execute cargo test for the extension
        let output = Command::new("cargo")
            .arg("test")
            .arg(format!("{}::tests", extension_name))
            .arg("--")
            .arg("--nocapture")
            .current_dir("src-tauri")
            .output()
            .map_err(|e| format!("Failed to execute cargo test: {}", e))?;

        // Combine stdout and stderr
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);

        Ok(format!("{}\n{}", stdout, stderr))
    }

    /// Format analysis report as human-readable text.
    ///
    /// # Arguments
    /// * `report` - AnalysisReport from TestAnalyzer
    ///
    /// # Returns
    /// * Formatted string with test results and suggestions
    fn format_report(&self, report: &AnalysisReport) -> String {
        let mut output = String::new();

        // Progress section
        let progress = self.format_progress(report.passing, report.total_tests);
        output.push_str(&format!("📊 Test Status: {}\n\n", progress));

        // Failures section
        if !report.failing.is_empty() {
            output.push_str("🔴 Failures:\n");
            for failure in &report.failing {
                output.push_str(&format!("\n  Test: {}\n", failure.test_name));

                if let Some(loc) = &failure.file_location {
                    output.push_str(&format!("  Location: {}:{}\n", loc.file, loc.line));
                }

                if let Some(pattern) = &failure.matched_pattern {
                    output.push_str(&format!("  Category: {}\n", pattern.category));
                    output.push_str(&format!("  Hint: {}\n", pattern.hint));
                    if let Some(rule) = self.next_steps.get(&pattern.category) {
                        output.push_str(&format!("  Next step: {}\n", rule.message));
                    }
                }
            }
            output.push_str("\n");
        }

        // Estimated time
        let minutes = report.estimated_time.as_secs() / 60;
        output.push_str(&format!("⏱️  Estimated time: {} minutes\n", minutes));

        output
    }

    fn load_next_steps() -> Result<HashMap<String, NextStepRule>, String> {
        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));

        if let Ok(cwd) = std::env::current_dir() {
            let path = cwd.join("rules/next_steps.yaml");
            if path.exists() {
                return Self::read_next_steps(&path);
            }
        }

        let manifest_path = manifest_dir.join("rules/next_steps.yaml");
        if manifest_path.exists() {
            return Self::read_next_steps(&manifest_path);
        }

        Ok(HashMap::new())
    }

    fn read_next_steps(path: &Path) -> Result<HashMap<String, NextStepRule>, String> {
        #[derive(Deserialize)]
        struct NextSteps {
            steps: HashMap<String, NextStepRule>,
        }

        let content = std::fs::read_to_string(path)
            .map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;
        let parsed: NextSteps = serde_yaml::from_str(&content)
            .map_err(|e| format!("Failed to parse next_steps.yaml: {}", e))?;
        Ok(parsed.steps)
    }

    /// Generate progress bar string.
    ///
    /// # Arguments
    /// * `passing` - Number of passing tests
    /// * `total` - Total number of tests
    ///
    /// # Returns
    /// * Progress string like "30% (3/10)"
    fn format_progress(&self, passing: usize, total: usize) -> String {
        let percentage = if total > 0 {
            (passing as f64 / total as f64 * 100.0) as usize
        } else {
            0
        };

        format!("{}% ({}/{})", percentage, passing, total)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::analyzer::{ErrorPattern, FileLocation, TestFailure};
    use std::time::Duration;

    // ========================================
    // Test: format_progress()
    // (Following dev-plan.md line 687-694)
    // ========================================

    #[test]
    fn test_format_progress() {
        let analyzer = TestAnalyzer::new().unwrap();
        let guide_gen = GuideGenerator::new(analyzer);

        let progress = guide_gen.format_progress(3, 10);
        assert!(progress.contains("30%"));
        assert!(progress.contains("3/10"));
    }

    // ========================================
    // Test: format_report()
    // (Following dev-plan.md line 696-729)
    // ========================================

    #[test]
    fn test_format_report_with_failures() {
        let analyzer = TestAnalyzer::new().unwrap();
        let guide_gen = GuideGenerator::new(analyzer);

        let report = AnalysisReport {
            total_tests: 10,
            passing: 7,
            failing: vec![
                TestFailure {
                    test_name: "test_add_item".to_string(),
                    error_message: "todo!()".to_string(),
                    file_location: Some(FileLocation {
                        file: "todo_add.rs".to_string(),
                        line: 15,
                    }),
                    matched_pattern: Some(ErrorPattern {
                        pattern: "todo".to_string(),
                        category: "todo_marker".to_string(),
                        hint: "Implement the function".to_string(),
                    }),
                },
            ],
            critical_path: vec![],
            estimated_time: Duration::from_secs(900),
        };

        let formatted = guide_gen.format_report(&report);

        assert!(formatted.contains("7/10"));
        assert!(formatted.contains("test_add_item"));
        assert!(formatted.contains("todo_add.rs:15"));
        assert!(formatted.contains("Implement the function"));
        assert!(
            formatted.contains("Replace the todo!() marker"),
            "Formatted guide should include next-step suggestion from rules/next_steps.yaml"
        );
    }

    // ========================================
    // Test: run_tests()
    // (Following dev-plan.md line 731-741)
    // ========================================

    #[test]
    #[ignore] // Integration test - requires actual cargo environment
    fn test_run_tests() {
        // This test executes actual `cargo test` command which requires:
        // 1. src-tauri/ directory with valid Cargo.toml
        // 2. Compiled Rust code with tests
        // 3. Extension code at src-tauri/src/extensions/<name>/
        //
        // This is an integration test and should not run in unit test suite.
        //
        // Manual testing:
        // 1. Run from elfiee project root: cd /path/to/elfiee
        // 2. Ensure extension exists: ls src-tauri/src/extensions/markdown/
        // 3. Test: cargo test markdown::tests -- --nocapture
        // 4. Verify guide_gen.run_tests("markdown") captures the output

        let analyzer = TestAnalyzer::new().unwrap();
        let guide_gen = GuideGenerator::new(analyzer);

        // This will only work in actual elfiee project environment with markdown extension
        let result = guide_gen.run_tests("markdown");

        // Test expectations depend on environment:
        // - From generator directory: cargo runs but finds no tests (0 tests, 61 filtered out)
        // - From elfiee root: should find and run actual markdown tests

        if result.is_ok() {
            let output = result.unwrap();
            // Check if we actually ran real tests or just got empty output
            if output.contains("0 passed") && output.contains("filtered out") {
                eprintln!("⚠️  Ran in wrong directory - no real tests found");
                eprintln!("   This test needs to run from elfiee project root");
                panic!("Test must be run from elfiee project root with markdown extension");
            } else {
                eprintln!("✅ Successfully captured test output: {} bytes", output.len());
                assert!(output.contains("running"), "Output should show test execution");
            }
        } else {
            eprintln!("❌ Failed to run cargo test: {}", result.unwrap_err());
            panic!("cargo test command failed");
        }
    }
}
