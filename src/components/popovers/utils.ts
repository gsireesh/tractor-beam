
export function normalizeNoteText(note: string | null) {
    if (note === null) return null;
    let normalizedNote = note;
    normalizedNote = normalizedNote.trim();

    return normalizedNote === "" ? null : normalizedNote;
}