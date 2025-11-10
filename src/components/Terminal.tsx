/**
 * Terminal Component
 *
 * Integrates xterm.js to provide a terminal interface for executing commands.
 * Commands and outputs are recorded in the terminal block via the terminal.execute capability.
 */

import { useEffect, useRef, useState } from 'react'
import { Terminal as XTermTerminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { useAppStore } from '@/lib/app-store'
import { TauriClient } from '@/lib/tauri-client'
import '@xterm/xterm/css/xterm.css'

export function Terminal() {
  const { activeFileId, getActiveEditor, getSelectedBlock } = useAppStore()
  const terminalBlockIdRef = useRef<string | null>(null) // Use ref to access latest value in callbacks
  const currentDirectoryRef = useRef<string>('') // Current working directory
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTermTerminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)

  const writeTerminalOutput = (terminal: XTermTerminal, text: string) => {
    const normalized = text.replace(/\r\n/g, '\n')
    const ansiStripped = normalized.replace(
      // eslint-disable-next-line no-control-regex
      /\u001b\[[0-9;?]*[ -/]*[@-~]/g,
      ''
    )
    const cleaned = ansiStripped.replace(
      // eslint-disable-next-line no-control-regex
      /[^\t\n\x20-\x7E]/g,
      ''
    )
    if (!cleaned.trim()) return
    cleaned.split('\n').forEach((line) => {
      terminal.writeln(line)
    })
  }

  const writePrompt = (terminal: XTermTerminal, directory: string) => {
    const dir = directory || '.'
    const displayDir = dir.replace(/\\/g, '/')
    const cursorX = terminal.buffer.active.cursorX
    if (cursorX !== 0) {
      terminal.write('\r\n')
    }
    terminal.write(`${displayDir} $ `)
  }

  // Check if a block is selected
  const selectedBlock = activeFileId ? getSelectedBlock(activeFileId) : null

  // Initialize terminal and load history
  useEffect(() => {
    if (!activeFileId) {
      setIsInitializing(false)
      return
    }

    // Check if block is selected - wait a bit for selectedBlock to be available
    if (!selectedBlock) {
      // Don't immediately fail, give it a chance to load
      const timeout = setTimeout(() => {
        const currentSelectedBlock = getSelectedBlock(activeFileId)
        if (!currentSelectedBlock) {
          setIsInitializing(false)
        }
      }, 200) // Increased timeout for better reliability
      return () => clearTimeout(timeout)
    }

    let isMounted = true
    let cleanupResize: (() => void) | null = null
    
    const initTerminal = async () => {
      try {
        setIsInitializing(true)
        
        // Initialize xterm.js FIRST before async operations for faster display
        if (terminalRef.current && !xtermRef.current) {
          const terminal = new XTermTerminal({
            theme: {
              background: '#000000',
              foreground: '#00ff00',
              cursor: '#00ff00',
            },
            fontSize: 14,
            fontFamily: 'Consolas, "Courier New", monospace',
            cursorBlink: true,
          })

          const fitAddon = new FitAddon()
          terminal.loadAddon(fitAddon)
          terminal.open(terminalRef.current)
          fitAddon.fit()

          xtermRef.current = terminal
          fitAddonRef.current = fitAddon

          // Write welcome message immediately so user sees something
          terminal.writeln('Welcome to Elfiee Terminal!')
          terminal.writeln('Initializing...')
          terminal.write('\r\n$ ')

          // Handle window resize
          const handleResize = () => {
            if (fitAddonRef.current) {
              fitAddonRef.current.fit()
            }
          }
          window.addEventListener('resize', handleResize)
          cleanupResize = () => {
            window.removeEventListener('resize', handleResize)
          }
        }
        
        // Get all blocks
        console.log('Terminal: Loading blocks for file:', activeFileId)
        const blocks = await TauriClient.block.getAllBlocks(activeFileId)
        console.log('Terminal: Found blocks:', blocks)
        
        if (!isMounted || !xtermRef.current) {
          setIsInitializing(false)
          return
        }
        
        // Find existing terminal block
        let terminalBlock = blocks.find(b => b.block_type === 'terminal')
        
        if (!terminalBlock) {
          // Create new terminal block
          const editor = getActiveEditor(activeFileId)
          if (!editor) {
            console.error('No active editor found')
            setIsInitializing(false)
            return
          }

          const newBlockId = crypto.randomUUID()
          await TauriClient.block.createBlock(
            activeFileId,
            newBlockId,
            'Terminal',
            'terminal',
            editor.editor_id
          )
          
          if (!isMounted) return
          
          // Reload blocks to get the new block
          const updatedBlocks = await TauriClient.block.getAllBlocks(activeFileId)
          
          if (!isMounted) return
          
          terminalBlock = updatedBlocks.find(b => b.block_id === newBlockId)
          
          if (!terminalBlock) {
            console.error('Failed to create terminal block')
            setIsInitializing(false)
            return
          }
        }

        // Update ref with block ID
        terminalBlockIdRef.current = terminalBlock.block_id

        // Get or set current directory from terminal block contents
        let currentDir = '.'
        if (terminalBlock.contents && typeof terminalBlock.contents === 'object') {
          const contents = terminalBlock.contents as any
          if (contents.current_directory) {
            currentDir = contents.current_directory
          }
        }
        currentDirectoryRef.current = currentDir

        // Update terminal display with actual directory
        const terminal = xtermRef.current
        if (!terminal) {
          setIsInitializing(false)
          return
        }

        terminal.clear()
        terminal.writeln('Welcome to Elfiee Terminal!')
        terminal.writeln(`Current directory: ${currentDir}`)
        terminal.writeln('Type any command to execute.')
        writePrompt(terminal, currentDir)

        // Load and display history (non-blocking)
        setTimeout(async () => {
          if (xtermRef.current && isMounted) {
            try {
              const history = await TauriClient.terminal.getTerminalHistory(activeFileId, terminalBlock.block_id)
              if (history.length > 0) {
                xtermRef.current.writeln('')
                xtermRef.current.writeln('--- Command History ---')
                history.forEach((entry) => {
                  xtermRef.current?.writeln(`$ ${entry.command}`)
                  if (entry.output) {
                    writeTerminalOutput(xtermRef.current!, entry.output)
                  }
                  if (entry.exit_code !== 0) {
                    xtermRef.current?.writeln(`(exit code ${entry.exit_code})`)
                  }
                  xtermRef.current?.writeln('')
                })
              }
              writePrompt(xtermRef.current, currentDir)
            } catch (error) {
              console.error('Failed to load terminal history:', error)
              writePrompt(xtermRef.current, currentDir)
            }
          }
        }, 100)

        // Define command handler inside initialization to access latest blockId
        const handleCommand = async (command: string) => {
          if (!command.trim()) return

          const currentBlockId = terminalBlockIdRef.current
          if (!activeFileId || !currentBlockId) {
            terminal.writeln('Terminal not initialized. Please wait...')
            return
          }

          const editor = getActiveEditor(activeFileId)
          if (!editor) {
            terminal.writeln('Error: No active editor found')
            return
          }

          try {
            // No special handling needed - let all commands go through the backend
            // The backend will handle ls, pwd, cd and other system commands properly

            // Debug info
            console.log('Terminal: Executing command:', {
              command,
              fileId: activeFileId,
              blockId: currentBlockId,
              editorId: editor.editor_id
            })
            
            // Execute command using new TauriClient.terminal interface
            const events = await TauriClient.terminal.executeCommand(
              activeFileId,
              currentBlockId,
              command,
              editor.editor_id
            )
            
            console.log('Terminal: Command execution result:', events)
            
            // Get updated terminal state
            const terminalState = await TauriClient.terminal.getTerminalState(activeFileId, currentBlockId)

            // Update current directory
            currentDirectoryRef.current = terminalState.currentDirectory
            
            // Display command output
            if (terminalState.history.length > 0) {
              const latestEntry = terminalState.history[terminalState.history.length - 1]
              
              // Show the executed command for clarity
              console.log('Terminal: Latest history entry:', latestEntry)
              
              const commandText = latestEntry.command.trim().toLowerCase()

              if (latestEntry.exit_code !== 0) {
                terminal.writeln('[command failed]')
                terminal.writeln(`Exit code: ${latestEntry.exit_code}`)
              } else if (latestEntry.output && latestEntry.output.trim()) {
                writeTerminalOutput(terminal, latestEntry.output)
              } else if (!commandText.startsWith('cd')) {
                terminal.writeln('[command completed]')
              }
            } else {
              // No history found - this might indicate a problem
              console.warn('Terminal: No history entries found after command execution')
              terminal.writeln('Command executed but no history was returned.')
            }
            
          } catch (error) {
            console.error('Terminal: Command execution failed:', error)
            terminal.writeln(`Error: ${error instanceof Error ? error.message : String(error)}`)
          }
        }

        // Handle user input
        let currentLine = ''
        let isProcessingCommand = false
        
        terminal.onData(async (data) => {
          // Don't process input while a command is executing
          if (isProcessingCommand) {
            return
          }
          
          const code = data.charCodeAt(0)

          // Enter key
          if (code === 13) {
            const command = currentLine.trim()
            currentLine = ''
            
            if (command) {
              terminal.write('\r\n')
              isProcessingCommand = true
              
              try {
                // Execute command and wait for it to complete
                await handleCommand(command)
              } catch (error) {
                terminal.writeln(`Error: ${error instanceof Error ? error.message : String(error)}`)
              } finally {
                // Update prompt with current directory after command completes
                const currentDir = currentDirectoryRef.current || 'block-root'
                writePrompt(terminal, currentDir)
                isProcessingCommand = false
              }
            } else {
              // Empty command, just show prompt
              terminal.write('\r\n')
              const currentDir = currentDirectoryRef.current || 'block-root'
              writePrompt(terminal, currentDir)
            }
            return
          }

          // Backspace
          if (code === 127) {
            if (currentLine.length > 0) {
              currentLine = currentLine.slice(0, -1)
              terminal.write('\b \b')
            }
            return
          }

          // Ctrl+C
          if (code === 3) {
        terminal.write('^C')
        const currentDir = currentDirectoryRef.current || 'block-root'
        writePrompt(terminal, currentDir)
            currentLine = ''
            return
          }

          // Ctrl+L (clear)
          if (code === 12) {
            terminal.clear()
            const currentDir = currentDirectoryRef.current || 'block-root'
            writePrompt(terminal, currentDir)
            currentLine = ''
            return
          }

          // Regular character
          if (data >= String.fromCharCode(32) && data <= String.fromCharCode(126)) {
            currentLine += data
            terminal.write(data)
          }
        })

        // Mark as initialized - only after everything is set up
        setIsInitializing(false)
      } catch (error) {
        console.error('Failed to initialize terminal:', error)
        setIsInitializing(false)
      }
    }

    initTerminal()

    // Cleanup function for useEffect
    return () => {
      isMounted = false
      if (cleanupResize) {
        cleanupResize()
      }
      if (xtermRef.current) {
        xtermRef.current.dispose()
        xtermRef.current = null
        fitAddonRef.current = null
      }
      setIsInitializing(false)
    }
  }, [activeFileId, selectedBlock, getActiveEditor, getSelectedBlock])


  if (!activeFileId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground text-center">
          <p className="text-lg font-medium">No file selected</p>
          <p className="text-sm">Open a file to use the terminal</p>
        </div>
      </div>
    )
  }

  if (!selectedBlock) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground text-center">
          <p className="text-lg font-medium">No block selected</p>
          <p className="text-sm">Please select a block first to use the terminal</p>
          <p className="text-xs mt-2">The terminal will start in the selected block's directory</p>
        </div>
      </div>
    )
  }

  if (isInitializing) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground text-center">
          <p className="text-sm">Initializing terminal...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full p-2">
      <div ref={terminalRef} className="h-full w-full" />
    </div>
  )
}
