/// Naming convention conversion utilities for Extension generation.
///
/// These functions handle conversion between different naming conventions:
/// - snake_case (Rust variables, file names)
/// - PascalCase (Rust types, struct names)
/// - camelCase (JavaScript/TypeScript)

/// Convert a string to snake_case.
///
/// # Examples
/// ```
/// use elfiee_ext_gen::utils::naming::to_snake_case;
///
/// assert_eq!(to_snake_case("TodoAddItem"), "todo_add_item");
/// assert_eq!(to_snake_case("HTTPRequest"), "http_request");
/// assert_eq!(to_snake_case("already_snake"), "already_snake");
/// ```
pub fn to_snake_case(s: &str) -> String {
    todo!("Implement to_snake_case")
}

/// Convert a string to PascalCase.
///
/// # Examples
/// ```
/// use elfiee_ext_gen::utils::naming::to_pascal_case;
///
/// assert_eq!(to_pascal_case("todo_add_item"), "TodoAddItem");
/// assert_eq!(to_pascal_case("http_request"), "HttpRequest");
/// assert_eq!(to_pascal_case("AlreadyPascal"), "AlreadyPascal");
/// ```
pub fn to_pascal_case(s: &str) -> String {
    todo!("Implement to_pascal_case")
}

/// Convert a string to camelCase.
///
/// # Examples
/// ```
/// use elfiee_ext_gen::utils::naming::to_camel_case;
///
/// assert_eq!(to_camel_case("todo_add_item"), "todoAddItem");
/// assert_eq!(to_camel_case("http_request"), "httpRequest");
/// ```
pub fn to_camel_case(s: &str) -> String {
    todo!("Implement to_camel_case")
}

/// Convert a capability ID to a Capability struct name.
///
/// # Examples
/// ```
/// use elfiee_ext_gen::utils::naming::capability_to_struct_name;
///
/// assert_eq!(
///     capability_to_struct_name("todo.add_item"),
///     "TodoAddItemCapability"
/// );
/// assert_eq!(
///     capability_to_struct_name("markdown.write"),
///     "MarkdownWriteCapability"
/// );
/// ```
pub fn capability_to_struct_name(cap_id: &str) -> String {
    todo!("Implement capability_to_struct_name")
}

#[cfg(test)]
mod tests {
    use super::*;

    // ========================================
    // Tests for to_snake_case
    // ========================================

    #[test]
    fn test_to_snake_case_from_pascal() {
        assert_eq!(to_snake_case("TodoAddItem"), "todo_add_item");
    }

    #[test]
    fn test_to_snake_case_consecutive_caps() {
        assert_eq!(to_snake_case("HTTPRequest"), "http_request");
        assert_eq!(to_snake_case("XMLParser"), "xml_parser");
    }

    #[test]
    fn test_to_snake_case_already_snake() {
        assert_eq!(to_snake_case("already_snake"), "already_snake");
    }

    #[test]
    fn test_to_snake_case_mixed() {
        assert_eq!(to_snake_case("getHTTPResponse"), "get_http_response");
    }

    #[test]
    fn test_to_snake_case_numbers() {
        assert_eq!(to_snake_case("Base64Encoder"), "base64_encoder");
    }

    // ========================================
    // Tests for to_pascal_case
    // ========================================

    #[test]
    fn test_to_pascal_case_from_snake() {
        assert_eq!(to_pascal_case("todo_add_item"), "TodoAddItem");
    }

    #[test]
    fn test_to_pascal_case_from_kebab() {
        assert_eq!(to_pascal_case("todo-add-item"), "TodoAddItem");
    }

    #[test]
    fn test_to_pascal_case_already_pascal() {
        assert_eq!(to_pascal_case("AlreadyPascal"), "AlreadyPascal");
    }

    #[test]
    fn test_to_pascal_case_with_numbers() {
        assert_eq!(to_pascal_case("base64_encoder"), "Base64Encoder");
    }

    #[test]
    fn test_to_pascal_case_single_word() {
        assert_eq!(to_pascal_case("http"), "Http");
    }

    // ========================================
    // Tests for to_camel_case
    // ========================================

    #[test]
    fn test_to_camel_case_from_snake() {
        assert_eq!(to_camel_case("todo_add_item"), "todoAddItem");
    }

    #[test]
    fn test_to_camel_case_from_pascal() {
        assert_eq!(to_camel_case("TodoAddItem"), "todoAddItem");
    }

    #[test]
    fn test_to_camel_case_single_word() {
        assert_eq!(to_camel_case("http"), "http");
    }

    // ========================================
    // Tests for capability_to_struct_name
    // ========================================

    #[test]
    fn test_capability_to_struct_name_simple() {
        assert_eq!(
            capability_to_struct_name("todo.add_item"),
            "TodoAddItemCapability"
        );
    }

    #[test]
    fn test_capability_to_struct_name_single_word() {
        assert_eq!(
            capability_to_struct_name("markdown.write"),
            "MarkdownWriteCapability"
        );
    }

    #[test]
    fn test_capability_to_struct_name_multiple_words() {
        assert_eq!(
            capability_to_struct_name("diagram.render_svg"),
            "DiagramRenderSvgCapability"
        );
    }

    #[test]
    fn test_capability_to_struct_name_core() {
        assert_eq!(
            capability_to_struct_name("core.create"),
            "CoreCreateCapability"
        );
    }
}
