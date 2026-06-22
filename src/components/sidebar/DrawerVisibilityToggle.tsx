export function DrawerVisibilityToggle({
  isOpen,
  onToggle,
}: {
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`tractor-beam-toggle-tab ${isOpen ? 'drawer-open' : ''}`}>
      <button onClick={onToggle} title={isOpen ? 'Collapse panel' : 'Open panel'}>
        <span className="chevron">&#x276E;</span>
      </button>
    </div>
  );
}
