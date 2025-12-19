import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { Save, Play, Loader2, Terminal, Edit2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/lib/app-store'
import { mystParse } from 'myst-parser'
import { MyST } from 'myst-to-react'
import { Theme, ThemeProvider } from '@myst-theme/providers'
import type { NodeRenderers } from '@myst-theme/providers'
import type { Block } from '@/bindings'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import './myst-styles.css'

// AST Node Types
interface ASTNode {
  type: string
  value?: string
  lang?: string
  language?: string
  children?: ASTNode[]
  [key: string]: unknown
}

// Extended type for code blocks
interface CodeBlockNode extends ASTNode {
  type: 'code' | 'codeBlock'
  lang?: string
  language?: string
  value?: string
}

// Code Block Component with Run Button
const CodeBlockWithRun = ({
  code,
  language,
}: {
  code: string
  language: string
}) => {
  const [isRunning, setIsRunning] = useState(false)
  const [output, setOutput] = useState<string | null>(null)

  const handleRun = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsRunning(true)
    setOutput(null)

    // TODO: Implement real code execution via Terminal Extension
    // This is a mock implementation for demonstration purposes
    // Real implementation should call Tauri backend command to execute code
    setTimeout(() => {
      const mockOutput = `✓ Code executed successfully (Mock)
Language: ${language}
Output:
${code.substring(0, 100)}${code.length > 100 ? '...' : ''}

> Process completed at ${new Date().toLocaleTimeString()}

Note: This is a mock execution. Real code execution will be implemented in Terminal Extension.`
      setOutput(mockOutput)
      setIsRunning(false)
      toast.success('Code executed (mock)')
    }, 1500)
  }

  return (
    <div className="group relative my-4 w-full">
      <div className={cn('overflow-hidden rounded-lg border border-border')}>
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-2">
          <span className="font-mono text-xs uppercase text-zinc-300">
            {language}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            onClick={handleRun}
            disabled={isRunning}
          >
            {isRunning ? (
              <>
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="mr-1.5 h-3 w-3" />
                Run
              </>
            )}
          </Button>
        </div>
        <div className="w-full overflow-x-auto">
          <SyntaxHighlighter
            language={language}
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              padding: '1rem',
              fontSize: '0.875rem',
              background: '#18181b',
            }}
            wrapLines={false}
            wrapLongLines={false}
            lineProps={{
              style: {
                background: 'transparent',
              },
            }}
            codeTagProps={{
              style: {
                background: 'transparent',
              },
            }}
          >
            {code}
          </SyntaxHighlighter>
        </div>
        {/* Terminal Output */}
        <AnimatePresence>
          {output && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-zinc-800 bg-zinc-950"
            >
              <div className="p-4 font-mono text-sm">
                <div className="mb-2 flex select-none items-center gap-2 text-xs text-zinc-500">
                  <Terminal className="h-3 w-3" />
                  <span>Terminal Output</span>
                </div>
                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-green-400">
                  {output}
                </pre>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// MyST Document Renderer with proper theme and styling
const MySTDocument = ({
  content,
  onContentChange,
  onSave,
}: {
  content: string
  onContentChange?: (newContent: string) => void
  onSave?: () => void | Promise<void>
}) => {
  const codeBlockCounter = useRef(0)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(content)
  const [isSaving, setIsSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Parse MyST content into AST
  // According to official guide: use unified processor with mystParser plugin
  const ast = useMemo(() => {
    if (!content || !content.trim()) {
      return null
    }
    try {
      // Reset code block counter on new parse
      codeBlockCounter.current = 0

      // Parse MyST markdown content to AST
      // mystParse handles the unified processor internally
      const parsed = mystParse(content)
      return parsed
    } catch (e) {
      console.error('MyST parse error:', e)
      return null
    }
  }, [content])

  // Update edit content when content prop changes
  useEffect(() => {
    setEditContent(content)
  }, [content])

  // Focus textarea when entering edit mode and auto-resize
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const textarea = textareaRef.current
      textarea.focus()
      // Move cursor to end instead of selecting all
      setTimeout(() => {
        textarea.setSelectionRange(textarea.value.length, textarea.value.length)
      }, 0)

      // Auto-resize textarea to fit content
      const autoResize = () => {
        textarea.style.height = 'auto'
        textarea.style.height = textarea.scrollHeight + 'px'
      }
      autoResize()

      // Add resize observer
      textarea.addEventListener('input', autoResize)
      return () => textarea.removeEventListener('input', autoResize)
    }
  }, [isEditing])

  // Custom renderers for all node types with proper text content handling
  // IMPORTANT: NodeRenderer only provides `node` and `className` props
  // For container nodes, manually render children via <MyST ast={node.children} />
  // For leaf nodes, use `node.value` directly
  const customRenderers: NodeRenderers = useMemo(
    () => ({
      // Headings (h1-h6)
      heading: ({ node }) => {
        const level = (node.depth as number) || 1
        const Tag = `h${level}` as keyof JSX.IntrinsicElements
        return (
          <Tag>
            <MyST ast={node.children} />
          </Tag>
        )
      },

      // Paragraph
      paragraph: ({ node }) => {
        return (
          <p>
            <MyST ast={node.children} />
          </p>
        )
      },

      // Strong (bold) - CRITICAL for **text**
      strong: ({ node }) => {
        return (
          <strong>
            <MyST ast={node.children} />
          </strong>
        )
      },

      // Emphasis (italic) - for *text*
      emphasis: ({ node }) => {
        return (
          <em>
            <MyST ast={node.children} />
          </em>
        )
      },

      // Text node - CRITICAL: this renders the actual text content
      text: ({ node }) => {
        return <>{node.value}</>
      },

      // List (ul/ol)
      list: ({ node }) => {
        const Tag = node.ordered ? 'ol' : 'ul'
        return (
          <Tag>
            <MyST ast={node.children} />
          </Tag>
        )
      },

      // List item
      listItem: ({ node }) => {
        return (
          <li>
            <MyST ast={node.children} />
          </li>
        )
      },

      // Link
      link: ({ node }) => {
        return (
          <a href={node.url as string}>
            <MyST ast={node.children} />
          </a>
        )
      },

      // Inline code
      inlineCode: ({ node }) => {
        return <code>{node.value}</code>
      },

      // Code block with Run button
      code: ({ node }) => {
        const codeNode = node as CodeBlockNode
        const code = codeNode.value || ''
        const language = codeNode.lang || codeNode.language || 'text'
        codeBlockCounter.current += 1
        return <CodeBlockWithRun code={code} language={language} />
      },

      // Blockquote
      blockquote: ({ node }) => {
        return (
          <blockquote>
            <MyST ast={node.children} />
          </blockquote>
        )
      },

      // Horizontal rule (thematic break)
      thematicBreak: () => {
        return <hr />
      },

      // Break (line break)
      break: () => {
        return <br />
      },
    }),
    []
  )

  const handleSave = useCallback(async () => {
    // Update content
    if (editContent.trim() !== content.trim()) {
      if (onContentChange) {
        onContentChange(editContent)
      }
    }

    // Save block to database
    if (onSave) {
      setIsSaving(true)
      try {
        await onSave()
        setIsEditing(false)
      } catch (error) {
        console.error('Failed to save block:', error)
        // Keep editing mode open on error
      } finally {
        setIsSaving(false)
      }
    } else {
      setIsEditing(false)
    }
  }, [editContent, content, onContentChange, onSave])

  const handleCancel = useCallback(() => {
    setEditContent(content)
    setIsEditing(false)
  }, [content])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
  }

  // Edit mode - show raw MyST markdown with Jupyter-like UI
  if (isEditing) {
    return (
      <div className="group relative my-4 w-full">
        {/* Floating toolbar - appears on focus */}
        <div className="sticky top-4 z-20 mb-3 flex justify-end">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-2 rounded-lg border border-border bg-background/95 p-2 shadow-lg backdrop-blur-sm"
          >
            <div className="flex items-center gap-2 border-r border-border pr-3">
              <Badge variant="secondary" className="h-6 text-xs font-medium">
                <Edit2 className="mr-1 h-3 w-3" />
                Edit
              </Badge>
              <span className="text-xs text-muted-foreground">
                MyST Markdown
              </span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={handleCancel}
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button
              size="sm"
              variant="default"
              className="h-7 text-xs font-medium"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                  Save
                </>
              )}
            </Button>
          </motion.div>
        </div>

        {/* Textarea with preview-like styling */}
        <div className="rounded-lg border border-primary/30 bg-background shadow-sm transition-all hover:border-primary/50">
          <Textarea
            ref={textareaRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={handleKeyDown}
            className={cn(
              'min-h-[500px] resize-none overflow-hidden',
              'border-0 bg-transparent',
              'focus-visible:ring-0 focus-visible:ring-offset-0',
              'font-mono text-sm leading-relaxed',
              'p-8'
            )}
            placeholder="Start typing your MyST Markdown content here...

Examples:
# Heading 1
## Heading 2

**Bold text** and *italic text*

- Bullet point 1
- Bullet point 2

```python
print('Hello, World!')
```"
          />
        </div>
      </div>
    )
  }

  // Preview mode - render document with proper MyST styling
  const astWithChildren = ast as ASTNode | null
  if (
    !astWithChildren ||
    !astWithChildren.children ||
    astWithChildren.children.length === 0
  ) {
    return (
      <div className={cn('myst-rendered', 'group relative w-full')}>
        <div
          className="relative my-4 cursor-text rounded-lg border border-dashed border-border/50 bg-muted/10 p-16 text-center transition-all hover:border-border hover:bg-muted/20"
          onDoubleClick={() => setIsEditing(true)}
        >
          <div className="text-muted-foreground">
            <Edit2 className="mx-auto mb-3 h-10 w-10 opacity-20" />
            <p className="mb-2 text-base font-medium">Empty Block</p>
            <p className="text-sm">Double-click to start editing</p>
          </div>
        </div>
      </div>
    )
  }

  // Render document using MyST pattern with custom CSS (text-display-css-spec.md)
  // 1. Apply .myst-rendered class to the outer container
  // 2. ThemeProvider wraps MyST component and provides theme context
  // 3. MyST component renders AST as HTML elements (strong, em, h1, etc.)
  // 4. Custom CSS in myst-styles.css provides all styling
  // 5. Custom renderers extend functionality (e.g., code blocks with Run button)
  return (
    <div className={cn('myst-rendered', 'group relative w-full')}>
      {/* Document Content - Double-click to edit (Jupyter-like) */}
      <div
        onDoubleClick={() => setIsEditing(true)}
        className="cursor-text rounded-lg p-8 transition-all hover:bg-muted/5"
      >
        {/* ThemeProvider provides context for MyST components */}
        <ThemeProvider
          theme={Theme.light}
          setTheme={() => {}}
          renderers={customRenderers}
        >
          {/* MyST renders the AST as actual HTML elements (h1, p, strong, etc.) */}
          <MyST ast={ast as any} />
        </ThemeProvider>
      </div>

      {/* Subtle hint - only shows on hover */}
      <div className="mt-4 text-center text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-60">
        💡 Double-click to edit
      </div>
    </div>
  )
}

