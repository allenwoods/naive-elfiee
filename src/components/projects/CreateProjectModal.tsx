import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { LocationBreadcrumb } from "./LocationBreadcrumb";
import { cn } from "@/lib/utils";

interface CreateProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (project: {
    name: string;
    description: string;
  }) => void;
  existingNames: string[];
}

export const CreateProjectModal = ({
  open,
  onOpenChange,
  onCreate,
  existingNames,
}: CreateProjectModalProps) => {
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setProjectName("");
      setDescription("");
      setIsCreating(false);
      setNameError(null);
    }
  }, [open]);

  // Validate name on change
  useEffect(() => {
    if (projectName.trim()) {
      const normalizedInput = projectName.trim().toLowerCase();
      const isDuplicate = existingNames.some((name) => name.toLowerCase() === normalizedInput);
      if (isDuplicate) {
        setNameError("Project name already exists, please modify.");
      } else {
        setNameError(null);
      }
    } else {
      setNameError(null);
    }
  }, [projectName, existingNames]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleCreate = async () => {
    if (!projectName.trim() || nameError) return;

    setIsCreating(true);
    // Mock creation delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    onCreate({
      name: projectName.trim(),
      description: description.trim(),
    });

    handleClose();
  };

  const isValid = projectName.trim() && !nameError;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Project</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Project Name */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Project Name <span className="text-destructive">*</span>
            </label>
            <Input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g., User Onboarding"
              className={cn(nameError && "border-destructive focus-visible:ring-destructive")}
            />
            {nameError && <p className="text-sm text-destructive mt-1">{nameError}</p>}
          </div>

          {/* Location */}
          <LocationBreadcrumb projectName={projectName} />

          {/* Description */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Description <span className="text-muted-foreground">(Optional)</span>
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Briefly describe what this project is about..."
              rows={3}
            />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!isValid || isCreating}
              className="bg-primary hover:bg-primary/90"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Project"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
