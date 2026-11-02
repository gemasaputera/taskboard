import { useMutation } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/utils';
import { useAuth } from '../auth/AuthProvider';
import { setLastWorkplaceId } from './selection';

interface NewWorkplaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewWorkplaceDialog({ open, onOpenChange }: NewWorkplaceDialogProps) {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');

  const create = useMutation({
    mutationFn: (nextName: string) => api.createWorkplace(nextName),
    onSuccess: async (workplace) => {
      await refresh();
      setLastWorkplaceId(workplace.id);
      setName('');
      onOpenChange(false);
      navigate(`/app/w/${workplace.id}`);
      toast.success('Workplace created');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function submit() {
    const next = name.trim();
    if (next && !create.isPending) create.mutate(next);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New workplace</DialogTitle>
          <DialogDescription>
            Start another board with the same four default columns. You will be its owner.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="workplace-name">Workplace name</Label>
            <Input
              id="workplace-name"
              autoFocus
              value={name}
              maxLength={60}
              placeholder="Product team"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || create.isPending}>
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create workplace
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
