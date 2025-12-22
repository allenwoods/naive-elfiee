import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { TopBar } from '@/components/dashboard/TopBar'
import { Plus, Upload, ChevronDown, FolderOpen, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import {
  ProjectCard,
  Project,
  Collaborator,
} from '@/components/projects/ProjectCard'
import { ImportProjectModal } from '@/components/projects/ImportProjectModal'
import { CreateProjectModal } from '@/components/projects/CreateProjectModal'
import { toast } from 'sonner'
import { TauriClient } from '@/lib/tauri-client'
import type { FileMetadata } from '@/bindings'

type StatusFilterOption = 'all' | 'conflicts' | 'agent-running' | 'drafts'
type SortOption = 'last-edited' | 'name-asc'

const statusFilterOptions: {
  value: StatusFilterOption
  label: string
  dot?: string
}[] = [
  { value: 'all', label: 'All Projects' },
  { value: 'conflicts', label: 'Has Conflicts', dot: 'bg-red-500' },
  { value: 'agent-running', label: 'Agent Active', dot: 'bg-green-500' },
  { value: 'drafts', label: 'Drafts', dot: 'bg-yellow-500' },
]

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'last-edited', label: 'Last Edited' },
  { value: 'name-asc', label: 'Name (A-Z)' },
]

/**
 * Convert FileMetadata to Project type for UI display
 */
function fileMetadataToProject(metadata: FileMetadata): Project {
  const collaborators: Collaborator[] = metadata.collaborators.map((id) => ({
    id,
    name: id,
    avatar: '',
  }))

  // Calculate last edited time (simple conversion from ISO string)
  const lastModified = new Date(metadata.updated_at)
  const now = new Date()
  const diffMs = now.getTime() - lastModified.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  let lastEdited: string
  if (diffMins < 60) {
    lastEdited = `${diffMins}m ago`
  } else if (diffHours < 24) {
    lastEdited = `${diffHours}h ago`
  } else {
    lastEdited = `${diffDays}d ago`
  }

  return {
    id: metadata.file_id,
    name: metadata.name,
    path: metadata.path,
    status: 'synced', // Default status, can be enhanced later
    lastEdited,
    collaborators: collaborators.length > 0 ? collaborators : undefined,
  }
}

