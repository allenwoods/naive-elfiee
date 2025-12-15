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
  blockId,
}: {
  code: string
  language: string
  blockId: string
}) => {
  const [isRunning, setIsRunning] = useState(false)
  const [output, setOutput] = useState<string | null>(null)

  const handleRun = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsRunning(true)
    setOutput(null)

    // Simulate code execution
    setTimeout(() => {
      const mockOutput = `✓ Code executed successfully
Language: ${language}
Output:
${code.substring(0, 100)}${code.length > 100 ? '...' : ''}

> Process completed at ${new Date().toLocaleTimeString()}`
      setOutput(mockOutput)
      setIsRunning(false)
      toast.success('Code executed successfully')
    }, 1500)
  }

  return (
    <div className="group relative my-4 w-full">
      <div className={cn('border-border overflow-hidden rounded-lg border')}>
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-2">
          <span className="font-mono text-xs text-zinc-300 uppercase">
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
                <div className="mb-2 flex items-center gap-2 text-xs text-zinc-500 select-none">
                  <Terminal className="h-3 w-3" />
                  <span>Terminal Output</span>
                </div>
                <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap text-green-400">
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
}: {
  content: string
  onContentChange?: (newContent: string) => void
}) => {
  const codeBlockCounter = useRef(0)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(content)
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

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.setSelectionRange(0, editContent.length)
    }
  }, [isEditing, editContent.length])

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
        const blockId = `code-block-${codeBlockCounter.current}`
        codeBlockCounter.current += 1
        return (
          <CodeBlockWithRun code={code} language={language} blockId={blockId} />
        )
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

  const handleSave = useCallback(() => {
    if (editContent.trim() !== content.trim()) {
      if (onContentChange) {
        onContentChange(editContent)
        toast.success('Document updated')
      }
    }
    setIsEditing(false)
  }, [editContent, content, onContentChange])

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

  // Edit mode - show raw MyST markdown
  if (isEditing) {
    return (
      <div className="border-primary/50 bg-background relative my-4 rounded-lg border-2 shadow-md">
        <div className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <Badge variant="outline" className="text-xs">
              <Edit2 className="mr-1 h-3 w-3" />
              Edit MyST Markdown
            </Badge>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={handleCancel}
              >
                <X className="mr-1 h-3 w-3" />
                Cancel
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleSave}>
                <Check className="mr-1 h-3 w-3" />
                Save (Cmd+Enter)
              </Button>
            </div>
          </div>
          <Textarea
            ref={textareaRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={handleKeyDown}
            className={cn(
              'min-h-[400px] resize-y font-mono text-sm',
              'focus-visible:ring-primary focus-visible:ring-2',
              'leading-relaxed'
            )}
            placeholder="Enter MyST Markdown content..."
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
      <div
        className={cn('myst-rendered', 'group relative w-full cursor-pointer')}
        onDoubleClick={() => setIsEditing(true)}
      >
        <div className="border-border/50 bg-background hover:border-primary/50 relative my-4 rounded-lg border p-8 text-center transition-colors">
          <div className="text-muted-foreground">
            <p className="mb-2 text-base">(Empty document)</p>
            <p className="text-sm opacity-75">
              Double-click to edit MyST Markdown
            </p>
          </div>
        </div>
        {/* Edit hint on hover */}
        <div className="pointer-events-none absolute top-2 right-2 z-10 opacity-0 transition-opacity group-hover:opacity-100">
          <Badge variant="secondary" className="text-xs shadow-sm">
            <Edit2 className="mr-1 h-3 w-3" />
            Double-click to edit
          </Badge>
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
    <div
      className={cn('myst-rendered', 'group relative w-full cursor-pointer')}
      onDoubleClick={() => setIsEditing(true)}
    >
      {/* ThemeProvider provides context for MyST components */}
      <ThemeProvider
        theme={Theme.light}
        setTheme={() => {}}
        renderers={customRenderers}
      >
        {/* MyST renders the AST as actual HTML elements (h1, p, strong, etc.) */}
        <MyST ast={ast} />
      </ThemeProvider>

      {/* Edit hint on hover */}
      <div className="pointer-events-none absolute top-2 right-2 z-10 opacity-0 transition-opacity group-hover:opacity-100">
        <Badge variant="secondary" className="text-xs shadow-sm">
          <Edit2 className="mr-1 h-3 w-3" />
          Double-click to edit
        </Badge>
      </div>
    </div>
  )
}

