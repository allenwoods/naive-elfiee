import { useEffect, useMemo, useRef, useState } from 'react'
import { Terminal as XTermTerminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { useAppStore } from '@/lib/app-store'
import { TauriClient } from '@/lib/tauri-client'
import type { Block } from '@/lib/tauri-client'
import { listen } from '@tauri-apps/api/event'
import '@xterm/xterm/css/xterm.css'

const TERMINAL_THEME = {
  background: '#000000',
  foreground: '#00ff00',
  cursor: '#00ff00',
}

// Helper function to check if a terminal block has saved content
function getTerminalSaveInfo(block: Block) {
  if (!block.contents || typeof block.contents !== 'object') {
    return null
  }

  const contents = block.contents as any
  if (
    !contents.saved_content ||
    typeof contents.saved_content !== 'string' ||
    contents.saved_content.trim().length === 0
  ) {
    return null
  }

  return {
    hasContent: true,
    savedContent: contents.saved_content,
    savedAt: contents.saved_at ? new Date(contents.saved_at) : null,
    contentLength: contents.saved_content.length,
    lineCount: contents.saved_content.split('\n').length,
  }
}

export function Terminal() {
  const {
    activeFileId,
    getSelectedBlock,
    getActiveEditor,
    getActiveFile,
    selectBlock,
    addNotification,
  } = useAppStore()

  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTermTerminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const terminalBlockIdRef = useRef<string | null>(null)
  const ptyInitializedRef = useRef<boolean>(false)

  const [isInitializing, setIsInitializing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const selectedBlock = useMemo(
    () => (activeFileId ? getSelectedBlock(activeFileId) : null),
    [activeFileId, getSelectedBlock]
  )

  // Auto-select terminal block when available (but don't create)
  useEffect(() => {
    if (!activeFileId) return
    if (selectedBlock) return

    const activeFile = getActiveFile()
    const terminalBlock = activeFile?.blocks.find(
      (block: Block) => block.block_type === 'terminal'
    )
    if (terminalBlock) {
      selectBlock(activeFileId, terminalBlock.block_id)
    }
  }, [activeFileId, selectedBlock, getActiveFile, selectBlock])

  // Initialize terminal with PTY
  useEffect(() => {
    if (!activeFileId || !selectedBlock) {
      return
    }

    const element = terminalRef.current
    if (!element) {
      return
    }

    let disposeData: { dispose: () => void } | null = null
    let resizeListener: (() => void) | null = null
    let ptyOutputListener: (() => void) | null = null
    let cancelled = false

    const setup = async () => {
      setIsInitializing(true)

      // Dispose existing instance if any
      if (xtermRef.current) {
        try {
          xtermRef.current.dispose()
        } catch (err) {
          console.warn('Terminal: failed to dispose existing instance', err)
        }
        xtermRef.current = null
        fitAddonRef.current = null
      }

      const term = new XTermTerminal({
        theme: TERMINAL_THEME,
        fontSize: 14,
        fontFamily: 'Consolas, "Courier New", monospace',
        cursorBlink: true,
      })
      const fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.open(element)

      const safeFit = () => {
        if (!terminalRef.current || !fitAddonRef.current) return
        const rect = terminalRef.current.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) {
          return
        }
        try {
          fitAddonRef.current.fit()
        } catch (err) {
          console.warn('Terminal: fit failed', err)
        }
      }

      requestAnimationFrame(() => {
        safeFit()
      })

      xtermRef.current = term
      fitAddonRef.current = fitAddon

      const handleResize = () => {
        safeFit()
        // Also notify PTY of resize
        if (terminalBlockIdRef.current && fitAddon) {
          const dims = fitAddon.proposeDimensions()
          if (dims) {
            TauriClient.terminal
              .resizePty(terminalBlockIdRef.current, dims.rows, dims.cols)
              .catch((err) => console.error('PTY resize failed:', err))
          }
        }
      }
      window.addEventListener('resize', handleResize)
      resizeListener = () => window.removeEventListener('resize', handleResize)

      // Load existing terminal block
      let blocks = await TauriClient.block.getAllBlocks(activeFileId)
      let terminalBlock = blocks.find((b) => b.block_type === 'terminal')

      if (!terminalBlock) {
        term.writeln('Error: No terminal block found.')
        setIsInitializing(false)
        return
      }

      terminalBlockIdRef.current = terminalBlock.block_id

      // Fetch the block again to ensure _block_dir is injected by the backend
      // The backend injects _block_dir at runtime when a block is retrieved
      try {
        terminalBlock = await TauriClient.block.getBlock(
          activeFileId,
          terminalBlock.block_id
        )
      } catch (err) {
        console.warn('Failed to refetch block:', err)
        // Continue with existing block data
      }

      // Check if there's saved terminal content to restore
      const saveInfo = getTerminalSaveInfo(terminalBlock)

      if (saveInfo) {
        // Restore from saved content
        term.writeln('=== Restored Terminal Session ===')
        if (saveInfo.savedAt) {
          term.writeln(`Saved at: ${saveInfo.savedAt.toLocaleString()}`)
        }
        term.writeln(
          `Content: ${saveInfo.lineCount} lines, ${saveInfo.contentLength} characters`
        )
        term.writeln('')

        // Display the saved content line by line
        const lines = saveInfo.savedContent.split('\n')
        lines.forEach((line: string) => {
          term.writeln(line)
        })

        term.writeln('')
        term.writeln('=== Starting New Session ===')
        term.writeln('')
      }

      // Listen for PTY output
      const unlistenPty = await listen('pty-out', (event: any) => {
        const payload = event.payload as { data: string; block_id: string }
        if (payload.block_id === terminalBlockIdRef.current) {
          // Decode Base64 properly for binary data
          try {
            // Decode Base64 to binary string
            const binaryString = atob(payload.data)
            // Convert to Uint8Array
            const bytes = new Uint8Array(binaryString.length)
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i)
            }
            // Write directly as Uint8Array (xterm.js handles it)
            term.write(bytes)
          } catch (err) {
            console.error('Failed to decode PTY output:', err)
          }
        }
      })
      ptyOutputListener = () => unlistenPty()

      // Initialize PTY session
      try {
        const editor = getActiveEditor(activeFileId)
        const dims = fitAddon.proposeDimensions()

        // Get working directory from block contents (injected by backend at runtime)
        const blockContents = terminalBlock.contents as any
        console.log('[Terminal] Block contents:', blockContents)
        const workingDir = blockContents?._block_dir as string | undefined
        console.log('[Terminal] Working directory:', workingDir)

        if (workingDir) {
          term.writeln(`Block directory: ${workingDir}`)
        }

        await TauriClient.terminal.initTerminal(
          terminalBlock.block_id,
          editor?.editor_id || 'default-editor',
          dims?.rows || 24,
          dims?.cols || 80,
          workingDir // Pass working directory to PTY
        )

        ptyInitializedRef.current = true
        term.writeln('PTY session initialized.')
      } catch (err) {
        term.writeln(`Failed to initialize PTY: ${err}`)
        setIsInitializing(false)
        return
      }

      // Handle user input - send directly to PTY
      disposeData = term.onData((data) => {
        if (!ptyInitializedRef.current || !terminalBlockIdRef.current) return

        TauriClient.terminal
          .writeToPty(terminalBlockIdRef.current, data)
          .catch((err) => console.error('PTY write failed:', err))
      })

      if (!cancelled) {
        setIsInitializing(false)
      }
    }

    setup()

    return () => {
      cancelled = true
      ptyInitializedRef.current = false
      if (disposeData) disposeData.dispose()
      if (resizeListener) resizeListener()
      if (ptyOutputListener) ptyOutputListener()
      if (xtermRef.current) {
        try {
          xtermRef.current.dispose()
        } catch (err) {
          console.warn('Terminal: dispose failed', err)
        }
        xtermRef.current = null
      }
      fitAddonRef.current = null
      terminalBlockIdRef.current = null
    }
  }, [activeFileId, selectedBlock, getActiveEditor, selectBlock])

  const saveTerminalContent = async () => {
    if (!activeFileId) {
      addNotification('error', '没有打开的文件。')
      return
    }

    if (!terminalBlockIdRef.current) {
      addNotification('error', '终端会话尚未初始化。')
      return
    }

    const editor = getActiveEditor(activeFileId)
    if (!editor) {
      addNotification('error', '没有活跃的编辑器。')
      return
    }

    const term = xtermRef.current
    if (!term) {
      addNotification('error', '终端未初始化。')
      return
    }

    setIsSaving(true)

    try {
      // 获取terminal缓冲区内容
      const buffer = term.buffer.active
      const terminalLines: string[] = []

      for (let i = 0; i < buffer.length; i++) {
        const line = buffer.getLine(i)
        if (line) {
          terminalLines.push(line.translateToString(true))
        }
      }

      const terminalContent = terminalLines.join('\n')

      // 保存到 block
      await TauriClient.terminal.saveSession(
        activeFileId,
        terminalBlockIdRef.current,
        terminalContent,
        editor.editor_id
      )

      addNotification('success', '终端内容已保存到 Block 中。')
    } catch (err) {
      console.error(err)
      addNotification(
        'error',
        `保存终端内容失败: ${err instanceof Error ? err.message : String(err)}`
      )
    } finally {
      setIsSaving(false)
    }
  }

  if (!activeFileId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground text-center">
          <p className="text-lg font-medium">No file selected</p>
          <p className="text-sm">Open a file to use the terminal.</p>
        </div>
      </div>
    )
  }

  // Check if selected block is a terminal block
  const isTerminalBlock = selectedBlock?.block_type === 'terminal'

  if (!selectedBlock || !isTerminalBlock) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground max-w-md text-center">
          <p className="mb-2 text-lg font-medium">终端需要Terminal Block</p>
          <p className="mb-4 text-sm">
            请先创建一个类型为"terminal"的Block，然后选中它来使用终端功能。
          </p>
          <div className="bg-muted rounded p-3 text-xs">
            <p className="mb-1 font-medium">如何创建Terminal Block：</p>
            <p>1. 在Block列表中点击"创建新Block"</p>
            <p>2. 选择Block类型为"terminal"</p>
            <p>3. 创建后选中该Block即可使用终端</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="bg-muted/50 flex items-center justify-end border-b px-4 py-2">
        <button
          onClick={saveTerminalContent}
          disabled={isSaving || !terminalBlockIdRef.current}
          className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
            isSaving
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
      <div className="relative flex-1 bg-black p-2">
        <div ref={terminalRef} className="h-full w-full" />
        {isInitializing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-green-400">
            Initialising terminal...
          </div>
        )}
      </div>
    </div>
  )
}
