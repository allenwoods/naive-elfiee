import { useState, useEffect, useRef } from 'react'
import { Check, X, Edit2, Loader2, Code as CodeIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface CodeBlockEditorProps {
  content: string
  language?: string
  onContentChange: (newContent: string) => void
  onSave: () => Promise<void>
}

export const CodeBlockEditor = ({
  content,
  language = 'text',
  onContentChange,
  onSave,
}: CodeBlockEditorProps) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(content)
  const [isSaving, setIsSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setEditContent(content)
  }, [content])

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const textarea = textareaRef.current
      textarea.focus()
      textarea.style.height = 'auto'
      textarea.style.height = textarea.scrollHeight + 'px'
    }
  }, [isEditing])

  const handleSave = async () => {
    if (editContent !== content) {
      onContentChange(editContent)
    }

    setIsSaving(true)
    try {
      await onSave()
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to save code block:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setEditContent(content)
    setIsEditing(false)
  }

  return (
    <div className="group relative my-4 w-full">
      {/* Header / Toolbar */}
      <div className="sticky top-4 z-20 mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="border-zinc-300 bg-zinc-100 text-zinc-700"
          >
            <CodeIcon className="mr-1.5 h-3 w-3" />
            {language.toUpperCase()}
          </Badge>
        </div>

        <div className="flex gap-2">
          {!isEditing ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8 bg-white text-xs shadow-sm"
              onClick={() => setIsEditing(true)}
            >
              <Edit2 className="mr-1.5 h-3 w-3" />
              Edit File
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
                onClick={handleCancel}
              >
                <X className="mr-1.5 h-3.5 w-3.5" />
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs font-medium"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                )}
                Save Changes
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Editor Area */}
      <div
        className={cn(
          'rounded-lg border transition-all duration-200',
          isEditing
            ? 'border-primary/50 shadow-md ring-1 ring-primary/20'
            : 'border-border bg-zinc-50/50'
        )}
      >
        <Textarea
          ref={textareaRef}
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          readOnly={!isEditing}
          onDoubleClick={() => !isEditing && setIsEditing(true)}
          className={cn(
            'min-h-[600px] w-full resize-none overflow-auto p-8',
            'border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0',
            'tab-4 font-mono text-[13px] leading-relaxed',
            !isEditing && 'cursor-text'
          )}
          placeholder="Enter source code..."
          spellCheck={false}
        />
      </div>

      {!isEditing && (
        <div className="mt-4 text-center text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-60">
          💡 Double-click to edit source code
        </div>
      )}
    </div>
  )
}
