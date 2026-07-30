import { useMemo, useState } from "react";
import {
  Alert,
  ApplicabilityReasoningPanel,
  ApplicabilityResultCard,
  AuditLogEntry,
  Breadcrumbs,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  Container,
  DataTable,
  Divider,
  Drawer,
  EmptyState,
  EvidenceItem,
  FormField,
  Grid,
  HumanReviewedLabel,
  IconButton,
  Inline,
  KeyValueList,
  LegalCitationBlock,
  LoadingState,
  MetricCard,
  ObligationCard,
  OwnerAvatar,
  PageHeader,
  Pagination,
  RadioGroup,
  RegulatoryChangeItem,
  SearchField,
  SectionHeader,
  SegmentedControl,
  Select,
  Skeleton,
  StatusBadge,
  StepIndicator,
  Switch,
  Tabs,
  TextInput,
  Textarea,
  Timeline,
  Tooltip,
  DesignSystemShell,
  type DsShowcaseView,
  AiAssessmentPanel,
  ApplicabilityBadge,
  RiskBadge,
  SourceBadge,
  JurisdictionBadge,
  AiGeneratedLabel,
} from "@/design-system";
import { MoreHorizontal } from "lucide-react";

const OBLIGATIONS = [
  {
    id: "ob-1",
    title: "Document lawful basis for audience segmentation",
    owner: "Maya Chen",
    due: "12 Aug 2026",
    status: "information_required" as const,
    evidence: "evidence_required" as const,
    controls: "Partial",
  },
  {
    id: "ob-2",
    title: "Maintain processor inventory for ad-tech vendors",
    owner: "Jonas Berg",
    due: "30 Jul 2026",
    status: "under_review" as const,
    evidence: "ready_for_review" as const,
    controls: "Covered",
  },
  {
    id: "ob-3",
    title: "Confirm AI Act high-risk classification path",
    owner: "Priya Nair",
    due: "5 Sep 2026",
    status: "draft" as const,
    evidence: "draft" as const,
    controls: "None",
  },
];

interface Props {
  onExit: () => void;
}

export function DesignSystemPage({ onExit }: Props) {
  const [view, setView] = useState<DsShowcaseView>("foundations");
  const [tab, setTab] = useState("buttons");
  const [segment, setSegment] = useState("open");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [switchOn, setSwitchOn] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [sortId, setSortId] = useState("title");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = OBLIGATIONS.filter((r) => !q || r.title.toLowerCase().includes(q));
    rows = [...rows].sort((a, b) => {
      const av = String(a[sortId as keyof typeof a] ?? "");
      const bv = String(b[sortId as keyof typeof b] ?? "");
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return rows;
  }, [search, sortId, sortDir]);

  return (
    <DesignSystemShell view={view} onViewChange={setView} onExit={onExit}>
      {view === "foundations" ? <FoundationsView /> : null}
      {view === "components" ? (
        <ComponentsView
          tab={tab}
          setTab={setTab}
          segment={segment}
          setSegment={setSegment}
          switchOn={switchOn}
          setSwitchOn={setSwitchOn}
          dialogOpen={dialogOpen}
          setDialogOpen={setDialogOpen}
          drawerOpen={drawerOpen}
          setDrawerOpen={setDrawerOpen}
        />
      ) : null}
      {view === "dashboard" ? <DashboardView /> : null}
      {view === "applicability" ? <ApplicabilityView /> : null}
      {view === "obligations" ? (
        <ObligationsView
          search={search}
          setSearch={setSearch}
          rows={filteredRows}
          selected={selected}
          setSelected={setSelected}
          sortId={sortId}
          sortDir={sortDir}
          onSort={(id) => {
            if (sortId === id) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
            else {
              setSortId(id);
              setSortDir("asc");
            }
          }}
          page={page}
          setPage={setPage}
        />
      ) : null}
      {view === "changes" ? <ChangesView /> : null}
    </DesignSystemShell>
  );
}

