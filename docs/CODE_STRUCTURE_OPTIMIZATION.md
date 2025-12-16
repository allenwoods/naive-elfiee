# 代码结构优化方案

## 一、当前代码结构分析

### 1.1 现有目录结构
```
src/
├── pages/              # 页面组件
│   ├── Projects.tsx    # 项目列表页（使用 mock 数据）
│   ├── DocumentEditor.tsx  # 文档编辑器页
│   └── NotFound.tsx
├── components/
│   ├── dashboard/      # 仪表板组件
│   ├── editor/         # 编辑器相关组件
│   ├── projects/       # 项目相关组件
│   └── ui/             # UI 基础组件库
├── lib/
│   ├── app-store.ts    # Zustand 状态管理
│   └── tauri-client.ts # Tauri API 客户端
└── hooks/              # 自定义 Hooks
```

### 1.2 功能模块映射关系

| 功能模块 | 当前实现位置 | 完成度 | 问题 |
|---------|------------|--------|------|
| **.elf文件管理** | | | |
| - CRUD操作 | `lib/tauri-client.ts` (FileOperations) | ✅ 基础完成 | `Projects.tsx` 使用 mock 数据，未连接真实 API |
| - 文件展示 | `pages/Projects.tsx` | ⚠️ 部分完成 | 缺少真实数据集成 |
| - Dashboard | `pages/Projects.tsx` | ⚠️ 部分完成 | 需要增强信息展示 |
| **directory extension** | | | |
| - 基础能力 | `components/editor/FilePanel.tsx` | ⚠️ 部分完成 | 使用 mock 数据，缺少真实目录操作 |
| - 页面目录栏 | `components/editor/FilePanel.tsx` | ⚠️ 部分完成 | 内部/外部目录区分不明确 |
| **markdown extension** | | | |
| - md 编辑 | `components/editor/EditorCanvas.tsx` | ✅ 基础完成 | 需要数据格式适配 |
| - md 显示 | `components/editor/EditorCanvas.tsx` | ⚠️ 部分完成 | myst 语法适配待完善 |
| **block数据结构** | | | |
| - 数据结构 | `lib/app-store.ts` | ✅ 基础完成 | 需要添加 title/owner/description/time |
| - 显示信息 | `components/editor/ContextPanel.tsx` | ⚠️ 部分完成 | Info 页面需要增强 |
| **协作者和权限** | | | |
| - 基础功能 | `lib/app-store.ts` (grant/revoke) | ✅ 基础完成 | 协作者增删功能待完善 |
| - 权限显示 | `components/editor/ContextPanel.tsx` | ⚠️ 部分完成 | 权限页面需要优化 |
| **event模块** | | | |
| - event解析 | `lib/app-store.ts` (loadEvents) | ✅ 基础完成 | 需要增强解析（操作人员/名称/内容） |
| - event排序 | `components/editor/ContextPanel.tsx` | ❌ 未实现 | 需要实现排序功能 |
| - event回溯 | - | ❌ 未实现 | 需要实现回溯和快照功能 |
| - 显示和交互 | `components/editor/ContextPanel.tsx` | ⚠️ 部分完成 | 需要增强列表和对比显示 |

## 二、问题诊断

### 2.1 核心问题

1. **数据层与UI层分离不清晰**
   - `Projects.tsx` 使用本地 mock 数据，未连接到 `app-store` 和 Tauri API
   - 文件管理功能分散在多个组件中，缺乏统一管理

2. **功能模块化不足**
   - 编辑器相关功能都混在 `components/editor/` 中
   - 缺少按功能模块组织的清晰结构

3. **状态管理不完整**
   - `app-store.ts` 缺少项目列表管理
   - Event 模块功能不完整（缺少排序、回溯）

4. **组件职责不清**
   - `FilePanel.tsx` 同时处理内部目录和外部目录，职责混乱
   - `ContextPanel.tsx` 包含多个功能（Info、Collaborators、Timeline），应该拆分

## 三、优化方案

### 3.1 目录结构重构

