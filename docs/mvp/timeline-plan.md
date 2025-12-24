# Timeline 功能开发计划

## 文档信息

- **功能模块**: Timeline（时间线）
- **文档版本**: 1.0
- **最后更新**: 2025-12-24
- **状态**: 待开发

---

## 功能概述

实现 ContextPanel 中的 Timeline 功能，展示文档的操作历史记录，并支持回溯到历史版本。

### 用户流程

#### 前置流程
1. 在 Dashboard 中以 system-id 身份创建 elf 文件
2. 选择文件，进入项目编辑页面 `DocumentEditor.tsx`
3. 以 system 身份创建 block

#### 核心流程
1. **创建文件记录**: 创建 block 后，在 event 中记录 "xxx 创建了 xxx 文件"
2. **重命名记录**: 重命名 block.name 时，在 event 中记录 "xxx 修改了文件名称"
3. **编辑内容**: 在 `EditorCanvas` 中编辑文档内容
4. **保存记录**: 点击 save 按钮时，在 event 中记录 "xxx 修改了文件内容"，同时保存当前 block 内容快照
5. **Timeline 显示**: 在 `ContextPanel` 的 Timeline tab 中以时间线形式显示操作记录（最新在上）
6. **Restore 功能**: 每条记录后有 restore 按钮，点击后直接替换编辑器内容为该时间点的内容，用户可继续编辑
7. **Restore 后保存**: 在某个时间点还原后，如果再次保存，会在 event 中新增一条记录

#### 重要规则
- ✅ Event 记录永久保存，不会被删除
- ✅ 操作人员根据当前 active editor 身份记录
- ✅ Timeline 排序：最新事件在上方，最早事件在下方
- ✅ 点击 restore 的操作**不**记录到 event
- ✅ Grants（权限）通过单独的 `core.grant` 和 `core.revoke` 事件记录，回溯时通过事件重放重建权限状态

---

## 技术架构

### Event 数据结构

```typescript
export type Event = {
  event_id: string                    // 事件唯一标识
  entity: string                      // 实体 ID（通常是 block_id）
  attribute: string                   // 格式："{editor_id}/{cap_id}"
  value: JsonValue                    // 事件负载（动态 JSON）
  timestamp: Record<string, number>   // 向量时钟
}
```

### Event 类型示例

#### 1. 创建文件（core.create）
```json
{
  "event_id": "uuid-123",
  "entity": "block-uuid-456",
  "attribute": "system/core.create",
  "value": {
    "name": "新文档",
    "block_type": "markdown"
  },
  "timestamp": { "system": 1 }
}
```

#### 2. 修改内容（markdown.write）
```json
{
  "event_id": "uuid-789",
  "entity": "block-uuid-456",
  "attribute": "system/markdown.write",
  "value": {
    "content": "# 标题\n\n这是内容..."
  },
  "timestamp": { "system": 2 }
}
```

#### 3. 授权权限（core.grant）
```json
{
  "event_id": "uuid-abc",
  "entity": "block-uuid-456",
  "attribute": "system/core.grant",
  "value": {
    "target_editor": "alice",
    "capability": "markdown.write",
    "target_block": "block-uuid-456"
  },
  "timestamp": { "system": 3 }
}
```

### 向量时钟排序

向量时钟用于解决分布式环境下的事件顺序问题。比较规则：

```typescript
function compareVectorClocks(
  vc1: Record<string, number>,
  vc2: Record<string, number>
): number {
  // 1. 获取所有 editor_id
  const allEditors = new Set([...Object.keys(vc1), ...Object.keys(vc2)])

  // 2. 比较每个 editor 的时钟值
  let vc1Greater = false
  let vc2Greater = false

  for (const editor of allEditors) {
    const v1 = vc1[editor] || 0
    const v2 = vc2[editor] || 0

    if (v1 > v2) vc1Greater = true
    if (v2 > v1) vc2Greater = true
  }

  // 3. 返回结果
  if (vc1Greater && !vc2Greater) return 1   // vc1 > vc2
  if (vc2Greater && !vc1Greater) return -1  // vc1 < vc2
  return 0  // 并发或相等
}
```