function FoundationsView() {
  const swatches = [
    ["Page", "bg-ds-page", "border-ds-border"],
    ["Surface", "bg-ds-surface", "border-ds-border"],
    ["Subtle", "bg-ds-subtle", "border-ds-border"],
    ["Primary", "bg-ds-primary", "border-ds-primary"],
    ["Navy", "bg-ds-navy", "border-ds-navy"],
    ["Teal", "bg-ds-teal", "border-ds-teal"],
  ] as const;

  return (
    <Container>
      <PageHeader
        title="Foundations"
        description="Semantic tokens for colour, type, spacing, and elevation. Borders over shadows for workspace surfaces."
        breadcrumbs={
          <Breadcrumbs items={[{ label: "Design system" }, { label: "Foundations" }]} />
        }
      />
      <SectionHeader title="Colour tokens" description="Calm light workspace with navy navigation." />
      <Grid cols={3} className="mb-8">
        {swatches.map(([label, bg, border]) => (
          <div key={label} className={`rounded-ds-lg border p-4 ${bg} ${border}`}>
            <p className={`text-sm font-semibold ${bg.includes("primary") || bg.includes("navy") || bg.includes("teal") ? "text-white" : "text-ds-text-primary"}`}>
              {label}
            </p>
          </div>
        ))}
      </Grid>

      <SectionHeader title="Typography" />
      <Card className="mb-8 space-y-3">
        <p className="text-[length:var(--ds-text-display)] font-bold text-ds-text-primary">Display heading</p>
        <p className="text-[length:var(--ds-text-page-title)] font-bold text-ds-text-primary">Page title</p>
        <p className="text-base font-semibold text-ds-text-primary">Section / card title</p>
        <p className="text-sm text-ds-text-primary">Body text for dense operational content.</p>
        <p className="text-xs text-ds-text-secondary">Secondary metadata and supporting copy.</p>
        <p className="ds-citation">GDPR Art. 6(1)(f) · identifier / citation style</p>
        <p className="ds-legal-prose text-sm">
          Legal reading sample: Processing is lawful only if and to the extent that at least one of
          the conditions in this Article applies. Prefer constrained width and generous line height.
        </p>
      </Card>

      <SectionHeader title="Focus, radius, and elevation" />
      <Inline gap={3} className="mb-4">
        <Button className="ds-focus-ring">Focusable primary</Button>
        <span className="rounded-ds-sm border border-ds-border bg-ds-surface px-3 py-2 text-xs">
          Radius sm/md/lg for inputs, cards, dialogs
        </span>
        <span className="rounded-ds-md border border-ds-border bg-ds-surface px-3 py-2 text-xs shadow-ds-md">
          Shadow reserved for overlays
        </span>
      </Inline>
      <Alert tone="info" title="Accessibility">
        Focus rings remain visible. Colour is never the only status cue — badges include icons and
        accessible descriptions.
      </Alert>
    </Container>
  );
}

