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
import type { TerminalExecutePayload } from '@/bindings'
import '@xterm/xterm/css/xterm.css'

export function Terminal() {
  const { activeFileId, getActiveEditor, getSelectedBlock } = useAppStore()
  const terminalBlockIdRef = useRef<string | null>(null) // Use ref to access latest value in callbacks
  const currentDirectoryRef = useRef<string>('') // Current working directory
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTermTerminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)

  // Check if a block is selected
  const selectedBlock = activeFileId ? getSelectedBlock(activeFileId) : null

  // Initialize terminal and load history
  useEffect(() => {
    if (!activeFileId) {
      setIsInitializing(false)
      return
    }

    // Check if block is selected
    if (!selectedBlock) {
      setIsInitializing(false)
      // Don't initialize terminal if no block is selected
      return
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
        const blocks = await TauriClient.block.getAllBlocks(activeFileId)
        
        if (!isMounted || !xtermRef.current) {
          setIsInitializing(false)
          return
        }
        
        // Find existing terminal block
        let terminalBlock = blocks.find(b => b.block_type === 'terminal')
        
        // Get block directory path: block-{block_id}
        const blockDirectory = `block-${selectedBlock.block_id}`
        
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
        let currentDir = blockDirectory
        if (terminalBlock.contents && typeof terminalBlock.contents === 'object') {
          const contents = terminalBlock.contents as any
          if (contents.current_directory) {
            currentDir = contents.current_directory
          } else {
            currentDir = blockDirectory
          }
        }
        currentDirectoryRef.current = currentDir

        // Update terminal display with actual directory
        const terminal = xtermRef.current
        if (!terminal) {
          setIsInitializing(false)
          return
        }

        // Clear the "Initializing..." line and update
        terminal.write('\x1b[2K\r') // Clear current line
        terminal.write('\x1b[A') // Move up one line  
        terminal.write('\x1b[2K\r') // Clear that line
        terminal.writeln('Welcome to Elfiee Terminal!')
        terminal.writeln(`Current directory: ${currentDir}`)
        terminal.writeln('Type any command to execute.')
        terminal.write(`\r\n${currentDir} $ `)

        // Load and display history (non-blocking)
        if (terminalBlock.contents && typeof terminalBlock.contents === 'object') {
          const contents = terminalBlock.contents as any
          if (contents.history && Array.isArray(contents.history) && contents.history.length > 0) {
            setTimeout(() => {
              if (xtermRef.current && isMounted) {
                xtermRef.current.writeln('\r\n--- Command History ---')
                contents.history.forEach((entry: any) => {
                  xtermRef.current?.writeln(`$ ${entry.command}`)
                  if (entry.output) {
                    xtermRef.current?.writeln(entry.output)
                  }
                })
                xtermRef.current.write(`\r\n${currentDir} $ `)
              }
            }, 100)
          }
        }

        // Define command handler inside initialization to access latest blockId
        const handleCommand = async (command: string) => {
          if (!command) return

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
            // Special handling for ls command: get real file list
            let commandOutput = ''
            if (command.trim() === 'ls') {
              try {
                // Get current directory block_id from currentDirectoryRef
                const currentDir = currentDirectoryRef.current || ''
                let targetBlockId: string | null = null
                
                if (currentDir === 'block-root') {
                  // List root - show all blocks (simplified)
                  commandOutput = '(Root directory - use FileStructure to view all blocks)'
                } else if (currentDir.startsWith('block-')) {
                  // Extract block_id from directory path
                  targetBlockId = currentDir.substring(6) // Remove "block-" prefix
                }
                
                if (targetBlockId) {
                  // List files in the target block's directory
                  const files = await TauriClient.block.listBlockFiles(activeFileId, targetBlockId)
                  if (files.length === 0) {
                    commandOutput = '(Empty directory)'
                  } else {
                    commandOutput = files.join('\n')
                  }
                }
              } catch (error) {
                commandOutput = `Error listing files: ${error instanceof Error ? error.message : String(error)}`
              }
              
              // If we got output, send it as a special command that just records the output
              const payload: TerminalExecutePayload = { 
                command: `__INTERNAL_LS__ ${commandOutput}`
              }
              const cmd = {
                cmd_id: crypto.randomUUID(),
                editor_id: editor.editor_id,
                cap_id: 'terminal.execute',
                block_id: currentBlockId,
                payload: payload as any,
                timestamp: new Date().toISOString(),
              }
              
              const events = await TauriClient.block.executeCommand(activeFileId, cmd)
              
              // Display the output directly
              terminal.writeln(commandOutput)
              
              // Update directory from event if needed
              if (events.length > 0 && events[0].value) {
                const event = events[0]
                const value = event.value as any
                if (value.contents && typeof value.contents === 'object') {
                  const contents = value.contents as any
                  if (contents.current_directory) {
                    currentDirectoryRef.current = contents.current_directory
                  }
                }
              }
              
              return
            }

            // Execute command via backend (for non-ls commands)
            const payload: TerminalExecutePayload = { command }
            const cmd = {
              cmd_id: crypto.randomUUID(),
              editor_id: editor.editor_id,
              cap_id: 'terminal.execute',
              block_id: currentBlockId,
              payload: payload as any,
              timestamp: new Date().toISOString(),
            }

            const events = await TauriClient.block.executeCommand(activeFileId, cmd)

            // Get the output from the event and update current directory
            if (events.length > 0 && events[0].value) {
              const event = events[0]
              const value = event.value as any
              if (value.contents && typeof value.contents === 'object') {
                const contents = value.contents as any
                
                // Update current directory if it changed
                if (contents.current_directory) {
                  currentDirectoryRef.current = contents.current_directory
                }
                
                if (contents.history && Array.isArray(contents.history)) {
                  const latestEntry = contents.history[contents.history.length - 1]
                  if (latestEntry && latestEntry.output) {
                    terminal.writeln(latestEntry.output)
                  } else {
                    terminal.writeln('Command executed successfully')
                  }
                }
              }
            }
            
            // Update prompt with new directory after command (don't write prompt here, it will be written by onData handler)
            const updatedDir = currentDirectoryRef.current || currentDir
            if (updatedDir) {
              currentDirectoryRef.current = updatedDir
            }
          } catch (error) {
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
                terminal.write(`\r\n${currentDir} $ `)
                isProcessingCommand = false
              }
            } else {
              // Empty command, just show prompt
              terminal.write('\r\n')
              const currentDir = currentDirectoryRef.current || 'block-root'
              terminal.write(`${currentDir} $ `)
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
            terminal.write('^C\r\n$ ')
            currentLine = ''
            return
          }

          // Ctrl+L (clear)
          if (code === 12) {
            terminal.clear()
            const currentDir = currentDirectoryRef.current || 'block-root'
            terminal.write(`${currentDir} $ `)
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
  }, [activeFileId, getActiveEditor, selectedBlock?.block_id])

  // Update directory when selected block changes (if terminal is already initialized)
  useEffect(() => {
    if (!activeFileId || !selectedBlock || !terminalBlockIdRef.current || !xtermRef.current) return

    const updateDirectory = async () => {
      try {
        const blockDirectory = `block-${selectedBlock.block_id}`
        
        // Only update if directory actually changed
        if (currentDirectoryRef.current !== blockDirectory) {
          currentDirectoryRef.current = blockDirectory

          // Execute a cd command to update the directory in the backend
          const editor = getActiveEditor(activeFileId)
          if (!editor || !terminalBlockIdRef.current) return

          try {
            // Use block directory format: block-{block_id}
            const payload: TerminalExecutePayload = { command: `cd block-${selectedBlock.block_id}` }
            const cmd = {
              cmd_id: crypto.randomUUID(),
              editor_id: editor.editor_id,
              cap_id: 'terminal.execute',
              block_id: terminalBlockIdRef.current,
              payload: payload as any,
              timestamp: new Date().toISOString(),
            }

            await TauriClient.block.executeCommand(activeFileId, cmd)
          } catch (error) {
            console.error('Failed to update directory in backend:', error)
          }

          // Update terminal prompt
          if (xtermRef.current) {
            xtermRef.current.write(`\r\nChanged directory to: ${blockDirectory}\r\n`)
            xtermRef.current.write(`${blockDirectory} $ `)
          }
        }
      } catch (error) {
        console.error('Failed to update directory:', error)
      }
    }

    updateDirectory()
  }, [activeFileId, selectedBlock?.block_id, getActiveEditor])

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
