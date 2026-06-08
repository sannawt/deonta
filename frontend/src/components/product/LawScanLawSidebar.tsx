import type { LawScanResult } from "../../lib/api";
import { lawNameFromScanRow } from "../../lib/lawDisplayName";
import { WorkflowLawList } from "./WorkflowLawList";

interface Props {
  rows: LawScanResult[];
  focusedCode: string | null;
  onFocus: (code: string) => void;
}

export function LawScanLawSidebar({ rows, focusedCode, onFocus }: Props) {
  return (
    <WorkflowLawList
      minimal
      laws={rows.map((row) => ({
        code: row.code,
        name: lawNameFromScanRow(row),
      }))}
      focusedCode={focusedCode}
      onSelect={onFocus}
      emptyMessage="No regulations matched."
    />
  );
}