function ComponentsView(props: {
  tab: string;
  setTab: (v: string) => void;
  segment: string;
  setSegment: (v: string) => void;
  switchOn: boolean;
  setSwitchOn: (v: boolean) => void;
  dialogOpen: boolean;
  setDialogOpen: (v: boolean) => void;
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
}) {
  return (
    <Container>
      <PageHeader
        title="Components"
        description="Reusable primitives with default, disabled, loading, and feedback states."
        breadcrumbs={<Breadcrumbs items={[{ label: "Design system" }, { label: "Components" }]} />}
      />
      <Tabs
        value={props.tab}
        onChange={props.setTab}
        tabs={[
          { id: "buttons", label: "Actions" },
          { id: "forms", label: "Forms" },
          { id: "status", label: "Status" },
          { id: "feedback", label: "Feedback" },
        ]}
      />

      {props.tab === "buttons" ? (
        <div className="mt-5 space-y-4">
          <Inline gap={2}>
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="tertiary">Tertiary</Button>
            <Button variant="destructive">Destructive</Button>
            <Button loading>Saving</Button>
            <Button disabled>Disabled</Button>
            <IconButton label="More actions" variant="outline">
              <MoreHorizontal className="h-4 w-4" />
            </IconButton>
          </Inline>
          <StepIndicator
            steps={["Product facts", "Relevant laws", "Scope analysis", "Obligations", "Review worksheet"]}
            currentIndex={1}
          />
          <SegmentedControl
            ariaLabel="Queue filter"
            value={props.segment}
            onChange={props.setSegment}
            options={[
              { id: "open", label: "Open" },
              { id: "mine", label: "Assigned to me" },
              { id: "done", label: "Done" },
            ]}
          />
        </div>
      ) : null}

      {props.tab === "forms" ? (
        <div className="mt-5 grid max-w-xl gap-4">
          <FormField id="org" label="Organisation" required help="Legal entity under assessment.">
            <TextInput id="org" placeholder="Northwind Media Ltd" />
          </FormField>
          <FormField id="notes" label="Notes" error="Add at least 12 characters.">
            <Textarea id="notes" invalid defaultValue="Too short" />
          </FormField>
          <FormField id="region" label="Primary market">
            <Select id="region" defaultValue="eu">
              <option value="eu">EU / EEA</option>
              <option value="us">United States</option>
              <option value="uk">United Kingdom</option>
            </Select>
          </FormField>
          <SearchField aria-label="Search frameworks" />
          <Checkbox label="Processes personal data" description="Includes device or household identifiers." />
          <RadioGroup
            name="role"
            legend="Organisation role"
            value="controller"
            options={[
              { value: "controller", label: "Controller" },
              { value: "processor", label: "Processor" },
            ]}
          />
          <Inline gap={3}>
            <span className="text-sm text-ds-text-secondary">Notify on regulatory change</span>
            <Switch label="Notify on regulatory change" checked={props.switchOn} onCheckedChange={props.setSwitchOn} />
          </Inline>
        </div>
      ) : null}

      {props.tab === "status" ? (
        <div className="mt-5 space-y-3">
          <Inline gap={2}>
            <ApplicabilityBadge status="likely_applies" />
            <ApplicabilityBadge status="information_required" />
            <ApplicabilityBadge status="confirmed_not_applicable" />
            <StatusBadge status="under_review" />
            <StatusBadge status="approved" />
            <RiskBadge level="high" />
            <SourceBadge label="EUR-Lex" />
            <JurisdictionBadge label="EU" />
            <AiGeneratedLabel />
            <HumanReviewedLabel />
            <OwnerAvatar name="Noga Adler" />
          </Inline>
        </div>
      ) : null}

      {props.tab === "feedback" ? (
        <div className="mt-5 space-y-3">
          <Alert tone="warning" title="Information required">
            Two company facts are still missing for GDPR material scope.
          </Alert>
          <LoadingState label="Refreshing framework map…" />
          <Skeleton className="h-10 w-full" />
          <EmptyState
            title="No obligations selected"
            description="Confirm applicability first, then generate an obligations worksheet."
            action={<Button size="sm">Open applicability</Button>}
          />
          <Inline gap={2}>
            <Button variant="secondary" onClick={() => props.setDialogOpen(true)}>
              Open confirm dialog
            </Button>
            <Button variant="secondary" onClick={() => props.setDrawerOpen(true)}>
              Open drawer
            </Button>
            <Tooltip content="Visible on hover and keyboard focus">
              <Button variant="tertiary">Tooltip target</Button>
            </Tooltip>
          </Inline>
          <ConfirmDialog
            open={props.dialogOpen}
            title="Send for legal review?"
            description="This will notify the assigned privacy counsel and lock AI edits until review completes."
            confirmLabel="Send for review"
            onCancel={() => props.setDialogOpen(false)}
            onConfirm={() => props.setDialogOpen(false)}
          />
          <Drawer open={props.drawerOpen} title="Edit owner" onClose={() => props.setDrawerOpen(false)}>
            <FormField id="owner" label="Owner">
              <TextInput id="owner" defaultValue="Maya Chen" />
            </FormField>
            <div className="mt-4">
              <Button onClick={() => props.setDrawerOpen(false)}>Save</Button>
            </div>
          </Drawer>
        </div>
      ) : null}
    </Container>
  );
}

