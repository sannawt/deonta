import { useCallback, useEffect, useState } from "react";
import { type ProductRecord, specToKgFacts } from "../lib/productStore";
import { defaultAssessmentTitle, isDefaultAssessmentTitle, suggestAssessmentTitle } from "../lib/assessmentRef";
import { filterDiscoveryCodes } from "../lib/applicabilityScan";
import { resolveAssessment } from "../lib/assessment";
import { nanoid } from "../lib/utils";
import type { LawScanResult, SymbolicLawItem } from "../lib/api";
import { ProductIntakePanel } from "../components/product/ProductIntakePanel";
import { ProductKnowledgeGraph } from "../components/product/ProductKnowledgeGraph";
import { ApplicabilityStep } from "../components/product/ApplicabilityStep";
import { ObligationsStep } from "../components/product/ObligationsStep";
import { ReviewWorksheetStep } from "../components/product/ReviewWorksheetStep";
import { ThinkingOverlay } from "../components/ui/ThinkingOverlay";
import { WorkflowStepper, type TopTab } from "../components/product/WorkflowStepper";
import { pause, SLIDE_TRANSITION_MS } from "../lib/complianceChatFlow";
import { useProductIntake } from "../hooks/useProductIntake";
import type { ChatResponse } from "../types/chat";

const PREPARING_STEP_LABEL = "Preparing next step…";

type Step = "intake" | "laws" | "scope" | "obligations" | "worksheet";

interface WorksheetContext {
  lawCodes: string[];
  scanResults: LawScanResult[];
  symbolicLaws: SymbolicLawItem[];
  symbolicCodes: string[];
  includedDiscovery: string[];
  selectedObligationIds?: string[];
}

interface Props {
  resumeProduct?: ProductRecord | null;
  playbookCompanyId?: string;
  playbookId?: string;
  onComplete: (product: ProductRecord) => void;
  onNavigateHome: () => void;
  onOpenAssessmentDetail?: (productId: string) => void;
  onAddToAiRegister?: (assessmentId: string) => void;
}

function inferStep(product: ProductRecord): Step {
  if (product.lastWorksheet) return "worksheet";
  if (product.lastObligations?.selected_obligation_ids?.length) return "obligations";
  if (product.lastAssessment) return "scope";
  return "intake";
}

function worksheetContextFromProduct(product: ProductRecord): WorksheetContext {
  return {
    lawCodes: product.lastWorksheet?.law_codes ?? product.lastObligations?.law_codes ?? [],
    scanResults: [],
    symbolicLaws: [],
    symbolicCodes: ["gdpr", "ai_act"],
    includedDiscovery: filterDiscoveryCodes(product.spec.selectedLaws ?? []),
    selectedObligationIds: product.lastObligations?.selected_obligation_ids,
  };
}