---

## 开发任务清单

### 后端开发（Rust）

#### 任务 1: 检查现有 Event 记录机制
**文件**: `src-tauri/src/commands/file.rs`, `src-tauri/src/commands/block.rs`

- [ ] 确认 `core.create` 事件是否正确记录（创建文件）
- [ ] 确认 `markdown.write` 事件是否正确记录（修改内容）
- [ ] 检查是否需要新增 Block 重命名能力（如 `core.rename`）

**验证方法**:
```bash
# 运行后端测试
cd src-tauri
cargo test event_recording
```

#### 任务 2: 实现事件回溯命令
**文件**: `src-tauri/src/commands/event.rs` (新建)

**功能**: 回溯到指定 event 时刻的 block 内容

```rust
#[tauri::command]
#[specta::specta]
pub async fn get_block_content_at_event(
    state: tauri::State<'_, AppState>,
    file_id: String,
    block_id: String,
    event_id: String,
) -> Result<String, String> {
    let engines = state.engines.lock().await;
    let handle = engines.get(&file_id).ok_or("File not found")?;

    // 1. 获取所有事件
    let all_events = handle.get_all_events().await?;

    // 2. 找到目标事件的索引
    let target_index = all_events
        .iter()
        .position(|e| e.event_id == event_id)
        .ok_or("Event not found")?;

    // 3. 重放事件到目标点
    let mut temp_projector = StateProjector::new();
    for event in &all_events[..=target_index] {
        temp_projector.apply_event(event);
    }

    // 4. 提取 Block 的内容
    let block = temp_projector.blocks.get(&block_id)
        .ok_or("Block not found at that event")?;

    let markdown = block.contents.get("markdown")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    Ok(markdown)
}
```

**步骤**:
- [ ] 创建 `src-tauri/src/commands/event.rs`
- [ ] 实现 `get_block_content_at_event` 命令
- [ ] 在 `src-tauri/src/commands/mod.rs` 中导出
- [ ] 在 `src-tauri/src/lib.rs` 中注册命令
- [ ] 运行 `cargo run` 生成 TypeScript bindings

**注册命令**:
```rust
// src-tauri/src/lib.rs
.invoke_handler(tauri_specta::ts::builder()
    .commands(tauri_specta::collect_commands![
        commands::event::get_block_content_at_event,  // 新增
        // ... 其他命令
    ])
    .build()
)
```

#### 任务 3: 确认 Block 重命名机制
**文件**: `src-tauri/src/commands/block.rs`

**当前实现**: 前端通过 "创建新 block + 复制内容 + 删除旧 block" 实现重命名

**评估**:
- [ ] 是否需要新增专门的 `core.rename` 能力？
- [ ] 还是保持现有流程（会产生 create + write + delete 三个事件）？

**建议**: 保持现有流程，因为：
- ✅ 符合事件溯源原则（所有操作都是独立事件）
- ✅ 无需额外开发后端能力
- ✅ Timeline 会完整展示重命名的所有步骤

#### 任务 4: 运行后端并生成 bindings
```bash
cd src-tauri
cargo run  # 或 pnpm tauri dev
```

确认 `src/bindings.ts` 中生成了：
- [ ] `getBlockContentAtEvent` 命令接口

---

### 前端开发（React + TypeScript）

#### 任务 1: 扩展 TauriClient - 添加 EventOperations
**文件**: `src/lib/tauri-client.ts`

