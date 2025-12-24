# Timeline 功能开发计划

## 概述
实现 Timeline 功能，允许用户查看文档的变更历史（事件），并将文档内容“还原”到特定的历史时刻。

## 用户流程
1.  **编辑**：用户编辑文档（Markdown）。
2.  **保存**：用户保存，触发 `markdown.write` 事件。
3.  **时间线**：用户打开 Context Panel -> Timeline 标签页。
4.  **查看**：用户看到事件列表（例如，“Alice 创建了 block”，“Bob 修改了内容”）。
5.  **还原**：用户点击旧事件上的“还原”按钮。
6.  **预览**：编辑器更新显示该时刻的内容。
7.  **提交**：如果用户现在保存，将创建一个包含该内容的新 `markdown.write` 事件（有效地永久还原了内容）。

## 技术实现步骤

### 第一阶段：后端 (Rust)
**目标**：支持通过重放事件检索历史内容。

1.  **创建 `src-tauri/src/commands/event.rs`**：
    *   实现 `get_block_content_at_event(file_id, block_id, event_id) -> Result<String, String>`。
    *   逻辑：
        *   获取文件的所有事件。
        *   找到目标 `event_id` 的索引。
        *   初始化一个新的 `StateProjector`。
        *   重放从索引 0 到 `target_index` 的事件。
        *   提取 `blocks[block_id].contents["markdown"]`。
    *   在 `src-tauri/src/commands/mod.rs` 中导出 `event` 模块。
    *   在 `src-tauri/src/lib.rs` 中注册命令。

### 第二阶段：前端核心 (TypeScript)
**目标**：向 UI 暴露新的后端能力。

1.  **更新 `src/lib/tauri-client.ts`**：
    *   添加 `EventOperations` 类。
    *   方法 `getAllEvents(fileId)`（包装现有命令）。
    *   方法 `getBlockContentAtEvent(fileId, blockId, eventId)`。
    *   方法 `sortEventsByVectorClock(events)`。
    *   方法 `parseEvent(event)` -> 返回可读的 `{ operator, action, content }`。

2.  **更新 `src/lib/app-store.ts`**：
    *   添加 `loadEvents(fileId)`。
    *   添加 `restoreToEvent(fileId, blockId, eventId)`：
        *   调用 `TauriClient`。
        *   在 store 中更新特定 block 的内容（这将更新编辑器视图）。
        *   管理“还原模式”状态（如果我们要显示横幅，可选但体验更好）。

### 第三阶段：前端 UI (React)
**目标**：Timeline 的用户界面。

1.  **修改 `src/components/editor/ContextPanel.tsx`**：
    *   增强 `TimelineTab`。
    *   使用 `EventList` 组件（将现有列表重构为组件）。
    *   显示“操作人”、“动作”、“时间”。
    *   为每个项目添加“还原”按钮。

2.  **创建 `src/components/event/EventItem.tsx`（可选/内联）**：
    *   渲染单个事件。
    *   处理“还原”点击。

3.  **更新 `src/components/editor/EditorCanvas.tsx`**：
    *   确保它响应 store 中 block 内容的更新（应该已经通过 `useAppStore` 实现了）。

### 验证计划
1.  **单元测试 (后端)**：通过创建一系列事件并断言返回的内容与该步骤的预期状态匹配来测试 `get_block_content_at_event`。
2.  **手动测试 (前端)**：
    *   对文档进行 3 次编辑。
    *   检查 Timeline 显示 3 个事件。
    *   点击第 1 个的还原。编辑器应显示内容 #1。
    *   点击保存。Timeline 显示 4 个事件。内容是 #1。

## 备注
*   **向量时钟**：使用 `timestamp` 映射进行排序（例如，计数器总和或比较逻辑）。
*   **事件解析**：
    *   `core.create` -> "创建了文档"
    *   `markdown.write` -> "修改了内容"
    *   `core.rename` -> "重命名了文档"