// Main EditorCanvas Component
export const EditorCanvas = () => {
  const { currentFileId, selectedBlockId, getBlock, updateBlock } =
    useAppStore()
  const [isSaving, setIsSaving] = useState(false)
  const [documentContent, setDocumentContent] = useState<string>('')
  const [documentDescription, setDocumentDescription] = useState<string>(
    'Define requirements and track implementations'
  )
  const descriptionRef = useRef<HTMLParagraphElement>(null)
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

  const docName = selectedBlock?.name || 'Untitled'

  // Handle save action
  const handleSave = async () => {
    if (!currentFileId || !selectedBlockId || !documentContent.trim()) {
      toast.error('No block selected or content is empty')
      return
    }

    setIsSaving(true)
    try {
      await updateBlock(currentFileId, selectedBlockId, documentContent)
      toast.success('Document saved successfully')
    } catch (error) {
      console.error('Failed to save:', error)
      toast.error('Failed to save document')
    } finally {
      setIsSaving(false)
    }
  }

  // Handle content change from MySTDocument
  const handleContentChange = useCallback((newContent: string) => {
    setDocumentContent(newContent)
  }, [])

  return (
    <ScrollArea className="h-full w-full">
      <main className="bg-background w-full min-w-0 p-4 md:p-6 lg:p-8">
        {/* Editor Container */}
        <div className="mx-auto w-full max-w-4xl min-w-0 pb-32">
          {/* Status + Save */}
          <div className="mb-6 flex flex-wrap items-center justify-end gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <Badge
                variant="outline"
                className="border-border text-muted-foreground text-xs font-medium"
              >
                🟡 Editing
              </Badge>
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  className="bg-foreground text-background hover:bg-foreground/90 rounded-full px-6 font-semibold shadow-sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSave()
                  }}
                  disabled={isSaving}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </motion.div>
            </div>
          </div>

          {/* Editable Document Title */}
          <div className="mb-8 min-w-0">
            <h1
              className="text-foreground hover:bg-muted/30 -mx-2 cursor-pointer rounded px-2 text-3xl font-bold break-words transition-colors"
              contentEditable
              suppressContentEditableWarning
            >
              {docName}
            </h1>
            <p
              ref={descriptionRef}
              className="text-muted-foreground hover:text-foreground hover:bg-muted/30 focus:ring-primary/50 -mx-2 mt-2 min-h-[1.5rem] cursor-pointer rounded px-2 text-sm break-words transition-colors focus:ring-2 focus:outline-none"
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => {
                const newDescription = e.currentTarget.textContent || ''
                setDocumentDescription(newDescription)
              }}
              onBlur={(e) => {
                const newDescription = e.currentTarget.textContent?.trim() || ''
                const finalDescription =
                  newDescription ||
                  'Define requirements and track implementations'
                if (finalDescription !== documentDescription) {
                  setDocumentDescription(finalDescription)
                  if (descriptionRef.current) {
                    descriptionRef.current.textContent = finalDescription
                  }
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  e.currentTarget.blur()
                }
                e.stopPropagation()
              }}
              onClick={(e) => {
                e.stopPropagation()
              }}
            >
              {documentDescription}
            </p>
          </div>

          {/* MyST Document Content */}
          <div className="w-full min-w-0 space-y-6">
            {selectedBlock ? (
              <MySTDocument
                content={documentContent}
                onContentChange={handleContentChange}
              />
            ) : (
              <div className="text-muted-foreground py-16 text-center">
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