```typescript
/**
 * Event Operations
 */
export class EventOperations {
  /**
   * 获取所有事件
   */
  static async getAllEvents(fileId: string): Promise<Event[]> {
    const result = await commands.getAllEvents(fileId)
    if (result.status === 'ok') {
      return result.data
    } else {
      throw new Error(result.error)
    }
  }

  /**
   * 获取指定 Event 时刻的 Block 内容（回溯）
   */
  static async getContentAtEvent(
    fileId: string,
    blockId: string,
    eventId: string
  ): Promise<string> {
    const result = await commands.getBlockContentAtEvent(fileId, blockId, eventId)
    if (result.status === 'ok') {
      return result.data
    } else {
      throw new Error(result.error)
    }
  }

  /**
   * 按向量时钟对事件排序（降序：最新在前）
   */
  static sortEventsByVectorClock(events: Event[]): Event[] {
    return [...events].sort((a, b) => {
      // 降序排列（最新事件在前）
      return -compareVectorClocks(a.timestamp, b.timestamp)
    })
  }

  /**
   * 解析 Event，提取操作信息
   */
  static parseEvent(event: Event): {
    operator: string      // 操作人员
    operatorName: string  // 操作人员显示名称
    action: string        // 操作名称（用户友好）
    content: string       // 操作内容摘要
  } {
    const [editorId, capId] = event.attribute.split('/')

    return {
      operator: editorId,
      operatorName: editorId === 'system' ? 'System' : editorId,
      action: getActionLabel(capId),
      content: extractContentSummary(event.value, capId),
    }
  }
}

/**
 * 向量时钟比较函数
 */
function compareVectorClocks(
  vc1: Record<string, number>,
  vc2: Record<string, number>
): number {
  const allEditors = new Set([...Object.keys(vc1), ...Object.keys(vc2)])

  let vc1Greater = false
  let vc2Greater = false

  for (const editor of allEditors) {
    const v1 = vc1[editor] || 0
    const v2 = vc2[editor] || 0

    if (v1 > v2) vc1Greater = true
    if (v2 > v1) vc2Greater = true
  }

  if (vc1Greater && !vc2Greater) return 1
  if (vc2Greater && !vc1Greater) return -1
  return 0
}

/**
 * 获取操作的用户友好标签
 */
function getActionLabel(capId: string): string {
  const labels: Record<string, string> = {
    'core.create': '创建了文件',
    'markdown.write': '修改了文件内容',
    'core.delete': '删除了文件',
    'core.grant': '授予了权限',
    'core.revoke': '撤销了权限',
  }
  return labels[capId] || capId
}

/**
 * 提取事件内容摘要
 */
function extractContentSummary(value: JsonValue, capId: string): string {
  if (!value || typeof value !== 'object') return ''

  const obj = value as Record<string, any>

  switch (capId) {
    case 'core.create':
      return obj.name ? `"${obj.name}"` : ''
    case 'markdown.write':
      // 提取前50个字符作为摘要
      const content = obj.content || ''
      return content.length > 50
        ? content.substring(0, 50) + '...'
        : content
    case 'core.grant':
      return `${obj.capability} → ${obj.target_editor}`
    case 'core.revoke':
      return `${obj.capability} ← ${obj.target_editor}`
    default:
      return ''
  }
}

// 更新 TauriClient 导出
export const TauriClient = {
  file: FileOperations,
  block: BlockOperations,
  editor: EditorOperations,
  event: EventOperations,  // 新增
}
```

**步骤**:
- [ ] 添加 `EventOperations` 类
- [ ] 实现 `getAllEvents` 方法
- [ ] 实现 `getContentAtEvent` 方法
- [ ] 实现 `sortEventsByVectorClock` 方法
- [ ] 实现 `parseEvent` 方法
- [ ] 实现辅助函数（`compareVectorClocks`, `getActionLabel`, `extractContentSummary`）
- [ ] 在 `TauriClient` 中导出 `event` 属性

#### 任务 2: 扩展 AppStore - 添加 Event 状态管理
**文件**: `src/lib/app-store.ts`

