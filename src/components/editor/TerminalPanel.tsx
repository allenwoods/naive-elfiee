import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { listen } from '@tauri-apps/api/event'
import { useAppStore } from '@/lib/app-store'
import { Button } from '@/components/ui/button'
import { X, Minimize2, Maximize2, Terminal as TerminalIcon } from 'lucide-react'
import { toast } from 'sonner'
import '@xterm/xterm/css/xterm.css'
import './terminal-panel.css'

interface TerminalPanelProps {
  fileId: string
  onClose: () => void
}

export function TerminalPanel({ fileId, onClose }: TerminalPanelProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const [isMaximized, setIsMaximized] = useState(false)
  const [blockId, setBlockId] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const [editorId, setEditorId] = useState<string | null>(null)
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isPtyInitialized = useRef<boolean>(false)
  const isBlockCreated = useRef<boolean>(false)

  // Zustand Actions
  const createTerminalBlock = useAppStore((state) => state.createTerminalBlock)
  const initTerminal = useAppStore((state) => state.initTerminal)
  const writeToPty = useAppStore((state) => state.writeToPty)
  const resizePty = useAppStore((state) => state.resizePty)
  const saveTerminal = useAppStore((state) => state.saveTerminal)
  const closeTerminalSession = useAppStore(
    (state) => state.closeTerminalSession
  )
  const getActiveEditor = useAppStore((state) => state.getActiveEditor)
  const getBlocks = useAppStore((state) => state.getBlocks)

  // Create Terminal Block on mount
  useEffect(() => {
    // Prevent duplicate block creation
    if (isBlockCreated.current) {
      return
    }

    let isMounted = true

    const initTerminalBlock = async () => {
      try {
        // Get current active editor - use for both Block creation and PTY init
        const activeEditor = getActiveEditor(fileId)
        if (!activeEditor) {
          throw new Error('No active editor found')
        }

        // Only update state if component is still mounted
        if (!isMounted) return

        setEditorId(activeEditor.editor_id)

        const newBlockId = await createTerminalBlock(
          fileId,
          'Terminal Session',
          activeEditor.editor_id
        )

        // Only update state if component is still mounted
        if (!isMounted) return

        setBlockId(newBlockId)
        setIsInitializing(false)
        isBlockCreated.current = true
      } catch (error) {
        if (!isMounted) return
        console.error('Failed to create terminal block:', error)
        toast.error('Failed to create terminal session')
        onClose()
      }
    }

    initTerminalBlock()

    return () => {
      isMounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId])

  // Initialize terminal after block is created
  useEffect(() => {
    if (!terminalRef.current || !blockId || !editorId || isInitializing) return

    let isMounted = true

    // Create xterm instance with improved theme
    const term = new Terminal({
      fontFamily:
        '"Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, monospace',
      fontSize: 13,
      fontWeight: '400',
      lineHeight: 1.4,
      theme: {
        background: '#0a0a0a',
        foreground: '#e4e4e7',
        cursor: '#22d3ee',
        cursorAccent: '#0a0a0a',
        selectionBackground: '#334155', // Fixed: use selectionBackground instead of selection
        black: '#27272a',
        brightBlack: '#52525b',
        red: '#f87171',
        brightRed: '#fca5a5',
        green: '#4ade80',
        brightGreen: '#86efac',
        yellow: '#fbbf24',
        brightYellow: '#fde047',
        blue: '#60a5fa',
        brightBlue: '#93c5fd',
        magenta: '#c084fc',
        brightMagenta: '#d8b4fe',
        cyan: '#22d3ee',
        brightCyan: '#67e8f9',
        white: '#d4d4d8',
        brightWhite: '#fafafa',
      },
      scrollback: 10000,
      cursorBlink: true,
      cursorStyle: 'bar',
      allowTransparency: true,
      scrollOnUserInput: true, // Auto-scroll when user types
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(terminalRef.current)

    // Use requestAnimationFrame to ensure DOM is fully rendered before fitting
    requestAnimationFrame(() => {
      fitAddon.fit()

      // Small delay to ensure xterm.js has calculated correct dimensions
      setTimeout(() => {
        fitAddon.fit()
        xtermRef.current = term
        fitAddonRef.current = fitAddon

        // Initialize PTY with correct dimensions
        initTerminalSession(term)
          .then(() => {
            if (!isMounted) return
            // Mark PTY as initialized
            isPtyInitialized.current = true
            // After PTY init, send resize command to ensure backend has correct size
            return resizePty(
              fileId,
              blockId,
              term.cols,
              term.rows,
              editorId || undefined
            )
          })
          .catch((error) => {
            if (!isMounted) return
            console.error('Failed to initialize or resize PTY:', error)
          })
      }, 50)
    })

    // Listen for PTY output
    const unlistenPromise = listen<{ data: string; block_id: string }>(
      'pty-out',
      (event) => {
        if (event.payload.block_id === blockId) {
          // Decode base64 to UTF-8 properly (atob only handles Latin-1, corrupting UTF-8)
          const binaryString = atob(event.payload.data)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }
          const decoded = new TextDecoder('utf-8').decode(bytes)
          term.write(decoded)
        }
      }
    )

    // Listen for user input
    const disposable = term.onData((data) => {
      writeToPty(fileId, blockId, data, editorId || undefined).catch(
        (error) => {
          console.error('Failed to write to PTY:', error)
        }
      )
    })

    // Listen for xterm.js resize events (more reliable than window resize)
    const resizeDisposable = term.onResize(({ cols, rows }) => {
      // Only resize PTY if it has been initialized
      if (!isPtyInitialized.current) {
        return
      }
      resizePty(fileId, blockId, cols, rows, editorId || undefined).catch(
        (error) => {
          console.error('Failed to resize PTY:', error)
        }
      )
    })

    // Window resize handler
    const handleResize = () => {
      fitAddon.fit()
    }
    window.addEventListener('resize', handleResize)

    // Auto-save terminal content periodically
    const saveTerminalContent = async () => {
      try {
        const buffer = term.buffer.active
        const lines: string[] = []
        for (let i = 0; i < buffer.length; i++) {
          const line = buffer.getLine(i)
          if (line) {
            lines.push(line.translateToString(true))
          }
        }
        const content = lines.join('\n')
        await saveTerminal(fileId, blockId, content, editorId || undefined)
      } catch (error) {
        console.error('Failed to save terminal content:', error)
      }
    }

    // Save every 10 seconds
    saveIntervalRef.current = setInterval(saveTerminalContent, 10000)

    // Cleanup
    return () => {
      isMounted = false

      // Save one last time before cleanup
      saveTerminalContent()

      // Clear auto-save interval
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current)
        saveIntervalRef.current = null
      }

      // Reset PTY initialization flag
      isPtyInitialized.current = false

      disposable.dispose()
      resizeDisposable.dispose()
      unlistenPromise.then((fn) => fn())
      window.removeEventListener('resize', handleResize)
      term.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockId, editorId, fileId, isInitializing])

  const initTerminalSession = async (term: Terminal) => {
    if (!blockId || !editorId) return

    try {
      // Restore saved content if exists
      await restoreTerminalContent(term)

      // Initialize PTY session with the same editor that created the block
      await initTerminal(
        fileId,
        blockId,
        term.cols,
        term.rows,
        undefined, // cwd
        editorId // Use the same editor ID that created the block
      )
    } catch (error) {
      console.error('Failed to init terminal:', error)
      toast.error('Failed to initialize terminal')
    }
  }

  const restoreTerminalContent = async (term: Terminal) => {
    if (!blockId) return

    try {
      // Get block data
      const blocks = getBlocks(fileId)
      const terminalBlock = blocks.find((b) => b.block_id === blockId)

      if (terminalBlock && terminalBlock.contents) {
        const savedContent = (terminalBlock.contents as any).saved_content
        if (savedContent && typeof savedContent === 'string') {
          // Write saved content to terminal
          term.write(savedContent.replace(/\n/g, '\r\n'))
          term.write('\r\n') // Add newline after restored content
        }
      }
    } catch (error) {
      console.error('Failed to restore terminal content:', error)
      // Don't show error to user - it's OK if there's no saved content
    }
  }

  const handleToggleMaximize = () => {
    setIsMaximized(!isMaximized)
    setTimeout(() => fitAddonRef.current?.fit(), 300)
  }

  const handleClose = async () => {
    if (blockId) {
      try {
        // Save terminal content one last time
        if (xtermRef.current) {
          const buffer = xtermRef.current.buffer.active
          const lines: string[] = []
          for (let i = 0; i < buffer.length; i++) {
            const line = buffer.getLine(i)
            if (line) {
              lines.push(line.translateToString(true))
            }
          }
          const content = lines.join('\n')
          await saveTerminal(fileId, blockId, content, editorId || undefined)
        }

        // Close PTY session
        await closeTerminalSession(fileId, blockId, editorId || undefined)
      } catch (error) {
        console.error('Failed to close terminal:', error)
      }
    }
    onClose()
  }

  return (
    <div
      className={`flex flex-col border-t border-zinc-800/50 bg-[#0a0a0a] transition-all duration-300 ${
        isMaximized ? 'h-[70vh]' : 'h-[300px]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/50 bg-zinc-950/80 px-3 py-1.5 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <TerminalIcon className="h-3.5 w-3.5 text-cyan-400" />
          <span className="text-xs font-medium text-zinc-400">Terminal</span>
        </div>
        <div className="flex gap-0.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleToggleMaximize}
            className="h-6 w-6 p-0 text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300"
          >
            {isMaximized ? (
              <Minimize2 className="h-3 w-3" />
            ) : (
              <Maximize2 className="h-3 w-3" />
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleClose}
            className="h-6 w-6 p-0 text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Terminal Container */}
      {isInitializing ? (
        <div className="flex flex-1 items-center justify-center text-zinc-500">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent"></div>
            <span className="text-sm">Initializing terminal session...</span>
          </div>
        </div>
      ) : (
        <div
          ref={terminalRef}
          className="terminal-container flex-1 overflow-hidden p-2"
        />
      )}
    </div>
  )
}
