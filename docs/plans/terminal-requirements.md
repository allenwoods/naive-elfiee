当然！我将为您整理一份详细、结构化的需求文档（Technical Specification / PRD）。这份文档将明确定义项目架构、技术栈、功能要求及验收标准，确保任何 AI 或开发人员都能理解并按要求实现一个高质量的终端工具。

-----

# 📝 技术需求文档：Tauri 高保真终端模拟器

## 🚀 一、项目概览 (Overview)

| 属性 | 详情 |
| :--- | :--- |
| **项目名称** | Tauri 集成终端 (Tauri Integrated Terminal) |
| **目标** | 在 Tauri 应用的前端 (WebView) 中，使用 xterm.js 渲染一个与系统 Shell 保持持久、双向通信的高性能终端。 |
| **设计参考** | **VS Code (Visual Studio Code) 终端架构**。核心在于将渲染层与 PTY (Pseudo-Terminal) 逻辑分离。 |
| **技术栈 (Mandatory)** | **前端：** xterm.js, TypeScript/JavaScript。**后端：** Rust, Tauri, portable-pty。 |

## 📐 二、高层架构 (High-Level Architecture)

本项目采用**客户端-主机**分离架构，通过 Tauri 的 IPC 机制实现低延迟的数据交换。

### 1\. 架构分层

| 层级 | 技术栈 | 职责 |
| :--- | :--- | :--- |
| **渲染层 (Frontend)** | xterm.js, FitAddon, WebGLAddon | 接收用户输入，渲染来自后端的终端输出。不执行任何系统命令。 |
| **通信层 (IPC)** | Tauri Commands (`invoke`), Tauri Events (`emit`) | 双向数据传输的桥梁。 |
| **PTY 主机层 (Backend)** | Rust, `portable-pty` | 创建、管理 PTY 会话，启动系统 Shell（bash/cmd/PowerShell），并处理 I/O 读写和窗口大小调整。 |

### 2\. 数据流与格式规范

所有数据流必须遵循以下规范，以确保性能和二进制安全：

| 流向 | 触发事件 | 传输格式 | 关键处理 |
| :--- | :--- | :--- | :--- |
| **输入 (Input)** | Frontend `term.onData()` | UTF-8 String | 后端 Rust 负责将字符串直接写入 PTY Writer。 |
| **输出 (Output)** | Backend Reader Thread | **Base64 编码的 String** | **强制要求：** Rust 端读取字节流后，必须进行 Base64 编码，再通过 Tauri Event 传输。Frontend 接收后必须解码 Base64。此举是为了确保二进制数据（如颜色代码、非UTF-8序列）传输的完整性。 |
| **尺寸 (Resize)** | Frontend `FitAddon` | JSON Object `{ rows: u16, cols: u16 }` | 必须精确同步，前端计算行列数，后端更新 PTY 的尺寸。 |

## ✅ 三、功能性要求 (Functional Requirements)

| ID | 要求描述 | 详细说明 |
| :--- | :--- | :--- |
| **F1** | **会话持久性** | PTY 主机层启动后，必须保持 Shell 进程运行，直到应用退出或会话被主动关闭。 |
| **F2** | **输入处理** | 捕获 xterm.js 中的所有键盘输入（包括特殊键如 Tab, Ctrl+C, Arrow Keys），并通过 Tauri Command 发送到 PTY Writer。 |
| **F3** | **低延迟输出** | 终端输出必须能以极低的延迟显示在 xterm.js 界面上。必须能够正确渲染颜色、粗体、下划线以及光标移动（由 Shell 输出的 ANSI/VT100 序列控制）。 |
| **F4** | **Shell 兼容性** | 自动识别并启动系统默认 Shell：<br>- **Linux/macOS:** `bash` 或 `zsh`<br>- **Windows:** `powershell` 或 `cmd` |
| **F5** | **窗口尺寸自适应** | 当 WebView 窗口容器尺寸变化时，前端必须通知后端，并调用 PTY 接口调整 Shell 进程的窗口大小，以正确处理 **SIGWINCH** 信号（核心功能）。 |

## 🛠️ 四、技术要求 (Technical Requirements)

| ID | 要求描述 | 详细说明 |
| :--- | :--- | :--- |
| **T1** | **Rust PTY 库** | 必须使用 `portable-pty` 库来创建和管理 PTY master/slave pair。 |
| **T2** | **终端状态管理** | Rust 后端必须维护一个线程安全的结构体（例如 `Arc<Mutex<TerminalSession>>`）来保存 PTY Writer 和 Master 的引用，以供多个 Tauri Command 访问。 |
| **T3** | **并发读取** | 必须在 Rust 后端为 PTY Master Reader 启动一个**独立的、阻塞式线程**，持续轮询读取 Shell 输出。此线程是 `pty-out` Tauri Event 的唯一生产者。 |
| **T4** | **环境变量设置** | 在启动 Shell 进程时，必须设置 `TERM` 环境变量，推荐设置为 `xterm-256color`，以确保 Vim, Top 等 TUI (Text-based User Interface) 应用程序能正常工作。 |
| **T5** | **前端插件** | 必须使用 `FitAddon` 来计算准确的终端行列数，并**推荐**使用 `WebglAddon` 提升渲染性能。 |
| **T6** | **资源清理** | 当应用关闭或终端会话结束时，Rust 后端必须确保 PTY 进程被正确终止，释放系统资源。 |

## 🧭 五、实施步骤指引 (Implementation Steps)

实现者应遵循以下步骤构建核心功能：

1.  **Rust 依赖配置：** 在 `Cargo.toml` 中添加 `portable-pty` 和 `base64`。
2.  **定义状态：** 定义 `TerminalSession` 结构体，包含 PTY writer 和 Master 引用。
3.  **初始化命令：** 创建 Tauri Command `async_init_terminal`，负责：
      * 创建 `NativePtySystem`。
      * 创建 PTY Pair，并根据 OS 启动对应的 Shell。
      * 启动 Reader Thread (T3)。
      * 将 Session 保存到 Tauri State (T2)。
4.  **数据输入命令：** 创建 Tauri Command `write_to_pty(data: String)`，负责将数据写入 PTY Writer。
5.  **尺寸同步命令：** 创建 Tauri Command `resize_pty(rows: u16, cols: u16)`，负责调用 PTY Master 的 `resize` 方法。
6.  **前端设置：** 在前端组件中：
      * 初始化 `xterm.js` 并加载 `FitAddon` 和 `WebglAddon`。
      * 调用 `async_init_terminal`。
      * 绑定 `term.onData` 到 `write_to_pty` Command。
      * 监听 `pty-out` Event，并进行 **Base64 解码**后，调用 `term.write()`。
      * 使用 `ResizeObserver` 监听容器大小变化，并调用 `resize_pty` Command。

## ✅ 六、验收标准 (Acceptance Criteria)

功能必须通过以下测试才能被接受：

1.  **基础I/O测试：** 在终端输入 `echo Hello World`，终端必须正确显示输出，且颜色正确。
2.  **交互性测试：** 运行 `vim` 或 `htop`，并能通过键盘（如方向键）正常操作这些程序。
3.  **核心功能测试 (Resizing)：** 运行 `vim` 或 `top` 后，拖动应用窗口或终端分割线，终端内容必须无形变、无乱码地自动重排。
4.  **跨平台测试：** 在 Windows (PowerShell/CMD) 和 Linux/macOS (Bash/Zsh) 上，功能和性能表现必须一致。
5.  **稳定性测试：** 连续执行 `ls -laR /` 等大量输出的命令，前端 UI 必须保持流畅，无明显卡顿或内存泄漏。