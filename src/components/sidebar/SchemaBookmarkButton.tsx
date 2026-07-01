import { useEffect, useRef, useState } from 'react';
import { Bookmark } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton.tsx';
import { schemaRepo } from '@/storage/repositories.ts';
import type { Schema } from '@/lib/definitions.ts';

export interface SchemaBookmarkButtonProps {
  schema: Schema;
}

/**
 * Records a snapshot (user version) of the current schema — the creation side of
 * the schema history's bookmark indicators. Snapshotting is a persistence
 * concern, not a SchemaAction (doc 02), so this calls the repo write seam
 * directly rather than dispatching. Briefly tints the icon as save feedback.
 */
export function SchemaBookmarkButton({ schema }: SchemaBookmarkButtonProps) {
  const [justSaved, setJustSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => clearTimeout(timer.current ?? undefined), []);

  async function bookmark() {
    await schemaRepo.snapshot(schema);
    setJustSaved(true);
    clearTimeout(timer.current ?? undefined);
    timer.current = setTimeout(() => setJustSaved(false), 1500);
  }

  return (
    <IconButton
      title={justSaved ? 'Version bookmarked' : 'Bookmark this version'}
      icon={Bookmark}
      color={justSaved ? '#9370DB' : null}
      onClick={() => void bookmark()}
    />
  );
}
