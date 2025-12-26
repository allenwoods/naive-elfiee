# Timeline 功能开发计划

## 文档信息

- **功能模块**: Timeline（时间线）
- **文档版本**: 1.1
- **最后更新**: 2025-12-24
- **状态**: 🟡 部分完成（基础版本已实现，Restore 功能等待后端支持）
- **当前进度**: Phase 2-4 已完成，Phase 1 未开始

---

## 功能概述

实现 ContextPanel 中的 Timeline 功能，展示文档的操作历史记录，并支持回溯到历史版本。

---

## 快速开始

### ⚠️ 下次开发从这里开始

**当前状态**: 🟡 **基础功能已完成，Restore 功能待开发**

**✅ 已完成的功能（可直接使用）**:
1. ✅ **Timeline 事件展示** - 完全可用
   - 打开应用 → 选择文件 → 选择 block → 点击右侧 "Timeline" tab
   - 显示：操作人员、操作类型（"创建了文件"等）、时间戳
   - 自动排序（最新事件在上）
   - 创建/编辑/保存操作会自动记录并显示

2. ✅ **事件自动加载**
   - 文件打开时自动加载事件
   - 保存后自动刷新事件列表

3. ✅ **用户友好界面**
   - 图标、样式优化
   - 空状态提示
   - Hover 效果

**❌ 下次需要开发的功能**:

### 🎯 下次开发起点：Phase 1（后端回溯功能）

**优先级**: 高（Restore 功能的前置依赖）
**预计时间**: 3 小时

