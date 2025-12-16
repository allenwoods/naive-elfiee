import { useState } from 'react'
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

type StatusFilterOption = 'all' | 'conflicts' | 'agent-running' | 'drafts'
type SortOption = 'last-edited' | 'name-asc'

const mockCollaborators: Collaborator[] = [
  { id: '1', name: 'Ops Zhang', avatar: '' },
  { id: '2', name: 'Claude', isAgent: true },
]

const initialProjects: Project[] = [
  {
    id: 'challenge-system',
    name: 'Challenge System',
    description:
      'Core gamification logic for user challenges and point calculations. Includes streak tracking and achievement unlocks.',
    path: '~/docs/challenge-system.elf',
    status: 'conflict',
    lastEdited: '5m ago',
    collaborators: mockCollaborators,
  },
  {
    id: 'api-docs',
    name: 'API Docs',
    description: 'REST API documentation for the platform.',
    path: '~/docs/api-docs.elf',
    status: 'synced',
    lastEdited: '1d ago',
    collaborators: [{ id: '1', name: 'Ops Zhang', avatar: '' }],
  },
  {
    id: 'new-feature-spec',
    name: 'New Feature Spec',
    description: 'Draft specification for the upcoming release.',
    path: '~/docs/feature-spec.elf',
    status: 'editing',
    lastEdited: '2m ago',
    // No collaborators - will show invite button
  },
  {
    id: 'legacy-data',
    name: 'Legacy Data Migration',
    description:
      'This document outlines the comprehensive migration strategy for transitioning legacy user data from the old MySQL database to the new PostgreSQL cluster. It includes detailed field mappings, data transformation rules, and rollback procedures.',
    path: '~/docs/legacy-migration.elf',
    status: 'synced',
    lastEdited: '3d ago',
    collaborators: mockCollaborators,
  },
]

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

const Projects = () => {
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [statusFilter, setStatusFilter] = useState<StatusFilterOption>('all')
  const [sortBy, setSortBy] = useState<SortOption>('last-edited')
  const [showImportModal, setShowImportModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [highlightedProjectId, setHighlightedProjectId] = useState<
    string | null
  >(null)

  // Apply filter and sort
  const filteredProjects = projects
    .filter((project) => {
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

  const handleRename = (id: string, newName: string) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name: newName } : p))
    )
    toast.success('Project renamed')
  }

  const handleDuplicate = (id: string) => {
    const project = projects.find((p) => p.id === id)
    if (project) {
      const newProject: Project = {
        ...project,
        id: `${project.id}-copy-${Date.now()}`,
        name: `${project.name} (Copy)`,
        lastEdited: 'Just now',
      }
      setProjects((prev) => [...prev, newProject])
      toast.success('Project duplicated')
    }
  }

  const handleDelete = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id))
    toast.success('Project deleted')
  }

  const handleImportProject = (data: {
    name: string
    description: string
    path: string
  }) => {
    const newProject: Project = {
      id: `imported-${Date.now()}`,
      name: data.name,
      description: data.description || 'Imported .elf project',
      path: data.path,
      status: 'synced',
      lastEdited: 'Just now',
    }
    setProjects((prev) => [newProject, ...prev])
    setHighlightedProjectId(newProject.id)
    toast.success(`Project '${data.name}' imported successfully.`)

    // Remove highlight after animation
    setTimeout(() => setHighlightedProjectId(null), 2000)
  }

  const handleCreateProject = (data: { name: string; description: string }) => {
    const sanitizedName = data.name.toLowerCase().replace(/\s+/g, '-')
    const newProject: Project = {
      id: `created-${Date.now()}`,
      name: data.name,
      description: data.description || 'A new project',
      path: `~/docs/${sanitizedName}.elf`,
      status: 'editing',
      lastEdited: 'Just now',
    }
    setProjects((prev) => [newProject, ...prev])
    setHighlightedProjectId(newProject.id)
    toast.success(`Project '${data.name}' created successfully.`)

    // Remove highlight after animation
    setTimeout(() => setHighlightedProjectId(null), 2000)
  }

  return (
    <div className="bg-background flex min-h-screen">
      {/* Desktop Sidebar - Always visible on lg+ */}
      <div className="hidden w-20 flex-shrink-0 lg:block">
        <Sidebar />
      </div>

      {/* Mobile/Tablet Header with Hamburger */}
      <div className="bg-background border-border fixed top-0 right-0 left-0 z-40 border-b lg:hidden">
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
              className="bg-primary w-20 p-0 [&>button]:hidden"
            >
              <Sidebar />
            </SheetContent>
          </Sheet>
          <h1 className="text-foreground text-xl font-bold">Projects</h1>
        </div>
      </div>

      {/* Mobile FAB - Floating Action Button */}
      <button
        onClick={() => setShowCreateModal(true)}
        className="fixed right-6 bottom-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg transition-all hover:scale-105 hover:bg-orange-600 active:scale-95 lg:hidden"
        aria-label="Create new project"
      >
        <Plus className="h-7 w-7" />
      </button>

      {/* Main Content Area */}
      <div className="min-h-screen flex-1 lg:ml-20">
        {/* Desktop TopBar */}
        <div className="hidden lg:block">
          <TopBar title="Projects" searchPlaceholder="Search projects..." />
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
                  className="bg-card border-border z-50"
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
                  className="bg-card border-border z-50"
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
                className="border-primary text-primary hover:bg-primary hover:text-primary-foreground min-h-[44px] flex-1 sm:flex-none"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create
              </Button>
              <Button
                onClick={() => setShowImportModal(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground min-h-[44px] flex-1 sm:flex-none"
              >
                <Upload className="mr-2 h-4 w-4" />
                Import
              </Button>
            </div>
          </div>

          {/* Projects Grid - Responsive: 1 col mobile, 2 col tablet, 3 col desktop */}
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

          {filteredProjects.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FolderOpen className="text-muted-foreground/30 mb-4 h-16 w-16 stroke-1" />
              <h3 className="text-foreground mb-2 text-lg font-medium">
                {statusFilter !== 'all'
                  ? 'No projects found'
                  : 'Create your first project'}
              </h3>
              <p className="text-muted-foreground max-w-sm">
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
