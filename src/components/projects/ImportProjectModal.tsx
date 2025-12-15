import { useState, useRef, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  CloudUpload,
  FileText,
  CheckCircle,
  Sparkles,
  Loader2,
  X,
  AlertCircle,
} from 'lucide-react'
import { LocationBreadcrumb } from './LocationBreadcrumb'
import { cn } from '@/lib/utils'

interface ImportProjectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (project: {
    name: string
    description: string
    path: string
  }) => void
  existingNames: string[]
}

type Step = 'source' | 'details'
type Tab = 'local' | 'git'

export const ImportProjectModal = ({
  open,
  onOpenChange,
  onImport,
  existingNames,
}: ImportProjectModalProps) => {
  const [step, setStep] = useState<Step>('source')
  const [activeTab, setActiveTab] = useState<Tab>('local')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  // Step 2 state
  const [projectName, setProjectName] = useState('')
  const [description, setDescription] = useState('')
  const [isGeneratingAI, setIsGeneratingAI] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetState = () => {
    setStep('source')
    setActiveTab('local')
    setSelectedFile(null)
    setFileError(null)
    setIsDragOver(false)
    setProjectName('')
    setDescription('')
    setIsGeneratingAI(false)
    setIsImporting(false)
  }

  const handleClose = () => {
    resetState()
    onOpenChange(false)
  }

  const validateFile = (file: File): boolean => {
    if (file.name.endsWith('.elf')) {
      setFileError(null)
      return true
    }
    setFileError('Invalid file format. Please upload a .elf file.')
    return false
  }

  const handleFileSelect = (file: File) => {
    if (validateFile(file)) {
      setSelectedFile(file)
      // Pre-fill project name from filename
      const nameWithoutExt = file.name.replace(/\.elf$/, '')
      setProjectName(nameWithoutExt)
    } else {
      setSelectedFile(null)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleBrowseClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleNext = () => {
    if (selectedFile) {
      setStep('details')
    }
  }

  const handleBack = () => {
    setStep('source')
  }

  const handleGenerateAI = async () => {
    setIsGeneratingAI(true)
    // Mock AI generation delay
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setDescription(
      'Contains logic for user onboarding and point calculation system. Includes challenge rules, streak tracking, and achievement unlock mechanisms.'
    )
    setIsGeneratingAI(false)
  }

  const handleImport = async () => {
    setIsImporting(true)
    // Mock import delay
    await new Promise((resolve) => setTimeout(resolve, 1000))

    const sanitizedName = projectName.toLowerCase().replace(/\s+/g, '-')
    onImport({
      name: projectName,
      description,
      path: `~/imported/${sanitizedName}.elf`,
    })

    handleClose()
  }

  const clearSelectedFile = () => {
    setSelectedFile(null)
    setFileError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const virtualPath = projectName
    ? `~/imported/${projectName.toLowerCase().replace(/\s+/g, '-')}`
    : '~/imported/'

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Project</DialogTitle>
        </DialogHeader>

        {step === 'source' && (
          <div className="space-y-4 py-4">
            {/* Tabs */}
            <div className="border-border flex gap-2 border-b pb-2">
              <button
                onClick={() => setActiveTab('local')}
                className={cn(
                  'rounded-t px-4 py-2 text-sm font-medium transition-colors',
                  activeTab === 'local'
                    ? 'text-primary border-primary border-b-2'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Local File
              </button>
              <button
                disabled
                className="text-muted-foreground/50 cursor-not-allowed px-4 py-2 text-sm font-medium"
                title="Coming soon"
              >
                Agentour Repository
                <span className="ml-1 text-xs">(Coming soon)</span>
              </button>
            </div>

            {/* Dropzone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={handleBrowseClick}
              className={cn(
                'cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-all',
                isDragOver && 'border-primary bg-primary/5',
                fileError && 'border-destructive bg-destructive/5',
                !isDragOver &&
                  !fileError &&
                  'border-border hover:border-primary/50 hover:bg-muted/50'
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".elf"
                onChange={handleFileInputChange}
                className="hidden"
              />

              {selectedFile ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="text-primary h-8 w-8" />
                  <div className="text-left">
                    <p className="text-foreground font-medium">
                      {selectedFile.name}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-2"
                    onClick={(e) => {
                      e.stopPropagation()
                      clearSelectedFile()
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : fileError ? (
                <div className="space-y-2">
                  <AlertCircle className="text-destructive mx-auto h-12 w-12" />
                  <p className="text-destructive font-medium">{fileError}</p>
                  <p className="text-muted-foreground text-sm">
                    Click to try again
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <CloudUpload className="text-muted-foreground mx-auto h-12 w-12" />
                  <p className="text-foreground font-medium">
                    Drag and drop your .elf file here, or click to browse
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Supports .elf files only
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleNext}
                disabled={!selectedFile}
                className="bg-primary hover:bg-primary/90"
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {step === 'details' && (
          <div className="space-y-4 py-4">
            {/* Success indicator */}
            <div className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">
                File parsed successfully
              </span>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Project Name
                </label>
                <Input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Enter project name"
                />
              </div>

              <LocationBreadcrumb projectName={projectName} />

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium">Description</label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleGenerateAI}
                    disabled={isGeneratingAI}
                    className="text-primary hover:text-primary/80 h-auto px-2 py-1"
                  >
                    {isGeneratingAI ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="mr-1 h-3 w-3" />
                    )}
                    Auto-generate with AI
                  </Button>
                </div>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this project is about..."
                  rows={3}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={handleBack}>
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={!projectName.trim() || isImporting}
                className="bg-primary hover:bg-primary/90"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  'Import'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
