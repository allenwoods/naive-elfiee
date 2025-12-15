# Mock 数据迁移修复清单

## 已完成的修复

### ✅ 核心文件
1. **`src/lib/tauri-client.ts`** - 已创建，封装所有 Tauri 命令
2. **`src/lib/app-store.ts`** - 已创建，Zustand 状态管理
3. **`src/App.tsx`** - 已修复，移除 `EditorProvider`
4. **`src/components/dashboard/Sidebar.tsx`** - 已修复，移除 Persona 系统，使用 Editor
5. **`src/components/editor/AgentContext.tsx`** - 已修复，使用 Tauri 接口
6. **`src/components/editor/EditorCanvas.tsx`** - 已部分修复，需要继续完善

## 需要修复的文件

### 🔴 高优先级（核心功能）

#### 1. `src/components/editor/EditorCanvas.tsx`
**问题**：
- 仍使用 `useEditorStore`、`getProjectData`、`projectData`
- 需要从 `app-store` 获取 block 数据

**修复方案**：
```typescript
// 替换
const { currentFileId, selectedBlockId, getBlock, updateBlock } = useAppStore();

// 加载 block 内容
useEffect(() => {
  if (currentFileId && selectedBlockId) {
    const block = getBlock(currentFileId, selectedBlockId);
    if (block) {
      const contents = block.contents as { markdown?: string };
      setDocumentContent(contents?.markdown || "");
    }
  }
}, [currentFileId, selectedBlockId]);
```

#### 2. `src/components/editor/ContextPanel.tsx`
**问题**：
- 使用 `useEditorStore`、`TEAM_MEMBERS`、`Collaborator`、`TimelineEvent`
- 需要替换为 `useAppStore` 和 Tauri 接口

**修复方案**：
```typescript
// 替换导入
import { useAppStore } from "@/lib/app-store";
import type { Editor, Event, Grant } from "@/bindings";

// 使用 app-store
const { 
  currentFileId, 
  selectedBlockId,
  getEvents, 
  getEditors, 
  getGrants 
} = useAppStore();

// 转换 Event 为 TimelineEventData
const events = getEvents(currentFileId || '').map(event => ({
  id: event.event_id,
  timestamp: formatTimestamp(event.timestamp),
  actor: parseEditorName(event.attribute),
  actorType: "human" as const,
  action: parseEventAction(event.attribute),
  description: extractDescription(event),
  icon: Pencil,
}));
```

#### 3. `src/components/editor/FilePanel.tsx`
**问题**：
- 使用 `useEditorStore`、`ImportedFile`、`Document`
- 需要替换为使用 `app-store` 获取 blocks

**修复方案**：
```typescript
// 替换
import { useAppStore } from "@/lib/app-store";
import type { Block } from "@/bindings";

// 使用 blocks 替代 documents
const { currentFileId, getBlocks } = useAppStore();
const blocks = getBlocks(currentFileId || '');
```

#### 4. `src/components/editor/BlockEditor.tsx`
**问题**：
- 使用 `useEditorStore`、`Block`、`Document`
- 需要替换为 `app-store`

**修复方案**：
```typescript
// 替换
import { useAppStore } from "@/lib/app-store";
import type { Block } from "@/bindings";

const { currentFileId, selectedBlockId, getBlock } = useAppStore();
const block = selectedBlockId ? getBlock(currentFileId || '', selectedBlockId) : null;
```

#### 5. `src/components/editor/EditorSidebar.tsx`
**问题**：
- 使用 `useEditorStore` 的类型
- 需要替换为 `bindings.ts` 中的类型

#### 6. `src/components/editor/ProjectExplorer.tsx`
**问题**：
- 使用 `useEditorStore`、`ImportedFile`、`Document`
- 需要替换为使用 blocks

### 🟡 中优先级（辅助功能）

#### 7. `src/pages/DocumentEditor.tsx`
**检查**：可能需要传递 `fileId` 和 `blockId` 给子组件

#### 8. `src/pages/Projects.tsx`
**检查**：可能需要使用 `app-store` 的文件操作

## 修复步骤

### 步骤 1：修复 EditorCanvas.tsx
1. 移除所有 `useEditorStore` 引用
2. 使用 `useAppStore` 获取当前文件和选中的 block
3. 从 block.contents.markdown 读取内容
4. 使用 `updateBlock` 保存内容

### 步骤 2：修复 ContextPanel.tsx
1. 移除 `TEAM_MEMBERS`、`Collaborator` 等 mock 类型
2. 使用 `getEvents`、`getEditors`、`getGrants` 获取数据
3. 转换 Event 数据为 TimelineEventData 格式
4. 使用 `grantCapability`、`revokeCapability` 管理权限

### 步骤 3：修复 FilePanel.tsx
1. 移除 `ImportedFile`、`Document` 类型
2. 使用 `getBlocks` 获取 blocks 列表
3. 将 blocks 转换为文件树结构

### 步骤 4：修复其他组件
1. 逐个修复 BlockEditor、EditorSidebar、ProjectExplorer
2. 确保所有组件都使用 `app-store` 而不是 `mockStore`

## 类型映射

| Mock 类型 | Tauri 类型 | 说明 |
|----------|-----------|------|
| `Persona` | `Editor` | 编辑者身份 |
| `Document` | `Block` | 文档即 Block |
| `ImportedFile` | `Block` | 导入文件即 Block |
| `TimelineEvent` | `Event` | 时间线事件 |
| `Collaborator` | `Editor` + `Grant` | 协作者 = 编辑者 + 权限 |
| `Block` (mock) | `Block` (Tauri) | 结构不同，需要适配 |

## 注意事项

1. **Block.contents 结构**：
   - Mock: `{ content: string }`
   - Tauri: `{ markdown: string, metadata?: {...} }`

2. **Event 结构**：
   - Mock: `{ id, timestamp, actor, action, content }`
   - Tauri: `{ event_id, entity, attribute, value, timestamp }`

3. **权限系统**：
   - Mock: `permissions: { read, edit, ... }`
   - Tauri: `Grant[]` 数组，每个 Grant 包含 `cap_id`

4. **文件系统**：
   - Mock: `project.documents` 树形结构
   - Tauri: `Block[]` 扁平数组，通过 `children` 字段建立关系

## 快速修复命令

```bash
# 查找所有使用 mockStore 的文件
grep -r "mockStore" src/

# 查找所有使用 projectData 的文件
grep -r "projectData" src/

# 查找所有使用 Persona 的文件
grep -r "Persona\|PERSONAS" src/
```

