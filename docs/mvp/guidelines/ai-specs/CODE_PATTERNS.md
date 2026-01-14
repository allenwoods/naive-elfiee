# 🧩 Code Patterns (Copy-Paste Ready)

## Frontend: Zustand Action Pattern

```typescript
// src/lib/app-store.ts
import { create } from 'zustand';
import { TauriClient } from '@/lib/tauri-client';
import type { MyPayload } from '@/bindings'; // Import from bindings

export const useAppStore = create<AppStore>((set, get) => ({
  // Define State
  blocks: new Map(),

  // Define Action
  myAction: async (fileId: string, param: string) => {
    try {
        // 1. Construct Payload (Type-Safe)
        const payload: MyPayload = { field: param };

        // 2. Call TauriClient (ONLY here)
        await TauriClient.block.executeCommand(fileId, {
            // ... standard command fields
            payload: payload as any
        });

        // 3. Update Local State (after success)
        // Usually by reloading the block or updating the Map manually if safe
        await get().loadAllBlocks(fileId); 
    } catch (e) {
        console.error(e);
        throw e; // Let component handle UI feedback
    }
  }
}));
```

## Frontend: Component Pattern

```tsx
// src/components/MyComponent.tsx
import { useAppStore } from '@/lib/app-store';
import { toast } from '@/hooks/use-toast';

export function MyComponent({ fileId }: { fileId: string }) {
  // 1. Select State & Actions
  const myAction = useAppStore(s => s.myAction);

  // 2. Event Handler
  const handleClick = async () => {
    try {
      await myAction(fileId, "data");
      toast({ title: "Success" });
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return <button onClick={handleClick}>Click Me</button>;
}
```

## Backend: Command Registration Pattern

```rust
// src-tauri/src/lib.rs

// 1. Debug Block
#[cfg(debug_assertions)]
let builder = {
    let specta_builder = tauri_specta::Builder::<tauri::Wry>::new()
        .commands(tauri_specta::collect_commands![
            // ... existing commands
            commands::my_module::my_new_command, // <--- ADD HERE
        ])
        .typ::<commands::my_module::MyPayload>() // <--- ADD TYPE HERE
        // ...
};

// 2. Release Block
#[cfg(not(debug_assertions))]
let builder = builder.invoke_handler(tauri::generate_handler![
    // ... existing commands
    commands::my_module::my_new_command, // <--- ADD HERE (MUST MATCH DEBUG)
]);
```

## Backend: Extension Scaffolding (elfiee-ext-gen)

AI SHOULD use this tool to start any new extension or capability.

```bash
# 1. Install/Update generator (if needed)
cargo install --path elfiee-ext-gen --force

# 2. Create scaffolding (TDD style)
# -n: name, -b: block_type, -c: capability_list
elfiee-ext-gen create -n my_ext -b my_type -c action1,action2

# 3. Analyze status and get next steps
elfiee-ext-gen guide my_ext

# 4. Run tests (in src-tauri)
cd src-tauri
cargo test my_ext::tests -- --nocapture

# 5. Validate structure and registration
cd ..
elfiee-ext-gen validate my_ext
```

## Backend: Capability Handler Pattern

```rust
// src/extensions/my_extension/mod.rs

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct MyPayload {
    pub content: String,
}

#[capability(id = "my.write", target = "my_type")]
fn handle_write(cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    let block = block.ok_or("Block required")?;
    
    // 1. Parse Payload safely
    let payload: MyPayload = serde_json::from_value(cmd.payload.clone())?;
    
    // 2. Create Event (Don't mutate block)
    let event = create_event(
        block.block_id.clone(), // Entity = block_id (for writes)
        cmd.cap_id.as_str(),
        json!({ "content": payload.content }),
        &cmd.editor_id,
        1
    )?;
    
    Ok(vec![event])
}
```