```
src/
├── pages/                    # 页面组件
│   ├── Projects.tsx          # 项目列表页（需要连接真实数据）
│   ├── DocumentEditor.tsx    # 文档编辑器页
│   └── NotFound.tsx
│
├── features/                 # 功能模块（新增）
│   ├── file-management/     # .elf文件管理模块
│   │   ├── components/
│   │   │   ├── FileList.tsx
│   │   │   ├── FileCard.tsx
│   │   │   ├── FileInfo.tsx
│   │   │   └── FileActions.tsx
│   │   ├── hooks/
│   │   │   ├── useFileList.ts
│   │   │   └── useFileOperations.ts
│   │   └── store/
│   │       └── fileStore.ts
│   │
│   ├── directory/           # directory extension 模块
│   │   ├── components/
│   │   │   ├── DirectoryTree.tsx      # 内部目录树
│   │   │   ├── ExternalDirectory.tsx  # 外部目录
│   │   │   └── DirectoryActions.tsx
│   │   ├── hooks/
│   │   │   └── useDirectory.ts
│   │   └── store/
│   │       └── directoryStore.ts
│   │
│   ├── markdown/            # markdown extension 模块
│   │   ├── components/
│   │   │   ├── MarkdownEditor.tsx
│   │   │   └── MarkdownViewer.tsx
│   │   ├── hooks/
│   │   │   └── useMarkdown.ts
│   │   └── utils/
│   │       └── mystAdapter.ts
│   │
│   ├── block/               # block数据结构模块
│   │   ├── components/
│   │   │   ├── BlockInfo.tsx
│   │   │   └── BlockMetadata.tsx
│   │   ├── hooks/
│   │   │   └── useBlock.ts
│   │   └── types/
│   │       └── block.types.ts
│   │
│   ├── collaboration/        # 协作者和权限模块
│   │   ├── components/
│   │   │   ├── CollaboratorList.tsx
│   │   │   ├── PermissionManager.tsx
│   │   │   └── GrantEditor.tsx
│   │   ├── hooks/
│   │   │   └── useCollaboration.ts
│   │   └── store/
│   │       └── collaborationStore.ts
│   │
│   └── events/              # event模块
│       ├── components/
│       │   ├── EventList.tsx
│       │   ├── EventTimeline.tsx
│       │   ├── EventReplay.tsx
│       │   └── EventCompare.tsx
│       ├── hooks/
│       │   ├── useEvents.ts
│       │   └── useEventReplay.ts
│       ├── utils/
│       │   ├── eventParser.ts
│       │   ├── eventSorter.ts
│       │   └── eventSnapshot.ts
│       └── store/
│           └── eventStore.ts
│
├── components/              # 共享组件
│   ├── dashboard/           # 仪表板组件
│   ├── ui/                  # UI 基础组件库
│   └── layout/              # 布局组件（新增）
│
├── lib/                     # 核心库
│   ├── app-store.ts         # 主状态管理（简化，只保留核心状态）
│   ├── tauri-client.ts      # Tauri API 客户端
│   └── utils.ts
│
└── hooks/                   # 共享 Hooks
```

### 3.2 具体优化任务

#### 任务 1: .elf文件管理模块重构

**目标**: 将 `Projects.tsx` 从 mock 数据迁移到真实 API

**步骤**:
1. 创建 `features/file-management/store/fileStore.ts`
   - 管理项目列表状态
   - 实现项目 CRUD 操作
   - 集成 `tauri-client.ts` 的 FileOperations

2. 创建 `features/file-management/hooks/useFileList.ts`
   - 封装文件列表获取逻辑
   - 处理加载状态和错误

3. 重构 `pages/Projects.tsx`
   - 移除 mock 数据
   - 使用 `useFileList` hook
   - 连接真实的文件操作 API

4. 创建 `features/file-management/components/FileInfo.tsx`
   - 展示文件详细信息（名称、协作者、路径）
   - 增强 Dashboard 信息展示

**预计工作量**: 8 人时（创建 1h + 导入 1h + 重命名 3h + 删除 2h + 展示 3h）

#### 任务 2: directory extension 模块完善

**目标**: 完善目录管理功能，区分内部和外部目录

**步骤**:
1. 创建 `features/directory/store/directoryStore.ts`
   - 管理内部目录树状态
   - 管理外部目录列表
   - 实现目录 CRUD 操作

2. 拆分 `components/editor/FilePanel.tsx`
   - `DirectoryTree.tsx`: 内部目录树（基于 blocks）
   - `ExternalDirectory.tsx`: 外部目录（linked repos）
   - `DirectoryActions.tsx`: 目录操作按钮

3. 实现目录操作功能
   - 导入、创建、删除、重命名、刷新、导出
   - 集成到 Tauri API（需要后端支持）

**预计工作量**: 24 人时（基础能力 18h + 页面目录栏 12h）

#### 任务 3: markdown extension 模块优化

**目标**: 完善 markdown 编辑和显示功能

**步骤**:
1. 创建 `features/markdown/utils/mystAdapter.ts`
   - 实现 myst 语法适配
   - 处理数据格式转换

2. 优化 `EditorCanvas.tsx`
   - 集成 myst 适配器
   - 改进编辑体验

**预计工作量**: 12 人时（数据格式修改 6h + myst 语法适配 6h）

#### 任务 4: block数据结构增强

**目标**: 增强 block 数据结构，添加更多元数据

**步骤**:
1. 更新 `bindings.ts` 中的 Block 类型
   - 添加 title、owner、description、time 字段
   - 需要后端支持

2. 创建 `features/block/components/BlockMetadata.tsx`
   - 展示完整的 block 元数据
   - 增强 Info 页面

3. 更新 `components/editor/ContextPanel.tsx`
   - 使用新的 BlockMetadata 组件
   - 改进信息展示