const Projects = () => {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilterOption>('all')
  const [sortBy, setSortBy] = useState<SortOption>('last-edited')
  const [showImportModal, setShowImportModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [highlightedProjectId, setHighlightedProjectId] = useState<
    string | null
  >(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Load projects from backend on mount
  useEffect(() => {
    loadProjects()
  }, [])

  /**
   * Load all open files from backend
   */
  const loadProjects = async () => {
    try {
      setLoading(true)
      const fileIds = await TauriClient.file.listOpenFiles()

      // Get metadata for each file
      const metadataPromises = fileIds.map((id) =>
        TauriClient.file.getFileInfo(id)
      )
      const metadata = await Promise.all(metadataPromises)

      // Convert to Project format
      const loadedProjects = metadata.map(fileMetadataToProject)
      setProjects(loadedProjects)
    } catch (error) {
      console.error('Failed to load projects:', error)
      toast.error('Failed to load projects')
    } finally {
      setLoading(false)
    }
  }

  // Apply search, filter and sort
  const filteredProjects = projects
    .filter((project) => {
      // Search filter - search in name, description, and path
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchesName = project.name.toLowerCase().includes(query)
        const matchesPath = project.path.toLowerCase().includes(query)

        if (!matchesName && !matchesPath) {
          return false
        }
      }

      // Status filter
      if (statusFilter === 'all') return true
      if (statusFilter === 'conflicts') return project.status === 'conflict'
      if (statusFilter === 'agent-running') return project.status === 'synced' // Mock: synced projects have agents
      if (statusFilter === 'drafts') return project.status === 'editing'
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'name-asc') {
        return a.name.localeCompare(b.name)
      }
      // Default: last-edited (mock - just keep original order)
      return 0
    })

  const currentStatusFilterLabel =
    statusFilterOptions.find((f) => f.value === statusFilter)?.label ||
    'All Projects'
  const currentSortLabel =
    sortOptions.find((s) => s.value === sortBy)?.label || 'Last Edited'
  const existingNames = projects.map((p) => p.name)

  const handleRename = async (id: string, newName: string) => {
    try {
      await TauriClient.file.renameFile(id, newName)

      // Update local state
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, name: newName } : p))
      )
      toast.success('Project renamed')
    } catch (error) {
      console.error('Failed to rename project:', error)
      toast.error(`Failed to rename project: ${error}`)
    }
  }

  const handleDuplicate = async (id: string) => {
    try {
      // Duplicate the file using backend
      const newFileId = await TauriClient.file.duplicateFile(id)

      // Get metadata for the new file
      const metadata = await TauriClient.file.getFileInfo(newFileId)

      // Convert to Project and add to list
      const newProject = fileMetadataToProject(metadata)
      setProjects((prev) => [newProject, ...prev])
      setHighlightedProjectId(newProject.id)
      toast.success(`Project duplicated as '${metadata.name}'`)

      // Remove highlight after animation
      setTimeout(() => setHighlightedProjectId(null), 2000)
    } catch (error) {
      console.error('Failed to duplicate project:', error)
      toast.error(`Failed to duplicate project: ${error}`)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await TauriClient.file.closeFile(id)

      // Update local state
      setProjects((prev) => prev.filter((p) => p.id !== id))
      toast.success('Project removed from list')
    } catch (error) {
      console.error('Failed to remove project:', error)
      toast.error(`Failed to remove project: ${error}`)
    }
  }

  const handleImportProject = async (data: { name: string; path: string }) => {
    try {
      // Path is already selected in the modal, use it directly
      const filePath = data.path

      // Open the file using backend
      const fileId = await TauriClient.file.openFile(filePath)

      // Get file metadata
      const metadata = await TauriClient.file.getFileInfo(fileId)

      // Convert to Project and add to list
      const newProject = fileMetadataToProject(metadata)
      setProjects((prev) => [newProject, ...prev])
      setHighlightedProjectId(newProject.id)
      toast.success(`Project '${metadata.name}' imported successfully.`)

      // Remove highlight after animation
      setTimeout(() => setHighlightedProjectId(null), 2000)
    } catch (error) {
      console.error('Failed to import project:', error)
      toast.error(`Failed to import project: ${error}`)
    }
  }

  const handleCreateProject = async (data: { name: string; path: string }) => {
    try {
      // Path is already selected in the modal, use it directly
      const filePath = data.path

      // Create the file using backend with absolute path
      const fileId = await TauriClient.file.createFile(filePath)

      // Get file metadata
      const metadata = await TauriClient.file.getFileInfo(fileId)

      // Convert to Project and add to list
      const newProject = fileMetadataToProject(metadata)
      setProjects((prev) => [newProject, ...prev])
      setHighlightedProjectId(newProject.id)
      toast.success(`Project '${data.name}' created successfully.`)

      // Remove highlight after animation
      setTimeout(() => setHighlightedProjectId(null), 2000)
    } catch (error) {
      console.error('Failed to create project:', error)
      toast.error(`Failed to create project: ${error}`)
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar - Always visible on lg+ */}
      <div className="hidden w-20 lg:block">
        <Sidebar />
      </div>

      {/* Mobile/Tablet Header with Hamburger */}
      <div className="fixed left-0 right-0 top-0 z-40 border-b border-border bg-background lg:hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="min-h-[44px] min-w-[44px] text-orange-500 hover:bg-orange-50 hover:text-orange-600"
              >
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-20 bg-primary p-0 [&>button]:hidden"
            >
              <Sidebar />
            </SheetContent>
          </Sheet>
          <h1 className="text-xl font-bold text-foreground">Projects</h1>
        </div>
      </div>

      {/* Mobile FAB - Floating Action Button */}
      <button
        onClick={() => setShowCreateModal(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg transition-all hover:scale-105 hover:bg-orange-600 active:scale-95 lg:hidden"
        aria-label="Create new project"
      >
        <Plus className="h-7 w-7" />
      </button>

      {/* Main Content Area */}
      <div className="min-h-screen flex-1 lg:ml-20">
        {/* Desktop TopBar */}
        <div className="hidden lg:block">
          <TopBar
            title="Projects"
            searchPlaceholder="Search projects..."
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>

        {/* Mobile/tablet spacing for fixed header */}
        <div className="h-16 lg:hidden" />

        <main className="p-4 lg:p-8">
          {/* Rich Toolbar Row - Responsive */}
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* Status Filter Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="min-h-[44px] flex-1 justify-between rounded-lg border-gray-300 bg-white sm:flex-none sm:justify-start"
                  >
                    <span className="truncate">
                      Status: {currentStatusFilterLabel}
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="z-50 border-border bg-card"
                >
                  {statusFilterOptions.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      onClick={() => setStatusFilter(option.value)}
                      className={
                        statusFilter === option.value
                          ? 'bg-primary/10 text-primary'
                          : ''
                      }
                    >
                      {option.dot && (
                        <span
                          className={`h-2 w-2 rounded-full ${option.dot} mr-2`}
                        />
                      )}
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Sort Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="min-h-[44px] flex-1 justify-between rounded-lg border-gray-300 bg-white sm:flex-none sm:justify-start"
                  >
                    <span className="truncate">Sort: {currentSortLabel}</span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="z-50 border-border bg-card"
                >
                  {sortOptions.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      onClick={() => setSortBy(option.value)}
                      className={
                        sortBy === option.value
                          ? 'bg-primary/10 text-primary'
                          : ''
                      }
                    >
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Actions Row */}
            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                variant="outline"
                onClick={() => setShowCreateModal(true)}
                className="min-h-[44px] flex-1 border-primary text-primary hover:bg-primary hover:text-primary-foreground sm:flex-none"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create
              </Button>
              <Button
                onClick={() => setShowImportModal(true)}
                className="min-h-[44px] flex-1 bg-primary text-primary-foreground hover:bg-primary/90 sm:flex-none"
              >
                <Upload className="mr-2 h-4 w-4" />
                Import
              </Button>
            </div>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 text-muted-foreground">
                Loading projects...
              </div>
            </div>
          )}

          {/* Projects Grid - Responsive: 1 col mobile, 2 col tablet, 3 col desktop */}
          {!loading && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {filteredProjects.map((project, index) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  index={index}
                  onRename={handleRename}
                  onDuplicate={handleDuplicate}
                  onDelete={handleDelete}
                  isHighlighted={highlightedProjectId === project.id}
                />
              ))}
            </div>
          )}

          {!loading && filteredProjects.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FolderOpen className="mb-4 h-16 w-16 stroke-1 text-muted-foreground/30" />
              <h3 className="mb-2 text-lg font-medium text-foreground">
                {statusFilter !== 'all'
                  ? 'No projects found'
                  : 'Create your first project'}
              </h3>
              <p className="max-w-sm text-muted-foreground">
                {statusFilter !== 'all'
                  ? 'Try adjusting your filter criteria.'
                  : 'Get started by creating a new project or importing an existing .elf file.'}
              </p>
            </div>
          )}
        </main>
      </div>

      {/* Import Project Modal */}
      <ImportProjectModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
        onImport={handleImportProject}
        existingNames={existingNames}
      />

      {/* Create Project Modal */}
      <CreateProjectModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onCreate={handleCreateProject}
        existingNames={existingNames}
      />
    </div>
  )
}

export default Projects