```typescript
interface AppStore {
  // ... 现有状态

  // Event 操作
  loadEvents: (fileId: string) => Promise<void>
  restoreToEvent: (fileId: string, blockId: string, eventId: string) => Promise<void>
}

// 实现
export const useAppStore = create<AppStore>((set, get) => ({
  // ... 现有实现

  /**
   * 加载指定文件的所有事件
   */
  loadEvents: async (fileId: string) => {
    try {
      const events = await TauriClient.event.getAllEvents(fileId)
      const files = new Map(get().files)
      const fileState = files.get(fileId)
      if (fileState) {
        files.set(fileId, { ...fileState, events })
        set({ files })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      toast.error(`Failed to load events: ${errorMessage}`)
    }
  },

  /**
   * 回溯到指定事件时刻的内容
   * 直接替换编辑器内容，用户可继续编辑和保存
   */
  restoreToEvent: async (fileId: string, blockId: string, eventId: string) => {
    try {
      // 1. 获取历史内容
      const historicalContent = await TauriClient.event.getContentAtEvent(
        fileId,
        blockId,
        eventId
      )

      // 2. 更新当前 block 的内容（仅在内存中，不保存到数据库）
      const files = new Map(get().files)
      const fileState = files.get(fileId)
      if (fileState) {
        const updatedBlocks = fileState.blocks.map(block => {
          if (block.block_id === blockId) {
            return {
              ...block,
              contents: { markdown: historicalContent }
            }
          }
          return block
        })
        files.set(fileId, { ...fileState, blocks: updatedBlocks })
        set({ files })
      }

      // 3. 触发编辑器重新渲染
      // EditorCanvas 会通过 useEffect 监听 block 变化并更新显示

      toast.success('已恢复到历史版本，可继续编辑')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      toast.error(`Failed to restore: ${errorMessage}`)
      throw error
    }
  },
}))
```

**步骤**:
- [ ] 添加 `loadEvents` 方法到 AppStore
- [ ] 添加 `restoreToEvent` 方法到 AppStore
- [ ] 确保 events 状态已在 `FileState` 中定义（已存在）

#### 任务 3: 增强 TimelineTab 组件
**文件**: `src/components/editor/ContextPanel.tsx`

**当前实现**: TimelineTab 只显示简单的事件列表

**目标**: 显示丰富的事件信息 + Restore 按钮