**任务清单**:
1. **实现后端回溯命令**（2 小时）
   - 文件：`src-tauri/src/commands/event.rs`（新建）
   - 实现 `get_block_content_at_event` 命令
   - 在 `src-tauri/src/lib.rs` 中注册命令
   - 详见 [任务 2: 实现事件回溯命令](#任务-2-实现事件回溯命令)

2. **生成前端 TypeScript bindings**（10 分钟）
   ```bash
   cd src-tauri
   cargo run  # 或 pnpm tauri dev
   ```

3. **实现前端 Restore 功能**（1 小时）
   - 在 `TauriClient.event` 添加 `getContentAtEvent` 方法
   - 在 `AppStore` 添加 `restoreToEvent` 方法
   - 在 `TimelineTab` 启用 Restore 按钮
   - 详见 [Phase 2.3](#任务-2-扩展-appstore---添加-event-方法必需) 和 [Phase 3](#任务-3-增强-timelinetab-组件必需)

**完成后的效果**:
- ✅ 点击 Timeline 中的"还原"按钮可恢复历史版本
- ✅ 还原后可继续编辑和保存
- ✅ 完整的操作历史回溯功能

详见 [开发里程碑](#开发里程碑) 章节了解完整开发流程。

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

## 当前实现状态

**更新日期**: 2025-12-24
**开发进度**: Phase 2-4 已完成（约 75%），Phase 1 未开始（约 25%）

### 后端（Rust）

✅ **已实现**:
- `get_all_events` 命令 (`src-tauri/src/commands/file.rs`)
  - 可以获取指定文件的所有事件
  - 前端已集成并正常工作

❌ **未实现（下次开发重点）**:
- `get_block_content_at_event` 命令（回溯功能）
  - **文件位置**: `src-tauri/src/commands/event.rs`（需新建）
  - **阻塞功能**: Restore（还原到历史版本）

### 前端（React + TypeScript）

✅ **已实现（基础 Timeline 完全可用）**:
1. **数据层** (`src/lib/tauri-client.ts`)
   - ✅ EventOperations 类
   - ✅ `getAllEvents()` 方法
   - ✅ `sortEventsByVectorClock()` 方法
   - ✅ `parseEvent()` 方法
   - ✅ 辅助函数（compareVectorClocks, getActionDescription）

2. **状态管理** (`src/lib/app-store.ts`)
   - ✅ `events: Event[]` 状态
   - ✅ `getEvents(fileId)` 方法
   - ✅ `loadEvents(fileId)` 方法

3. **UI 组件** (`src/components/editor/ContextPanel.tsx`)
   - ✅ TimelineTab 增强版本
   - ✅ 事件排序（最新在上）
   - ✅ 事件解析（操作人、操作类型）
   - ✅ 用户友好界面（图标、样式、Hover）
   - ✅ 空状态提示
   - ✅ Restore 按钮（已添加但禁用，提示"还原功能开发中"）

4. **集成**
   - ✅ `DocumentEditor.tsx` - 文件打开时调用 `loadEvents()`
   - ✅ `EditorCanvas.tsx` - 保存后调用 `loadEvents()`

❌ **未实现（等待后端支持）**:
- `TauriClient.event.getContentAtEvent()` 方法（依赖后端 `get_block_content_at_event`）
- `AppStore.restoreToEvent()` 方法（依赖上述方法）
- TimelineTab 启用 Restore 按钮（依赖上述方法）

---

## 开发任务清单

### 后端开发（Rust）

#### 任务 1: 验证现有 Event 记录机制（可选）
**文件**: `src-tauri/src/commands/file.rs`, `src-tauri/src/commands/block.rs`

**状态**: ✅ 后端已实现事件记录，但需要验证是否正常工作

- [ ] 验证 `core.create` 事件记录（创建 block 时）
- [ ] 验证 `markdown.write` 事件记录（修改内容时）
- [ ] 验证 `core.grant` 和 `core.revoke` 事件记录（权限变更时）

**验证方法**:
```bash
# 方法 1: 手动测试
pnpm tauri dev
# 创建 block、编辑内容、授予权限，然后在 Timeline tab 中查看是否有对应事件

# 方法 2: 单元测试（如果存在）
cd src-tauri
cargo test event
```

**注意**: Block 重命名当前通过 "创建新 block + 复制内容 + 删除旧 block" 实现，会产生 create + write + delete 三个事件，这符合事件溯源原则，无需新增专门的 `core.rename` 能力。

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

#### 任务 3: 生成 TypeScript bindings
```bash
cd src-tauri
cargo run  # 或 pnpm tauri dev
```

确认 `src/bindings.ts` 中生成了：
- [ ] `getBlockContentAtEvent` 命令接口

---

### 前端开发（React + TypeScript）

#### 任务 1: 扩展 TauriClient - 添加 EventOperations（必需）
**文件**: `src/lib/tauri-client.ts`

**状态**: ❌ 未实现，需要新增

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
    action: string        // 操作描述（简洁版本）
  } {
    const [editorId, capId] = event.attribute.split('/')

    return {
      operator: editorId,
      operatorName: editorId === 'system' ? 'System' : editorId,
      action: getActionDescription(capId),
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
 * 获取操作的简洁描述
 */
function getActionDescription(capId: string): string {
  const labels: Record<string, string> = {
    'core.create': '创建了文件',
    'markdown.write': '修改了文件内容',
    'core.delete': '删除了文件',
    'core.grant': '授予了权限',
    'core.revoke': '撤销了权限',
  }
  return labels[capId] || capId
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
- [ ] 实现辅助函数（`compareVectorClocks`, `getActionDescription`）
- [ ] 在 `TauriClient` 中导出 `event` 属性

#### 任务 2: 扩展 AppStore - 添加 Event 方法（必需）
**文件**: `src/lib/app-store.ts`

**状态**: ⚠️ 部分实现
- ✅ 已有 `events` 状态和 `getEvents` 方法
- ❌ 需要新增 `loadEvents` 和 `restoreToEvent` 方法

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

#### 任务 3: 增强 TimelineTab 组件（必需）
**文件**: `src/components/editor/ContextPanel.tsx`

**状态**: ⚠️ 基础版本已实现，需要增强

**当前实现**:
- ✅ 显示 event.attribute（如 "system/core.create"）
- ✅ 显示时间戳
- ✅ 过滤当前 block 的事件

**需要增强**:
- ❌ 解析操作人员和操作类型（用户友好显示）
- ❌ 添加 Restore 按钮
- ❌ 实现向量时钟排序（最新事件在上）
- ❌ 改进 UI（图标、样式）

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
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium text-foreground">
                    {parsed.operatorName}
                  </span>
                  <span className="text-muted-foreground">
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

#### 任务 4: 在 DocumentEditor 中加载 Events（必需）
**文件**: `src/pages/DocumentEditor.tsx`

**状态**: ❌ 未实现

**当前代码**:
```typescript
await store.loadBlocks(projectId)
await store.loadEditors(projectId)
await store.loadGrants(projectId)
// ❌ 缺少: await store.loadEvents(projectId)
```

**需要修改**:
```typescript
await store.loadBlocks(projectId)
await store.loadEditors(projectId)
await store.loadGrants(projectId)
await store.loadEvents(projectId)  // ✅ 新增
```

**步骤**:
- [ ] 在文件加载逻辑中调用 `loadEvents`（需要先实现 AppStore.loadEvents）

#### 任务 5: 在 EditorCanvas 保存时刷新 Events（必需）
**文件**: `src/components/editor/EditorCanvas.tsx`

**状态**: ❌ 未实现

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
- [ ] 操作类型显示为用户友好的中文描述（"创建了文件"、"修改了文件内容"等）

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
│ │              [还原] ←───────────┤ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 👤 System 创建了文件            │ │
│ │ 🕒 操作 #1                      │ │
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

### Phase 1: 后端基础（预计 3 小时）⬅️ **下次从这里开始**
**优先级**: 高（Restore 功能依赖）
**状态**: ❌ **未开始（下次开发重点）**

**任务清单**:
- [ ] 实现 `get_block_content_at_event` 命令
- [ ] 在 `src-tauri/src/lib.rs` 中注册命令
- [ ] 生成 TypeScript bindings（`cargo run`）
- [ ] 简单测试验证回溯功能

**开始前准备**:
- 阅读 [任务 2: 实现事件回溯命令](#任务-2-实现事件回溯命令)
- 参考现有的 `get_all_events` 实现

---

### Phase 2: 前端数据层（预计 4 小时）
**优先级**: 高（其他功能的基础）
**状态**: ✅ **已完成（2025-12-24）**

**完成内容**:
- ✅ 扩展 TauriClient（EventOperations 类）
  - ✅ getAllEvents（后端已有，前端已集成）
  - ⏳ getContentAtEvent（等待 Phase 1 后端实现）
  - ✅ sortEventsByVectorClock
  - ✅ parseEvent
- ✅ 扩展 AppStore
  - ✅ loadEvents
  - ⏳ restoreToEvent（等待 Phase 1 后端实现）
- ✅ 实现辅助函数（compareVectorClocks, getActionDescription）

**实现文件**:
- `src/lib/tauri-client.ts` (新增 EventOperations 类)
- `src/lib/app-store.ts` (新增 loadEvents 方法)

---

### Phase 3: UI 组件增强（预计 3 小时）
**优先级**: 高（核心用户体验）
**状态**: ✅ **已完成（2025-12-24）** - Restore 按钮待启用

**完成内容**:
- ✅ 增强 TimelineTab 组件
  - ✅ 事件排序和解析
  - ✅ 用户友好的界面（图标、样式、Hover）
  - ⏳ Restore 按钮（已添加但禁用，等待 Phase 1）
- ✅ 更新 TimelineTab props（传递 fileId 和 blockId）
- ✅ 添加必要的图标导入（RotateCcw, User, Clock）

**实现文件**:
- `src/components/editor/ContextPanel.tsx` (重写 TimelineTab 组件)

**待完成**:
- [ ] 启用 Restore 按钮（需要先完成 Phase 1）
- [ ] 实现 handleRestore 逻辑（调用 AppStore.restoreToEvent）

---

### Phase 4: 集成与测试（预计 2 小时）
**优先级**: 高（确保功能完整）
**状态**: ✅ **已完成（2025-12-24）** - 基础测试待进行

**完成内容**:
- ✅ 在 DocumentEditor 中加载 events
- ✅ 在 EditorCanvas 保存后刷新 events

**实现文件**:
- `src/pages/DocumentEditor.tsx` (添加 loadEvents 调用)
- `src/components/editor/EditorCanvas.tsx` (添加 loadEvents 调用)

**待测试**:
- [ ] 端到端功能测试：
  - ✅ 创建 block → 查看 Timeline（基础功能可测试）
  - ✅ 编辑内容 → 查看 Timeline（基础功能可测试）
  - ⏳ Restore → 验证内容恢复（等待 Phase 1）
  - ⏳ Restore 后保存 → 验证新事件生成（等待 Phase 1）

---

**总计预估**: 12 小时
**已完成**: ~9 小时（75%）
**剩余**: ~3 小时（25%）

**下次开发顺序**:
1. ⭐ **Phase 1** → 后端回溯功能（必须完成）
2. **Phase 2 补充** → 添加 TauriClient.event.getContentAtEvent
3. **Phase 2 补充** → 添加 AppStore.restoreToEvent
4. **Phase 3 补充** → 启用 TimelineTab Restore 按钮
5. **Phase 4 补充** → 完整端到端测试

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

## 开发总结（2025-12-24）

### ✅ 本次完成的工作

**开发时间**: 约 2 小时
**完成进度**: 75%（Phase 2-4）

#### 1. 前端数据层实现
- ✅ `src/lib/tauri-client.ts` - 新增 EventOperations 类
  - getAllEvents, sortEventsByVectorClock, parseEvent
  - 辅助函数：compareVectorClocks, getActionDescription
- ✅ `src/lib/app-store.ts` - 新增 loadEvents 方法

#### 2. UI 组件增强
- ✅ `src/components/editor/ContextPanel.tsx` - 重写 TimelineTab
  - 事件排序（最新在上）
  - 事件解析（用户友好显示）
  - 添加 Restore 按钮（暂时禁用）
  - 优化 UI（图标、样式、Hover、空状态）

#### 3. 功能集成
- ✅ `src/pages/DocumentEditor.tsx` - 添加 loadEvents 调用
- ✅ `src/components/editor/EditorCanvas.tsx` - 保存后刷新 events

### 🎯 当前可用功能

**Timeline 基础功能已完全可用**：
1. ✅ 查看操作历史（创建、编辑、授权等）
2. ✅ 自动排序（最新事件在上）
3. ✅ 用户友好显示（"System 创建了文件"）
4. ✅ 自动刷新（保存后更新）

**测试方法**:
```bash
pnpm tauri dev
# 1. 创建 .elf 文件
# 2. 创建 block 并编辑内容
# 3. 保存文档
# 4. 点击右侧 "Timeline" tab 查看历史
```

### 🚧 待完成功能（下次开发）

**剩余工作量**: 约 3 小时（25%）

#### Phase 1: 后端回溯（必需）
**文件**: `src-tauri/src/commands/event.rs`（新建）
**任务**:
1. 实现 `get_block_content_at_event` 命令
2. 在 `src-tauri/src/lib.rs` 注册命令
3. 运行 `cargo run` 生成 bindings

#### Phase 2-3 补充: 前端 Restore 功能
**文件**:
- `src/lib/tauri-client.ts` - 添加 getContentAtEvent 方法
- `src/lib/app-store.ts` - 添加 restoreToEvent 方法
- `src/components/editor/ContextPanel.tsx` - 启用 Restore 按钮

#### Phase 4 补充: 端到端测试
**测试用例**:
- Restore 到历史版本
- 还原后继续编辑和保存
- 验证新事件生成

### 📖 下次开发指引

**起点**: [Phase 1: 后端基础](#phase-1-后端基础预计-3-小时-下次从这里开始)
**参考**: [任务 2: 实现事件回溯命令](#任务-2-实现事件回溯命令)

**快速启动**:
1. 阅读 Phase 1 任务清单
2. 参考 `src-tauri/src/commands/file.rs` 中的 `get_all_events` 实现
3. 创建 `src-tauri/src/commands/event.rs` 文件
4. 实现回溯逻辑（详见任务 2 代码示例）

---

**文档维护**: 本文档应与代码实现同步更新。开发过程中如有变更，请及时更新对应章节。