function DashboardView() {
  return (
    <Container>
      <PageHeader
        title="Compliance dashboard"
        description="Work queues first — not decorative charts. Continue unfinished reviews and close evidence gaps."
        actions={<Button>New regulatory scoping</Button>}
        breadcrumbs={<Breadcrumbs items={[{ label: "Workspace" }, { label: "Dashboard" }]} />}
      />
      <Grid cols={4} className="mb-6">
        <MetricCard label="Needs review" value={7} hint="Decisions waiting on counsel" />
        <MetricCard label="Missing facts" value={4} hint="Blocking applicability" />
        <MetricCard label="Overdue obligations" value={2} hint="Past due date" />
        <MetricCard label="Evidence gaps" value={5} hint="Controls without proof" />
      </Grid>
      <Grid cols={2}>
        <Card>
          <SectionHeader title="Continue where you left off" />
          <ApplicabilityResultCard
            lawName="EU AI Act"
            jurisdiction="EU"
            status="information_required"
            explanation="Lookalike ranking may fall within AI Act material scope; Annex III classification still unclear."
            missingInfo={["Confirm whether outputs produce legal or similarly significant effects"]}
            reviewStatus="under_review"
            primaryAction={<Button size="sm">Resume</Button>}
          />
        </Card>
        <Card>
          <SectionHeader title="Regulatory changes" />
          <RegulatoryChangeItem
            regulation="ePrivacy Directive guidance update"
            summary="Updated enforcement note on device identifiers used for advertising measurement."
            published="2 Jul 2026"
            effective="1 Oct 2026"
            impact="medium"
            reviewer="Jonas Berg"
            affectedObligations={3}
            action={<Button size="sm" variant="secondary">Open inbox</Button>}
          />
        </Card>
      </Grid>
      <div className="mt-6">
        <SectionHeader title="Recent audit activity" />
        <div className="space-y-2">
          <AuditLogEntry
            action="Applicability status updated"
            user="Priya Nair"
            timestamp="10 Jul 2026, 14:22"
            previousValue="Likely applies"
            nextValue="Information required"
            reason="Vendor DPA status unknown"
            source="Assessment ASM-CTV01"
          />
          <AuditLogEntry
            action="Evidence uploaded"
            user="Maya Chen"
            timestamp="9 Jul 2026, 09:10"
            nextValue="Processor inventory v3.pdf"
            source="Obligation OB-12"
          />
        </div>
      </div>
    </Container>
  );
}

