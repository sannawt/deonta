import { useMemo } from "react";
import { type ScannedLawItem } from "../../lib/applicabilityScan";
import { lawNameFromScannedItem } from "../../lib/lawDisplayName";
import { WorkflowLawList } from "./WorkflowLawList";

interface Props {
  items: ScannedLawItem[];
  focusedCode: string | null;
  onSelect: (rowCode: string) => void;
}

export function ScopeLawSidebar({
  items,
  focusedCode,
  onSelect,
}: Props) {
  const laws = useMemo(
    () =>
      items.map((item) => ({
        code: item.rowCode,
        name: lawNameFromScannedItem(item),
      })),
    [items],
  );

  return (
    <WorkflowLawList
      minimal
      laws={laws}
      focusedCode={focusedCode}
      onSelect={onSelect}
      emptyMessage="No laws selected."
    />
  );
}