```typescript
const TimelineTab = ({
  events,
  fileId,
  blockId,
}: {
  events: Event[]
  fileId: string | null
  blockId: string | null
}) => {
  const { restoreToEvent } = useAppStore()
  const [sortedEvents, setSortedEvents] = useState<Event[]>([])
  const [isRestoring, setIsRestoring] = useState(false)

  // 按时间排序（最新在上）
  useEffect(() => {
    const sorted = TauriClient.event.sortEventsByVectorClock(events)
    setSortedEvents(sorted)
  }, [events])

  // 处理 restore 操作
  const handleRestore = async (eventId: string) => {
    if (!fileId || !blockId) {
      toast.error('No block selected')
      return
    }

    setIsRestoring(true)
    try {
      await restoreToEvent(fileId, blockId, eventId)
    } catch (error) {
      console.error('Failed to restore:', error)
    } finally {
      setIsRestoring(false)
    }
  }

  if (sortedEvents.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border/50 text-center">
        <div>
          <p className="text-sm text-muted-foreground">暂无操作记录</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            编辑文档后将显示操作历史
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {sortedEvents.map((event) => {
        const parsed = TauriClient.event.parseEvent(event)
        const timestamp = formatTimestamp(event.timestamp)

        return (
          <div
            key={event.event_id}
            className="rounded-lg border border-border bg-background p-3 transition-colors hover:bg-muted/20"
          >
            {/* Event Header */}
            <div className="mb-2 flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">
                    {parsed.operatorName}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {parsed.action}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <Clock className="h-3 w-3 text-muted-foreground/70" />
                  <span className="text-xs text-muted-foreground">
                    {timestamp}
                  </span>
                </div>
              </div>

              {/* Restore Button */}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => handleRestore(event.event_id)}
                disabled={isRestoring}
              >
                <RotateCcw className="mr-1.5 h-3 w-3" />
                还原
              </Button>
            </div>

            {/* Content Summary */}
            {parsed.content && (
              <div className="mt-2 rounded bg-muted/30 p-2 text-xs text-muted-foreground">
                {parsed.content}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

**时间戳格式化辅助函数**:
```typescript
function formatTimestamp(timestamp: Record<string, number>): string {
  // 获取最大的时钟值
  const values = Object.values(timestamp)
  const maxClock = values.length > 0 ? Math.max(...values) : 0

  // 简单显示时钟值（后续可以改为真实时间戳）
  return `操作 #${maxClock}`
}
```

**步骤**:
- [ ] 更新 TimelineTab 组件的 props（添加 fileId 和 blockId）
- [ ] 实现事件排序逻辑
- [ ] 实现 Restore 按钮和处理函数
- [ ] 添加 RotateCcw 图标导入
- [ ] 实现 formatTimestamp 辅助函数
- [ ] 更新 ContextPanel 传递 fileId 和 blockId 到 TimelineTab

#### 任务 4: 确保 DocumentEditor 加载 Events
**文件**: `src/pages/DocumentEditor.tsx`

```typescript
// 在 loadFile 函数中添加 loadEvents
await store.loadBlocks(projectId)
await store.loadEditors(projectId)
await store.loadGrants(projectId)
await store.loadEvents(projectId)  // 新增
```

**步骤**:
- [ ] 在 `DocumentEditor.tsx` 的文件加载逻辑中调用 `loadEvents`

#### 任务 5: 确保 EditorCanvas 保存时更新 Events
**文件**: `src/components/editor/EditorCanvas.tsx`

```typescript
const handleSave = useCallback(async () => {
  if (!currentFileId || !selectedBlockId) {
    toast.error('No block selected')
    return
  }

  setIsSaving(true)
  try {
    // Step 1: Update block content in memory
    if (documentContent.trim()) {
      await updateBlock(currentFileId, selectedBlockId, documentContent)
    }

    // Step 2: Save file to disk (.elf file)
    await saveFile(currentFileId)

    // Step 3: Reload events to show the new event
    await loadEvents(currentFileId)  // 新增

    toast.success('Document and file saved successfully')
  } catch (error) {
    console.error('Failed to save:', error)
  } finally {
    setIsSaving(false)
  }
}, [currentFileId, selectedBlockId, documentContent, updateBlock, saveFile, loadEvents])
```

**步骤**:
- [ ] 在 EditorCanvas 中导入 `loadEvents` 方法
- [ ] 在保存成功后调用 `loadEvents` 刷新事件列表

---

## 测试要点

### 功能测试

#### 1. 事件记录测试
- [ ] 创建 block 时，Timeline 显示 "xxx 创建了文件" 事件
- [ ] 编辑并保存内容时，Timeline 显示 "xxx 修改了文件内容" 事件
- [ ] 授予/撤销权限时，Timeline 显示对应事件
- [ ] 重命名 block 时，Timeline 显示 create + write + delete 事件序列

#### 2. 事件排序测试
- [ ] Timeline 中最新事件显示在顶部
- [ ] 最早事件显示在底部
- [ ] 并发事件的顺序符合向量时钟算法

#### 3. Restore 功能测试
- [ ] 点击 Restore 按钮后，编辑器内容正确替换为历史版本
- [ ] 还原后可以继续编辑内容
- [ ] 还原后保存，产生新的事件记录
- [ ] 点击 Restore 操作本身不产生事件

#### 4. 事件解析测试
- [ ] 操作人员名称显示正确（system 显示为 "System"）
- [ ] 操作类型显示为用户友好的中文描述
- [ ] 内容摘要正确提取（create 显示文件名，write 显示内容摘要）

### 边界情况测试

- [ ] 没有事件时，Timeline 显示空状态提示
- [ ] 没有选中 block 时，Restore 按钮禁用或提示错误
- [ ] 回溯到不存在的 event_id 时，显示错误提示
- [ ] 事件加载失败时，显示友好的错误消息

### 性能测试

- [ ] 大量事件（>100 条）时，Timeline 滚动流畅
- [ ] 事件排序不阻塞 UI 渲染
- [ ] Restore 操作响应时间 < 1 秒

---

## UI/UX 设计

### Timeline 布局

```
┌─────────────────────────────────────┐
│  Timeline                           │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ 👤 System 修改了文件内容        │ │
│ │ 🕒 操作 #5                      │ │
│ │ ┌─────────────────────────────┐ │ │
│ │ │ # 标题\n\n这是新内容...       │ │ │
│ │ └─────────────────────────────┘ │ │
│ │              [还原] ←───────────┤ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 👤 System 创建了文件            │ │
│ │ 🕒 操作 #1                      │ │
│ │ "我的文档"                      │ │
│ │              [还原]             │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 交互反馈

