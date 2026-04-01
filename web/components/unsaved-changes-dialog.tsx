"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Confirmation dialog shown when the user tries to switch files with unsaved
 * changes. Offers two options: discard changes and switch, or cancel and stay.
 */
export function UnsavedChangesDialog({
  open,
  onDiscard,
  onCancel,
}: {
  open: boolean;
  onDiscard: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Unsaved changes</DialogTitle>
          <DialogDescription>
            You have unsaved changes. Switching files will discard them.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onDiscard}>
            Discard changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