// Main EditorCanvas Component
export const EditorCanvas = () => {
  const { currentFileId, selectedBlockId, getBlock, updateBlock, saveFile } =
    useAppStore()
  const [isSaving, setIsSaving] = useState(false)
  const [documentContent, setDocumentContent] = useState<string>('')
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null)

  // Load block content when selectedBlockId changes
  useEffect(() => {
    if (currentFileId && selectedBlockId) {
      const block = getBlock(currentFileId, selectedBlockId)
      if (block) {
        setSelectedBlock(block)
        // Extract markdown content from block.contents
        const contents = block.contents as { markdown?: string }
        setDocumentContent(contents?.markdown || '')
      }
    } else {
      setSelectedBlock(null)
      setDocumentContent('')
    }
  }, [currentFileId, selectedBlockId, getBlock])

  // Handle save block only (called from editor)
  const handleBlockSave = useCallback(async () => {
    if (!currentFileId || !selectedBlockId) {
      toast.error('No block selected')
      return
    }

    try {
      // Update block content in database
      if (documentContent.trim()) {
        await updateBlock(currentFileId, selectedBlockId, documentContent)
        toast.success('Block saved successfully')
      }
    } catch (error) {
      console.error('Failed to save block:', error)
      throw error // Re-throw to let editor handle the error
    }
  }, [currentFileId, selectedBlockId, documentContent, updateBlock])

  // Handle save file action (top-level save button)
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

      toast.success('Document and file saved successfully')
    } catch (error) {
      console.error('Failed to save:', error)
      // Error toast is already shown by app-store methods
    } finally {
      setIsSaving(false)
    }
  }, [currentFileId, selectedBlockId, documentContent, updateBlock, saveFile])

  // Handle content change from MySTDocument
  const handleContentChange = useCallback((newContent: string) => {
    setDocumentContent(newContent)
  }, [])

  // Keyboard shortcut for save (Ctrl+S / Cmd+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave])

  return (
    <ScrollArea className="h-full w-full">
      <main className="w-full min-w-0 bg-background p-4 md:p-6 lg:p-8">
        {/* Editor Container */}
        <div className="mx-auto w-full min-w-0 max-w-4xl pb-32">
          {/* Save Button */}
          <div className="mb-6 flex items-center justify-end">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                size="sm"
                className="bg-foreground px-4 text-sm font-medium text-background shadow-sm hover:bg-foreground/90"
                onClick={(e) => {
                  e.stopPropagation()
                  handleSave()
                }}
                disabled={isSaving}
              >
                <Save className="mr-2 h-3.5 w-3.5" />
                {isSaving ? 'Saving...' : 'Save (Ctrl+S)'}
              </Button>
            </motion.div>
          </div>

          {/* MyST Document Content */}
          <div className="w-full min-w-0 space-y-6">
            {selectedBlock ? (
              <MySTDocument
                content={documentContent}
                onContentChange={handleContentChange}
                onSave={handleBlockSave}
              />
            ) : (
              <div className="py-16 text-center text-muted-foreground">
                <p>No block selected</p>
                <p className="mt-2 text-sm">
                  Select a block from the file panel to start editing
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </ScrollArea>
  )
}