function ApplicabilityView() {
  return (
    <Container width="full" className="max-w-[1200px]">
      <PageHeader
        title="EU General Data Protection Regulation"
        description="Illustrative applicability review for a CTV audience measurement product. Structured scoping aid — not legal advice."
        status={<ApplicabilityBadge status="likely_applies" />}
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: "Workspace" },
              { label: "Assessments" },
              { label: "CTV household segment" },
              { label: "GDPR" },
            ]}
          />
        }
        actions={
          <Inline gap={2}>
            <Button variant="secondary">Mark not applicable</Button>
            <Button variant="outline">Request information</Button>
            <Button>Confirm applicable</Button>
          </Inline>
        }
      />
      <div className="mb-4">
        <StepIndicator
          steps={["Intake", "Framework map", "Human review", "Obligations"]}
          currentIndex={2}
        />
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <ApplicabilityReasoningPanel
            assessment="Based on current facts, GDPR is likely to apply to household and device-level audience data offered into the EU market. Confirmation is still needed on lawful basis documentation and vendor processor terms."
            facts={[
              "Product offered to EU audiences",
              "Processes viewing and device identifiers",
              "Partners receive aggregated segments",
            ]}
            assumptions={["Household graph is treated as personal data where re-identification is reasonably likely"]}
            missing={[
              "Documented lawful basis for segment creation",
              "Whether special-category inferences are generated",
            ]}
            exceptions={["Purely anonymous aggregates may fall outside material scope if irreversibly anonymised"]}
            sources={[
              {
                citation: "GDPR Art. 3",
                title: "Territorial scope",
                excerpt: "This Regulation applies to the processing of personal data in the context of activities of an establishment in the Union…",
              },
              {
                citation: "GDPR Art. 2",
                title: "Material scope",
                excerpt: "This Regulation applies to the processing of personal data wholly or partly by automated means…",
              },
            ]}
            actions={
              <>
                <Button size="sm">Accept assessment</Button>
                <Button size="sm" variant="secondary">
                  Send for legal review
                </Button>
              </>
            }
          />
          <Card>
            <SectionHeader title="Related obligations" />
            <ObligationCard
              title="Record of processing for audience segments"
              description="Maintain Art. 30 records covering purposes, categories of data, and recipients."
              source="GDPR Art. 30"
              owner="Maya Chen"
              dueDate="22 Aug 2026"
              controlCoverage="Partial"
              evidenceStatus="evidence_required"
              reviewStatus="ready_for_review"
              nextAction={<Button size="sm" variant="secondary">Open</Button>}
            />
          </Card>
          <LegalCitationBlock
            citation="GDPR Art. 6(1)"
            title="Lawfulness of processing"
            excerpt="Processing shall be lawful only if and to the extent that at least one of the following applies…"
          />
        </div>
        <aside className="space-y-3">
          <Card className="space-y-3">
            <SectionHeader title="Review context" />
            <KeyValueList
              items={[
                {
                  label: "Reviewer",
                  value: (
                    <span className="inline-flex items-center gap-2">
                      <OwnerAvatar name="Noga Adler" size="sm" />
                      Noga Adler
                    </span>
                  ),
                },
                { label: "Due date", value: "18 Jul 2026" },
                { label: "Human review", value: <HumanReviewedLabel /> },
                { label: "Decision", value: <StatusBadge status="under_review" /> },
              ]}
            />
            <Divider />
            <Button className="w-full" onClick={() => undefined}>
              Confirm applicable
            </Button>
            <Button className="w-full" variant="secondary">
              Request information
            </Button>
            <Button className="w-full" variant="outline">
              Send for legal review
            </Button>
          </Card>
          <Card>
            <SectionHeader title="Review history" />
            <Timeline
              events={[
                {
                  id: "1",
                  title: "AI draft generated",
                  meta: "8 Jul 2026 · system",
                  detail: "Likely applies — confirmation recommended",
                },
                {
                  id: "2",
                  title: "Assigned to privacy counsel",
                  meta: "9 Jul 2026 · Maya Chen",
                },
              ]}
            />
          </Card>
          <AiAssessmentPanel
            recommendation="Likely applies — requires confirmation"
            explanation="EU market offer plus personal data processing strongly indicate GDPR territorial and material scope."
            sources={["GDPR Art. 2", "GDPR Art. 3"]}
            assumptions={["Device IDs relate to identifiable natural persons"]}
            missingFacts={["Lawful basis documentation"]}
            reviewStatus="ready_for_review"
          />
        </aside>
      </div>
    </Container>
  );
}

