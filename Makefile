# Elfiee Project Makefile
# 提供开发、测试、清理和格式化命令

.PHONY: dev test-backend test-frontend test clean fmt help

# 默认目标
.DEFAULT_GOAL := help

# 开发命令
dev:
	@echo "🚀 启动开发服务器..."
	pnpm tauri dev

# 后端测试
test-backend:
	@echo "🦀 运行 Rust 测试..."
	cd src-tauri && cargo test

# 前端测试
test-frontend:
	@echo "⚛️ 运行前端测试..."
	pnpm test

# 运行所有测试
test: test-backend test-frontend
	@echo "✅ 所有测试完成"

# 清理构建产物
clean:
	@echo "🧹 清理构建产物..."
	rm -rf src-tauri/target/
	rm -rf dist/
	rm -rf .vite/
	rm -rf coverage/
	@echo "✅ 清理完成"

# 格式化代码
fmt:
	@echo "🎨 格式化代码..."
	cd src-tauri && cargo fmt --all
	pnpm format
	@echo "✅ 格式化完成"

# 显示帮助信息
help:
	@echo "Elfiee 项目 Makefile 命令："
	@echo ""
	@echo "  dev           - 启动开发服务器 (pnpm tauri dev)"
	@echo "  test-backend  - 运行 Rust 后端测试"
	@echo "  test-frontend - 运行前端测试"
	@echo "  test          - 运行所有测试"
	@echo "  clean         - 清理所有构建产物"
	@echo "  fmt           - 格式化所有代码"
	@echo "  help          - 显示此帮助信息"
	@echo ""
	@echo "示例用法："
	@echo "  make dev      # 启动开发"
	@echo "  make test     # 运行所有测试"
	@echo "  make clean    # 清理项目"