**预计工作量**: 11 人时（数据结构修改 4h + 引擎修改 6h + 显示信息 7h）

#### 任务 5: 协作者和权限模块完善

**目标**: 完善协作者管理和权限显示

**步骤**:
1. 创建 `features/collaboration/components/CollaboratorList.tsx`
   - 协作者列表展示
   - 协作者增删功能

2. 创建 `features/collaboration/components/PermissionManager.tsx`
   - 权限管理界面
   - 权限显示优化

3. 集成到 `ContextPanel.tsx`
   - 使用新的协作组件

**预计工作量**: 6 人时（基础功能 2h + 权限显示 4h）

#### 任务 6: event模块完整实现

**目标**: 实现完整的 event 功能（解析、排序、回溯、显示）

**步骤**:
1. 创建 `features/events/utils/eventParser.ts`
   - 解析操作人员、名称、内容
   - 提取事件元数据

2. 创建 `features/events/utils/eventSorter.ts`
   - 实现事件排序逻辑
   - 支持多种排序方式

3. 创建 `features/events/utils/eventSnapshot.ts`
   - 实现快照功能
   - 状态保存和恢复

4. 创建 `features/events/components/EventReplay.tsx`
   - 实现回溯功能
   - 事件回放界面

5. 创建 `features/events/components/EventCompare.tsx`
   - 实现对比显示功能
   - 事件差异展示

6. 优化 `EventTimeline.tsx`
   - 增强列表显示
   - 改进交互体验

**预计工作量**: 32 人时（event解析 4h + event排序 7h + event回溯 13h + 显示和交互 14h）

### 3.3 状态管理优化

**当前问题**: `app-store.ts` 承担了太多职责

**优化方案**:
1. **保留核心状态**在 `app-store.ts`:
   - 当前文件管理（currentFileId）
   - 文件列表（files Map）
   - 选中的 block（selectedBlockId）

2. **功能模块状态**迁移到各自的 store:
   - `fileStore.ts`: 项目列表
   - `directoryStore.ts`: 目录树
   - `eventStore.ts`: 事件列表和状态
   - `collaborationStore.ts`: 协作者和权限

3. **使用 Zustand 的 slice 模式**:
   ```typescript
   // 每个功能模块独立 store
   export const useFileStore = create<FileStore>(...)
   export const useDirectoryStore = create<DirectoryStore>(...)
   ```

### 3.4 组件拆分建议

#### ContextPanel.tsx 拆分
```
ContextPanel.tsx (保留，作为容器)
├── BlockInfoTab.tsx      # Info 标签页
├── CollaboratorsTab.tsx  # 协作者标签页（已存在，需优化）
└── EventTimelineTab.tsx  # Timeline 标签页（已存在，需增强）
```

#### FilePanel.tsx 拆分
```
FilePanel.tsx (保留，作为容器)
├── InternalDirectory.tsx  # 内部目录（基于 blocks）
└── ExternalDirectory.tsx  # 外部目录（linked repos）
```

## 四、实施优先级

### Phase 1: 基础功能完善（高优先级）
1. ✅ .elf文件管理 - 连接真实 API（8h）
2. ✅ block数据结构 - 增强元数据（11h）
3. ✅ 协作者和权限 - 完善功能（6h）

**总计**: 25 人时

### Phase 2: 核心功能实现（中优先级）
4. ✅ directory extension - 完善目录管理（24h）
5. ✅ markdown extension - 优化编辑显示（12h）

**总计**: 36 人时

### Phase 3: 高级功能（低优先级）
6. ✅ event模块 - 完整实现（32h）

**总计**: 32 人时

## 五、迁移步骤

### Step 1: 创建功能模块目录结构
```bash
mkdir -p src/features/{file-management,directory,markdown,block,collaboration,events}/{components,hooks,store,utils,types}
```

### Step 2: 逐步迁移功能
1. 先迁移 .elf文件管理（影响最大）
2. 再迁移 directory extension
3. 最后完善 event 模块

### Step 3: 重构现有组件
1. 拆分大组件（ContextPanel、FilePanel）
2. 提取共享逻辑到 hooks
3. 统一状态管理

## 六、注意事项

1. **向后兼容**: 迁移过程中保持现有功能可用
2. **测试**: 每个模块迁移后都要进行测试
3. **文档**: 更新相关文档，说明新的代码结构
4. **性能**: 注意状态管理性能，避免不必要的重渲染

## 七、总结

当前代码结构与功能模块需求存在一定联系，但存在以下问题：
- 数据层与UI层分离不清晰
- 功能模块化不足
- 部分功能未实现或实现不完整

通过按功能模块重构代码结构，可以：
- 提高代码可维护性
- 便于功能扩展
- 明确职责划分
- 便于团队协作

建议按照优先级逐步实施，先完成基础功能，再实现高级功能。