- **Hover**: 事件卡片背景变浅
- **Click Restore**: 按钮显示 loading 状态
- **Restore 成功**: Toast 提示 "已恢复到历史版本，可继续编辑"
- **Restore 失败**: Toast 提示错误信息

---

## 开发里程碑

### Phase 1: 后端基础（预计 4 小时）
- [ ] 实现 `get_block_content_at_event` 命令
- [ ] 生成 TypeScript bindings
- [ ] 编写后端单元测试

### Phase 2: 前端基础（预计 6 小时）
- [ ] 扩展 TauriClient（EventOperations）
- [ ] 扩展 AppStore（loadEvents, restoreToEvent）
- [ ] 实现向量时钟排序逻辑
- [ ] 实现事件解析逻辑

### Phase 3: UI 组件（预计 4 小时）
- [ ] 增强 TimelineTab 组件
- [ ] 添加 Restore 按钮和交互
- [ ] 实现时间戳格式化
- [ ] 完善样式和动画

### Phase 4: 集成与测试（预计 4 小时）
- [ ] 在 DocumentEditor 中加载 events
- [ ] 在 EditorCanvas 中保存后刷新 events
- [ ] 端到端功能测试
- [ ] 修复 bug 和优化性能

**总计预估**: 18 小时

---

## 常见问题 (FAQ)

### Q1: 为什么 restore 操作不记录到 event？
**A**: Restore 只是查看和编辑历史内容，不是真正的状态变化。只有用户保存修改后的内容时，才会产生新的 `markdown.write` 事件。

### Q2: Grants 信息如何保存？
**A**: 采用 Event Sourcing 原则，grants 通过单独的 `core.grant` 和 `core.revoke` 事件记录。回溯时通过重放所有事件来重建历史权限状态。

### Q3: 如何处理向量时钟的并发冲突？
**A**: 当两个事件的向量时钟无法比较大小时（并发事件），它们的相对顺序不重要。前端排序时可以保持原有顺序或使用 event_id 作为 tie-breaker。

### Q4: 大量事件时性能如何？
**A**:
- 前端只加载当前 file 的事件（通过 fileId 过滤）
- 可以考虑分页加载（后续优化）
- 向量时钟排序是 O(n log n)，对于几百条事件性能足够

### Q5: 如何显示真实时间而不是逻辑时钟？
**A**: Event 结构中可以添加 `created_at` 字段（真实时间戳）。当前 MVP 使用向量时钟的最大值作为简化显示，后续可以改进。

---

## 参考文档

- [Event 模块迁移方案](./migration/06-event-module.md)
- [架构概述](../concepts/ARCHITECTURE_OVERVIEW.md)
- [Event Sourcing 原理](../concepts/ENGINE_CONCEPTS.md)
- [向量时钟算法](https://en.wikipedia.org/wiki/Vector_clock)

---

**文档维护**: 本文档应与代码实现同步更新。开发过程中如有变更，请及时更新对应章节。