export function ProductWorkflow({
  resumeProduct,
  onComplete,
  playbookCompanyId,
  playbookId,
  onNavigateHome: _onNavigateHome,
  onOpenAssessmentDetail,
  onAddToAiRegister,
}: Props) {
  const [step, setStep] = useState<Step>(() =>
    resumeProduct ? inferStep(resumeProduct) : "intake",
  );
  const [worksheetContext, setWorksheetContext] = useState<WorksheetContext | null>(() =>
    resumeProduct?.lastWorksheet || resumeProduct?.lastAssessment
      ? worksheetContextFromProduct(resumeProduct)
      : null,
  );
  const [step1Complete, setStep1Complete] = useState(() =>
    Boolean(
      resumeProduct?.spec.name?.trim() ||
        resumeProduct?.spec.summary?.trim() ||
        resumeProduct?.lastAssessment,
    ),
  );
  const [playbookSubTab, setPlaybookSubTab] = useState<"company" | "product" | "market">("company");
  const [preparingStep, setPreparingStep] = useState(false);
  const [assessmentId] = useState(() => resumeProduct?.id ?? nanoid());
  const [assessmentTitle, setAssessmentTitle] = useState(() =>
    resumeProduct?.label?.trim() || defaultAssessmentTitle(resumeProduct?.id ?? assessmentId),
  );
  const [titleSuggested, setTitleSuggested] = useState(false);
  const [savedAssessment, setSavedAssessment] = useState<ChatResponse | null>(
    () => resumeProduct?.lastAssessment?.response ?? null,
  );
  const [applicabilityAdvance, setApplicabilityAdvance] = useState<{
    canAdvance: boolean;
    busy: boolean;
    advance: () => void;
  } | null>(null);
  const [obligationsSave, setObligationsSave] = useState<{
    canSave: boolean;
    busy: boolean;
    save: () => void;
  } | null>(null);

  const handleAssessmentComplete = useCallback(
    (product: ProductRecord) => {
      const merged = {
        ...product,
        id: assessmentId,
        label: assessmentTitle.trim() || product.label,
        playbook_id: playbookId || product.playbook_id,
        spec: {
          ...product.spec,
          selectedLaws: filterDiscoveryCodes(product.spec.selectedLaws ?? []),
        },
      };
      setSavedAssessment(merged.lastAssessment?.response ?? null);
      onComplete(merged);
    },
    [assessmentId, assessmentTitle, onComplete, playbookId],
  );

  const {
    intake,
    patchIntake,
    fieldSources,
    extractSummary,
    files,
    setFiles,
    kgNodes,
    kgEdges,
    kgFacts,
    setKgFacts,
    spec,
    setSpec,
    parsing,
    error,
    setError,
    description,
    hasInput,
    setReviewed,
    runParse,
    scheduleParse,
  } = useProductIntake(playbookId);

  useEffect(() => {
    if (!resumeProduct) return;
    setSpec({
      ...resumeProduct.spec,
      selectedLaws: filterDiscoveryCodes(resumeProduct.spec.selectedLaws ?? []),
    });
    setKgFacts(resumeProduct.kgFacts ?? specToKgFacts(resumeProduct.spec));
    patchIntake({
      productName: resumeProduct.spec.name,
      productSummary: resumeProduct.spec.summary,
      markets: resumeProduct.spec.markets,
      processesPersonalData: resumeProduct.spec.processesPersonalData,
      gdprTerritorialLink: resumeProduct.spec.euLink,
      aiActTerritorialLink: resumeProduct.spec.euLink,
      hasAi: resumeProduct.spec.aiSystem,
    });
    setStep(inferStep(resumeProduct));
    setWorksheetContext(worksheetContextFromProduct(resumeProduct));
    setSavedAssessment(resumeProduct.lastAssessment?.response ?? null);
    setStep1Complete(
      Boolean(
        resumeProduct.spec.name?.trim() ||
          resumeProduct.spec.summary?.trim() ||
          resumeProduct.lastAssessment,
      ),
    );
    setReviewed(true);
    if (!resumeProduct.label?.trim()) {
      setAssessmentTitle(defaultAssessmentTitle(resumeProduct.id));
    } else {
      setAssessmentTitle(resumeProduct.label);
    }
  }, [resumeProduct, patchIntake, setKgFacts, setReviewed, setSpec]);

  const waitBeforeNextStep = useCallback(async () => {
    setPreparingStep(true);
    await pause(SLIDE_TRANSITION_MS);
    setPreparingStep(false);
  }, []);

  const lawsReady = hasInput || Boolean(savedAssessment) || step1Complete;
  const scopeReady = step1Complete || Boolean(savedAssessment) || step === "laws" || step === "scope";
  const canLeaveScope = Boolean(applicabilityAdvance?.canAdvance);
  const obligationsReady = Boolean(worksheetContext?.lawCodes.length) || canLeaveScope;

  function buildTopTabs(current: Step): TopTab[] {
    const worksheetEnabled =
      Boolean(worksheetContext?.selectedObligationIds?.length) ||
      Boolean(obligationsSave?.canSave) ||
      Boolean(resumeProduct?.lastWorksheet);

    return [
      {
        id: "playbook",
        label: "Company playbook",
        enabled: true,
        current: current === "intake",
        onClick: () => { setStep("intake"); setPlaybookSubTab("company"); },
        subTabs: [
          {
            id: "company",
            label: "Company",
            enabled: true,
            current: current === "intake" && playbookSubTab === "company",
            onClick: () => { setStep("intake"); setPlaybookSubTab("company"); },
          },
          {
            id: "product",
            label: "Product",
            enabled: true,
            current: current === "intake" && playbookSubTab === "product",
            onClick: () => { setStep("intake"); setPlaybookSubTab("product"); },
          },
          {
            id: "market",
            label: "Market",
            enabled: true,
            current: current === "intake" && playbookSubTab === "market",
            onClick: () => { setStep("intake"); setPlaybookSubTab("market"); },
          },
        ],
      },
      {
        id: "scope",
        label: "Scope Analysis",
        enabled: scopeReady,
        current: current === "laws" || current === "scope",
        onClick: () => {
          if (current === "laws" || current === "scope") return;
          if (step1Complete || savedAssessment) { setStep("laws"); return; }
          void goToLawsStep();
        },
        subTabs: [
          {
            id: "laws",
            label: "Laws",
            enabled: lawsReady,
            current: current === "laws",
            onClick: () => {
              if (current === "laws") return;
              if (step1Complete || savedAssessment) { setStep("laws"); return; }
              void goToLawsStep();
            },
          },
          {
            id: "reasoning",
            label: "Reasoning",
            enabled: scopeReady,
            current: current === "scope",
            onClick: () => {
              if (!scopeReady || current === "scope") return;
              setStep("scope");
            },
          },
          {
            id: "scope-reports",
            label: "Reports",
            enabled: scopeReady,
            current: false,
            onClick: () => {
              if (!scopeReady) return;
              setStep("scope");
            },
          },
        ],
      },
      {
        id: "obligations",
        label: "Obligations",
        enabled: obligationsReady,
        current: current === "obligations",
        onClick: () => {
          if (current === "obligations") return;
          if (worksheetContext?.lawCodes.length) { setStep("obligations"); return; }
          if (canLeaveScope) applicabilityAdvance?.advance();
        },
        subTabs: [
          {
            id: "reporting",
            label: "Reporting",
            enabled: obligationsReady,
            current: current === "obligations",
            onClick: () => {
              if (current === "obligations") return;
              if (worksheetContext?.lawCodes.length) { setStep("obligations"); return; }
              if (canLeaveScope) applicabilityAdvance?.advance();
            },
          },
          {
            id: "design-req",
            label: "Design requirements",
            enabled: obligationsReady,
            current: false,
            onClick: () => {
              if (!obligationsReady) return;
              if (worksheetContext?.lawCodes.length) setStep("obligations");
            },
          },
          {
            id: "overlapping",
            label: "Overlapping",
            enabled: obligationsReady,
            current: false,
            onClick: () => {
              if (!obligationsReady) return;
              if (worksheetContext?.lawCodes.length) setStep("obligations");
            },
          },
        ],
      },
      {
        id: "evidence",
        label: "Evidence",
        enabled: worksheetEnabled,
        current: current === "worksheet",
        onClick: () => {
          if (current === "worksheet") return;
          if (obligationsSave?.canSave) { obligationsSave.save(); return; }
          if (worksheetContext?.lawCodes.length) setStep("worksheet");
        },
        subTabs: [
          {
            id: "ev-reports",
            label: "Reports",
            enabled: worksheetEnabled,
            current: current === "worksheet",
            onClick: () => {
              if (current === "worksheet") return;
              if (obligationsSave?.canSave) { obligationsSave.save(); return; }
              if (worksheetContext?.lawCodes.length) setStep("worksheet");
            },
          },
          {
            id: "audits",
            label: "Audits",
            enabled: worksheetEnabled,
            current: false,
            onClick: () => {
              if (!worksheetEnabled) return;
              if (worksheetContext?.lawCodes.length) setStep("worksheet");
            },
          },
        ],
      },
      {
        id: "reports",
        label: "Reports",
        enabled: worksheetEnabled,
        current: false,
        onClick: () => {
          if (worksheetEnabled && worksheetContext?.lawCodes.length) setStep("worksheet");
        },
        subTabs: [],
      },
    ];
  }

  async function goToLawsStep() {
    if (!hasInput) {
      setError("Fill in product details or upload a document first.");
      return;
    }
    setError(null);
    if (isDefaultAssessmentTitle(assessmentTitle, assessmentId)) {
      const suggested = suggestAssessmentTitle({
        productName: intake.productName,
        productSummary: intake.productSummary,
        markets: intake.markets,
        organisationName: intake.organisationName,
      });
      if (suggested) {
        setAssessmentTitle(suggested);
        setTitleSuggested(true);
      }
    }
    await waitBeforeNextStep();
    setStep1Complete(true);
    setReviewed(true);
    setStep("laws");
  }

  function goToLawsFromIntake() {
    void goToLawsStep();
  }

  function createStubProduct(): ProductRecord {
    return {
      id: assessmentId,
      label: assessmentTitle,
      created_at: Date.now(),
      updated_at: Date.now(),
      spec,
      kgFacts,
      playbook_id: playbookId,
    };
  }

  function handleObligationsComplete(payload: {
    law_codes: string[];
    selected_obligation_ids: string[];
  }) {
    const base = resumeProduct ?? createStubProduct();
    const nextContext: WorksheetContext = {
      ...(worksheetContext ?? worksheetContextFromProduct(base)),
      lawCodes: payload.law_codes,
      selectedObligationIds: payload.selected_obligation_ids,
    };
    setWorksheetContext(nextContext);
    const product: ProductRecord = {
      ...base,
      id: assessmentId,
      label: assessmentTitle,
      playbook_id: playbookId,
      spec: {
        ...spec,
        selectedLaws: filterDiscoveryCodes(spec.selectedLaws ?? []),
      },
      kgFacts,
      lastAssessment: savedAssessment
        ? { created_at: Date.now(), prompt: description, response: savedAssessment }
        : base.lastAssessment,
      lastObligations: {
        created_at: Date.now(),
        law_codes: payload.law_codes,
        selected_obligation_ids: payload.selected_obligation_ids,
      },
      updated_at: Date.now(),
    };
    onComplete(product);
    void waitBeforeNextStep().then(() => setStep("worksheet"));
  }

  function handleWorksheetComplete() {
    const base = resumeProduct ?? createStubProduct();
    const resolved = resolveAssessment(savedAssessment);
    const openCount = resolved?.open_questions?.length ?? 0;
    const product: ProductRecord = {
      ...base,
      id: assessmentId,
      label: assessmentTitle,
      playbook_id: playbookId,
      spec: {
        ...spec,
        selectedLaws: filterDiscoveryCodes(spec.selectedLaws ?? []),
      },
      kgFacts,
      lastAssessment: savedAssessment
        ? { created_at: Date.now(), prompt: description, response: savedAssessment }
        : base.lastAssessment,
      lastObligations: worksheetContext?.selectedObligationIds
        ? {
            created_at: Date.now(),
            law_codes: worksheetContext.lawCodes,
            selected_obligation_ids: worksheetContext.selectedObligationIds,
          }
        : base.lastObligations,
      lastWorksheet: {
        created_at: Date.now(),
        law_codes: worksheetContext?.lawCodes ?? [],
        open_question_count: openCount,
      },
      updated_at: Date.now(),
    };
    onComplete(product);
    onOpenAssessmentDetail?.(product.id);
  }

  useEffect(() => {
    if (step !== "intake") return;
    scheduleParse();
  }, [intake, files, step, scheduleParse]);

  const sharedHeader = (current: Step) => (
    <WorkflowStepper
      topTabs={buildTopTabs(current)}
      assessmentId={assessmentId}
      assessmentTitle={assessmentTitle}
      onAssessmentTitleChange={setAssessmentTitle}
    />
  );

  if (step === "worksheet" && worksheetContext) {
    return (
      <div className="ct-app-page">
        <ThinkingOverlay show={preparingStep} label={PREPARING_STEP_LABEL} />
        {sharedHeader("worksheet")}
        <div className="ct-page ct-worksheet-page">
          <ReviewWorksheetStep
            assessmentId={assessmentId}
            assessmentTitle={assessmentTitle}
            onTitleChange={setAssessmentTitle}
            spec={spec}
            intake={intake}
            kgFacts={kgFacts}
            assessment={savedAssessment}
            scanResults={worksheetContext.scanResults}
            symbolicLaws={worksheetContext.symbolicLaws}
            symbolicCodes={worksheetContext.symbolicCodes}
            includedDiscovery={worksheetContext.includedDiscovery}
            onComplete={handleWorksheetComplete}
            onEditFrameworkMap={() => setStep("scope")}
            onEditIntake={() => setStep("intake")}
            onAddToAiRegister={
              onAddToAiRegister ? () => onAddToAiRegister(assessmentId) : undefined
            }
          />
        </div>
      </div>
    );
  }

  if (step === "obligations" && worksheetContext) {
    return (
      <div className="ct-app-page">
        <ThinkingOverlay show={preparingStep} label={PREPARING_STEP_LABEL} />
        {sharedHeader("obligations")}
        <div className="ct-page ct-obligations-page">
          <ObligationsStep
            lawCodes={worksheetContext.lawCodes}
            initialSelectedIds={worksheetContext.selectedObligationIds}
            onComplete={handleObligationsComplete}
            onSaveStateChange={setObligationsSave}
          />
        </div>
      </div>
    );
  }

  if (step === "laws" || step === "scope") {
    return (
      <div className="ct-app-page">
        <ThinkingOverlay show={preparingStep} label={PREPARING_STEP_LABEL} />
        {sharedHeader(step)}
        <div className="ct-page ct-applicability-page">
          <ApplicabilityStep
            key="applicability"
            spec={spec}
            description={description}
            kgFacts={kgFacts}
            playbookCompanyId={playbookCompanyId}
            playbookId={playbookId}
            assessmentId={assessmentId}
            assessmentLabel={assessmentTitle}
            onAssessmentLabelChange={(next) => {
              setAssessmentTitle(next);
              setTitleSuggested(false);
            }}
            titleSuggested={titleSuggested}
            initialAssessment={savedAssessment}
            phase={step === "laws" ? "laws" : "scope"}
            onComplete={handleAssessmentComplete}
            onContinueToWorksheet={(ctx) => {
              setWorksheetContext((prev) => ({
                ...ctx,
                selectedObligationIds: prev?.selectedObligationIds,
              }));
              void waitBeforeNextStep().then(() => setStep("obligations"));
            }}
            onAdvanceStateChange={setApplicabilityAdvance}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="ct-app-page">
      <ThinkingOverlay show={preparingStep} label={PREPARING_STEP_LABEL} />
      {sharedHeader("intake")}
      <div className="ct-page ct-product-flow">
        {error && <div className="err">{error}</div>}

        <ProductIntakePanel
          intake={intake}
          fieldSources={fieldSources}
          extractSummary={extractSummary}
          files={files}
          parsing={parsing}
          canContinue={hasInput}
          activeSubTab={playbookSubTab}
          onSubTabChange={setPlaybookSubTab}
          onIntakeChange={patchIntake}
          onFilesChange={setFiles}
          onRunParse={runParse}
          onSeeLaws={goToLawsFromIntake}
          graph={
            <div className="ct-intake-graph-column">
              <div className="ct-intake-graph-area">
                <ProductKnowledgeGraph nodes={kgNodes} edges={kgEdges} />
              </div>
            </div>
          }
        />
      </div>
    </div>
  );
}
