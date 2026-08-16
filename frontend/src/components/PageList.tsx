export interface PageListProps {
  items: { label: string; duration?: string }[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export function PageList({ items, selectedIndex, onSelect }: PageListProps) {
  return (
    <ul className="page-list" role="listbox">
      {items.map((item, index) => (
        <li
          key={index}
          role="option"
          aria-selected={index === selectedIndex}
          className={index === selectedIndex ? "selected" : ""}
        >
          <button type="button" onClick={() => onSelect(index)}>
            <span>{item.label}</span>
            {item.duration && <span className="hint">{item.duration}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}
