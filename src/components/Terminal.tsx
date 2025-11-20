import { useEffect, useMemo, useRef, useState } from 'react'
import { Terminal as XTermTerminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { useAppStore } from '@/lib/app-store'
import { TauriClient } from '@/lib/tauri-client'
import type { Block } from '@/lib/tauri-client'
import '@xterm/xterm/css/xterm.css'

const TERMINAL_THEME = {
  background: '#000000',
  foreground: '#00ff00',
  cursor: '#00ff00',
}

function writeTerminalOutput(term: XTermTerminal, text: string) {
  const normalized = text.replace(/\r\n/g, '\n')
  const stripped = normalized.replace(
    // eslint-disable-next-line no-control-regex
    /\u001b\[[0-9;?]*[ -/]*[@-~]/g,
    ''
  )
  const cleaned = stripped.replace(
    // eslint-disable-next-line no-control-regex
    /[^\t\n\x20-\x7E]/g,
    ''
  )
  if (!cleaned.trim()) return
  cleaned.split('\n').forEach((line) => term.writeln(line))
}

function writePrompt(term: XTermTerminal, directory: string) {
  const dir = (directory || '.').replace(/\\/g, '/')
  if (term.buffer.active.cursorX !== 0) {
    term.write('\r\n')
  }
  term.write(`${dir} $ `)
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
    currentDirectory: contents.current_directory || '.',
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
  const currentDirectoryRef = useRef<string>('.')
  
  // 移除Markdown快照相关的状态管理 - 不再需要

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

  // Initialise terminal
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
      }
      window.addEventListener('resize', handleResize)
      resizeListener = () => window.removeEventListener('resize', handleResize)

      // Load existing terminal block
      let blocks = await TauriClient.block.getAllBlocks(activeFileId)
      let terminalBlock = blocks.find((b) => b.block_type === 'terminal')

      if (!terminalBlock) {
        // This should not happen as we check for selectedBlock above,
        // but guard against edge cases
        term.writeln('Error: No terminal block found.')
        setIsInitializing(false)
        return
      }

      terminalBlockIdRef.current = terminalBlock.block_id

      let initialDirectory = '.'
      let blockDir: string | null = null
      let shouldSetRootPath = false
      
      if (
        terminalBlock.contents &&
        typeof terminalBlock.contents === 'object'
      ) {
        const contents = terminalBlock.contents as any

        // First check for _block_dir (injected by backend)
        if (contents._block_dir && typeof contents._block_dir === 'string') {
          blockDir = contents._block_dir
          // For display in prompt, use current_directory if available, otherwise "."
          initialDirectory = contents.current_directory || '.'
          
          // Always ensure root_path is set to _block_dir for consistency
          if (!contents.root_path || contents.root_path !== contents._block_dir) {
            shouldSetRootPath = true
          }
        }
        // Fallback to current_directory if _block_dir is not available
        else if (contents.current_directory) {
          initialDirectory = contents.current_directory
        }
      }
      currentDirectoryRef.current = initialDirectory
      
      // If we need to set the root_path to the block directory, do it now
      if (shouldSetRootPath && blockDir) {
        try {
          const editor = getActiveEditor(activeFileId)
          await TauriClient.terminal.writeToTerminal(
            activeFileId,
            terminalBlock.block_id,
            {
              root_path: blockDir,
              current_path: blockDir,
              current_directory: '.'
            },
            editor?.editor_id || 'default-editor'
          )
        } catch (error) {
          console.warn('Failed to set terminal root path:', error)
        }
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
          if (line.trim()) {
            // Skip empty lines
            term.writeln(line)
          }
        })

        term.writeln('')
        term.writeln('=== Continue Session ===')
      } else {
        // Default welcome message for new terminal
        term.writeln('Welcome to Elfiee Terminal!')
        if (blockDir) {
          term.writeln(`Block directory: ${blockDir}`)
          term.writeln(`Working directory: ${initialDirectory}`)
        } else {
          term.writeln(`Current directory: ${initialDirectory}`)
        }
        term.writeln('Type any command to execute.')
      }

      writePrompt(term, initialDirectory)

      // Show command history if available (but don't duplicate if we restored content)
      if (!saveInfo) {
        const history = await TauriClient.terminal.getTerminalHistory(
          activeFileId,
          terminalBlock.block_id
        )

        if (history.length > 0) {
          term.writeln('')
          term.writeln('--- Command History ---')
          history.forEach((entry) => {
            term.writeln(`$ ${entry.command}`)
            if (entry.output) {
              writeTerminalOutput(term, entry.output)
            }
            if (entry.exit_code !== 0) {
              term.writeln(`(exit code ${entry.exit_code})`)
            }
            term.writeln('')
          })
          writePrompt(term, currentDirectoryRef.current)
          requestAnimationFrame(() => {
            safeFit()
          })
        }
      }

      let inputBuffer = ''
      let executing = false

      const runCommand = async (command: string) => {
        if (!command) {
          writePrompt(term, currentDirectoryRef.current)
          return
        }

        const blockId = terminalBlockIdRef.current
        if (!blockId) {
          term.writeln('Terminal not ready.')
          writePrompt(term, currentDirectoryRef.current)
          return
        }

        const editor = getActiveEditor(activeFileId)
        if (!editor) {
          term.writeln('Error: no active editor.')
          writePrompt(term, currentDirectoryRef.current)
          return
        }

        try {
          await TauriClient.terminal.executeCommand(
            activeFileId,
            blockId,
            command,
            editor.editor_id
          )

          const state = await TauriClient.terminal.getTerminalState(
            activeFileId,
            blockId
          )

          currentDirectoryRef.current = state.currentDirectory || '.'

          if (state.history.length > 0) {
            const latestEntry = state.history[state.history.length - 1]
            const normalizedCommand = latestEntry.command.trim().toLowerCase()

            if (latestEntry.exit_code !== 0) {
              term.writeln('[command failed]')
              term.writeln(`Exit code: ${latestEntry.exit_code}`)
            } else if (latestEntry.output && latestEntry.output.trim()) {
              writeTerminalOutput(term, latestEntry.output)
            } else if (!normalizedCommand.startsWith('cd')) {
              term.writeln('[command completed]')
            }
          }
        } catch (err) {
          term.writeln(
            `Error: ${err instanceof Error ? err.message : String(err)}`
          )
        } finally {
          writePrompt(term, currentDirectoryRef.current)
          requestAnimationFrame(() => {
            safeFit()
          })
        }
      }

      disposeData = term.onData((data) => {
        if (executing) {
          return
        }
        const code = data.charCodeAt(0)

        if (code === 13) {
          term.write('\r\n')
          executing = true
          const command = inputBuffer.trim()
          inputBuffer = ''
          runCommand(command).finally(() => {
            executing = false
          })
          return
        }

        if (code === 127) {
          if (inputBuffer.length > 0) {
            inputBuffer = inputBuffer.slice(0, -1)
            term.write('\b \b')
          }
          return
        }

        if (code === 3) {
          term.write('^C')
          term.write('\r\n')
          inputBuffer = ''
          writePrompt(term, currentDirectoryRef.current)
          requestAnimationFrame(() => safeFit())
          return
        }

        if (code === 12) {
          term.clear()
          writePrompt(term, currentDirectoryRef.current)
          inputBuffer = ''
          requestAnimationFrame(() => safeFit())
          return
        }

        if (data >= ' ' && data <= '~') {
          inputBuffer += data
          term.write(data)
        }
      })

      if (!cancelled) {
        setIsInitializing(false)
      }
    }

    setup()

    return () => {
      cancelled = true
      if (disposeData) disposeData.dispose()
      if (resizeListener) resizeListener()
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
      // 1. 获取当前terminal的可视化内容
      const buffer = term.buffer.active
      const terminalLines: string[] = []

      // 提取terminal缓冲区中的所有行
      for (let i = 0; i < buffer.length; i++) {
        const line = buffer.getLine(i)
        if (line) {
          terminalLines.push(line.translateToString(true))
        }
      }

      // 合并为完整的terminal内容文本
      const terminalContent = terminalLines.join('\n')

      // 2. 保存terminal内容到Terminal Block（仅此一步）
      const saveCmd = {
        cmd_id: crypto.randomUUID(),
        editor_id: editor.editor_id,
        cap_id: 'terminal.write',
        block_id: terminalBlockIdRef.current,
        payload: {
          saved_content: terminalContent,
          saved_at: new Date().toISOString(),
          current_directory: currentDirectoryRef.current,
        },
        timestamp: new Date().toISOString(),
      }

      await TauriClient.block.executeCommand(activeFileId, saveCmd)

      // 3. 显示成功通知
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