function ObligationsView(props: {
  search: string;
  setSearch: (v: string) => void;
  rows: typeof OBLIGATIONS;
  selected: string[];
  setSelected: (ids: string[]) => void;
  sortId: string;
  sortDir: "asc" | "desc";
  onSort: (id: string) => void;
  page: number;
  setPage: (p: number) => void;
}) {
  return (
    <Container>
      <PageHeader
        title="Obligations"
        description="Track owners, due dates, control coverage, and evidence status for in-scope frameworks."
        actions={<Button>Export worksheet</Button>}
        breadcrumbs={<Breadcrumbs items={[{ label: "Workspace" }, { label: "Obligations" }]} />}
      />
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchField
          value={props.search}
          onChange={(e) => props.setSearch(e.target.value)}
          aria-label="Search obligations"
          className="max-w-sm"
        />
        <Inline gap={2}>
          <StatusBadge status="information_required" />
          <StatusBadge status="under_review" />
        </Inline>
      </div>
      <DataTable
        rows={props.rows}
        selectedIds={props.selected}
        onToggleRow={(id) =>
          props.setSelected(
            props.selected.includes(id)
              ? props.selected.filter((x) => x !== id)
              : [...props.selected, id],
          )
        }
        onToggleAll={() =>
          props.setSelected(
            props.selected.length === props.rows.length ? [] : props.rows.map((r) => r.id),
          )
        }
        sortId={props.sortId}
        sortDir={props.sortDir}
        onSort={props.onSort}
        bulkActions={
          <>
            <Button size="sm" variant="secondary">
              Assign owner
            </Button>
            <Button size="sm" variant="outline">
              Set due date
            </Button>
          </>
        }
        columns={[
          {
            id: "title",
            header: "Obligation",
            sortable: true,
            cell: (row) => <span className="font-medium">{row.title}</span>,
          },
          {
            id: "status",
            header: "Status",
            cell: (row) => <StatusBadge status={row.status} />,
          },
          {
            id: "owner",
            header: "Owner",
            sortable: true,
            cell: (row) => (
              <span className="inline-flex items-center gap-2">
                <OwnerAvatar name={row.owner} size="sm" />
                {row.owner}
              </span>
            ),
          },
          {
            id: "due",
            header: "Due date",
            sortable: true,
            cell: (row) => row.due,
          },
          {
            id: "controls",
            header: "Controls",
            cell: (row) => row.controls,
          },
          {
            id: "evidence",
            header: "Evidence",
            cell: (row) => <StatusBadge status={row.evidence} />,
          },
          {
            id: "actions",
            header: "Actions",
            cell: () => (
              <Button size="sm" variant="ghost">
                Open
              </Button>
            ),
          },
        ]}
      />
      <div className="mt-3 flex justify-end">
        <Pagination page={props.page} pageCount={3} onChange={props.setPage} />
      </div>
      <div className="mt-6">
        <SectionHeader title="Evidence linked to selected controls" />
        <div className="grid gap-2 md:grid-cols-2">
          <EvidenceItem
            name="Processor inventory v3.pdf"
            type="Document"
            control="Vendor management"
            owner="Jonas Berg"
            uploaded="1 Jul 2026"
            reviewDate="1 Jan 2027"
            status="approved"
          />
          <EvidenceItem
            name="Lawful basis memo — segments"
            type="Memo"
            control="Lawfulness"
            owner="Maya Chen"
            uploaded="—"
            reviewDate="12 Aug 2026"
            status="evidence_required"
          />
        </div>
      </div>
    </Container>
  );
}

function ChangesView() {
  return (
    <Container>
      <PageHeader
        title="Regulatory change inbox"
        description="Track publications that may affect obligations, assign reviewers, and record impact decisions."
        breadcrumbs={<Breadcrumbs items={[{ label: "Workspace" }, { label: "Regulatory changes" }]} />}
      />
      <SegmentedControl
        ariaLabel="Change status"
        value="new"
        onChange={() => undefined}
        options={[
          { id: "new", label: "New" },
          { id: "review", label: "Under review" },
          { id: "impact", label: "Impact confirmed" },
          { id: "none", label: "No action required" },
        ]}
      />
      <div className="mt-4 space-y-3">
        <RegulatoryChangeItem
          regulation="AI Act — governance chapter reminders"
          summary="Commission communication clarifying documentation expectations for high-risk AI providers."
          published="28 Jun 2026"
          effective="2 Aug 2026"
          impact="high"
          reviewer="Priya Nair"
          affectedObligations={6}
          action={<Button size="sm">Assign review</Button>}
        />
        <RegulatoryChangeItem
          regulation="Data Act — interoperability FAQ"
          summary="FAQ clarifying B2B data-sharing interfaces; may affect partnership products."
          published="15 Jun 2026"
          effective="12 Sep 2026"
          impact="medium"
          reviewer="Jonas Berg"
          affectedObligations={2}
          action={<Button size="sm" variant="secondary">Mark under review</Button>}
        />
        <RegulatoryChangeItem
          regulation="Market surveillance administrative update"
          summary="Procedural notice with no product impact for current catalog."
          published="3 Jun 2026"
          effective="3 Jun 2026"
          impact="low"
          reviewer="Maya Chen"
          affectedObligations={0}
          action={<Button size="sm" variant="outline">No action required</Button>}
        />
      </div>
    </Container>
  );
}
