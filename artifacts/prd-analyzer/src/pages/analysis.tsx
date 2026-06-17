import { useParams, Link, useLocation } from "wouter";
import { useGetAnalysis, useSubmitGapFeedback, useDeleteAnalysis, getGetAnalysisQueryKey } from "@workspace/api-client-react";
import type { EngineReport, EngineSections } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  ArrowLeft, Loader2, ThumbsUp, ThumbsDown, Trash2, AlertTriangle,
  Shield, Zap, Database, CheckCircle2, ChevronRight, Activity, Download,
  Clock, Lightbulb, Bot, Cpu, XCircle, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type SeverityFilter = "all" | "critical" | "high" | "medium" | "low";
type SortMode = "severity" | "confidence";

const SEVERITY_ORDER: Record<string, number> = { critical: 1, high: 2, medium: 3, low: 4 };

const SECTION_LABELS: { key: keyof Omit<EngineSections, "totalDetected" | "totalExpected" | "completenessPercent" | "missingSections">; label: string }[] = [
  { key: "problemStatement", label: "Problem statement" },
  { key: "goal", label: "Goals" },
  { key: "scope", label: "Scope" },
  { key: "acceptanceCriteria", label: "Acceptance criteria" },
  { key: "assumptions", label: "Assumptions" },
  { key: "edgeCases", label: "Edge cases" },
  { key: "dependencies", label: "Dependencies" },
  { key: "errorHandling", label: "Error handling" },
];

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

function getScoreColor(score: number): string {
  if (score >= 75) return "#3B6D11";
  if (score >= 60) return "#EF9F27";
  return "#E24B4A";
}

function getGradeStyle(grade: string): { bg: string; text: string; border: string } {
  if (grade === "A" || grade === "B") return { bg: "#EAF3DE", text: "#27500A", border: "#97C459" };
  if (grade === "C") return { bg: "#FAEEDA", text: "#633806", border: "#EF9F27" };
  return { bg: "#FCEBEB", text: "#791F1F", border: "#F09595" };
}

function getSeverityStyle(severity: string): { bg: string; text: string; border: string } {
  switch (severity.toLowerCase()) {
    case "critical": return { bg: "#FCEBEB", text: "#791F1F", border: "#F09595" };
    case "high":     return { bg: "#FAEEDA", text: "#633806", border: "#EF9F27" };
    case "medium":   return { bg: "#E6F1FB", text: "#0C447C", border: "#85B7EB" };
    case "low":      return { bg: "#EAF3DE", text: "#27500A", border: "#97C459" };
    default:         return { bg: "#F3F4F6", text: "#374151", border: "#D1D5DB" };
  }
}

function SeverityBadge({ severity }: { severity: string }) {
  const s = getSeverityStyle(severity);
  const label = severity.charAt(0).toUpperCase() + severity.slice(1);
  return (
    <span style={{
      background: s.bg,
      color: s.text,
      border: `1px solid ${s.border}`,
      fontSize: 12,
      fontWeight: 500,
      padding: "3px 10px",
      borderRadius: 20,
      whiteSpace: "nowrap",
      lineHeight: 1,
    }}>
      ● {label}
    </span>
  );
}

function ReadinessCard({ report }: { report: EngineReport }) {
  const { confidence, sections, summary, processingTimeMs } = report;
  const score = confidence.totalScore;
  const color = getScoreColor(score);
  const gradeStyle = getGradeStyle(confidence.grade);

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      {/* Top row: ring + label + grade */}
      <div className="flex items-center gap-4">
        {/* Circular ring */}
        <div
          className="shrink-0 flex flex-col items-center justify-center"
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            border: `3px solid ${color}`,
          }}
        >
          <span style={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {score}
          </span>
          <span style={{ fontSize: 11, color: "var(--color-muted-foreground)", lineHeight: 1, marginTop: 2 }}>
            /100
          </span>
        </div>

        {/* Label + grade + interpretation */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg font-semibold leading-tight">{summary.readinessLabel}</span>
            <span style={{
              background: gradeStyle.bg,
              color: gradeStyle.text,
              border: `1px solid ${gradeStyle.border}`,
              fontSize: 12,
              fontWeight: 600,
              padding: "2px 10px",
              borderRadius: 20,
            }}>
              Grade {confidence.grade}
            </span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{confidence.interpretation}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.max(2, score)}%`, background: color }}
        />
      </div>

      {/* 3 mini stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Sections", value: `${sections.totalDetected} of ${sections.totalExpected}` },
          { label: "Issues found", value: String(summary.totalIssuesFound) },
          { label: "Logic engine", value: `${processingTimeMs}ms` },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg bg-muted/50 px-3 py-2 text-center space-y-0.5"
          >
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }} className="text-muted-foreground font-medium">
              {stat.label}
            </div>
            <div className="text-sm font-semibold font-mono">{stat.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AISummaryCard({ summary }: { summary: string }) {
  return (
    <div
      className="rounded-lg border border-border bg-card p-4 space-y-2"
      style={{ borderLeft: "3px solid #7F77DD" }}
    >
      <div className="flex items-center gap-1.5">
        <span style={{
          background: "#EEEDFE",
          color: "#3C3489",
          border: "1px solid #AFA9EC",
          fontSize: 11,
          fontWeight: 600,
          padding: "2px 8px",
          borderRadius: 20,
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
        }}>
          <Sparkles className="w-3 h-3" />
          GPT-4o analysis
        </span>
      </div>
      <p style={{ fontSize: 14, lineHeight: 1.6 }} className="text-muted-foreground">{summary}</p>
    </div>
  );
}

function SectionCoveragePanel({ sections }: { sections: EngineSections }) {
  const completeness = sections.completenessPercent;
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <span style={{ fontSize: 14, fontWeight: 500 }}>Section coverage</span>
        <span style={{ fontSize: 13 }} className="text-muted-foreground">
          {sections.totalDetected} of {sections.totalExpected} complete
        </span>
      </div>
      <div className="px-4 pb-2">
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${completeness}%`, background: "#3B6D11" }}
          />
        </div>
      </div>
      <div className="px-4 pb-3 grid grid-cols-2 gap-x-4">
        {SECTION_LABELS.map(({ key, label }) => {
          const present = sections[key] as boolean;
          return (
            <div key={key} className="flex items-center gap-1.5 py-1">
              {present ? (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: "#3B6D11" }} />
              ) : (
                <XCircle className="w-3.5 h-3.5 shrink-0" style={{ color: "#E24B4A" }} />
              )}
              <span style={{
                fontSize: 13,
                color: present ? "var(--color-muted-foreground)" : "#E24B4A",
              }}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color = pct > 80 ? "#3B6D11" : pct >= 50 ? "#EF9F27" : "#E24B4A";
  return (
    <div className="flex items-center gap-1.5">
      <div
        style={{
          width: 80,
          height: 6,
          borderRadius: 3,
          background: "var(--color-muted)",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
            borderRadius: 3,
          }}
        />
      </div>
      <span style={{ fontSize: 12 }} className="text-muted-foreground">
        {pct}% confidence
      </span>
    </div>
  );
}

export default function AnalysisDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const analysisId = parseInt(id || "0", 10);

  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("severity");

  const { data: analysis, isLoading, isError } = useGetAnalysis(analysisId, {
    query: {
      enabled: !!analysisId && !isNaN(analysisId),
      queryKey: getGetAnalysisQueryKey(analysisId),
    },
  });

  const deleteAnalysis = useDeleteAnalysis({
    mutation: { onSuccess: () => setLocation("/history") },
  });

  const submitFeedback = useSubmitGapFeedback({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(analysisId) });
      },
    },
  });

  const filteredGaps = useMemo(() => {
    if (!analysis) return [];
    let gaps = [...analysis.gaps];
    if (severityFilter !== "all") {
      gaps = gaps.filter((g) => g.severity === severityFilter);
    }
    if (sortMode === "severity") {
      gaps.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 5) - (SEVERITY_ORDER[b.severity] ?? 5));
    } else {
      gaps.sort((a, b) => b.confidence - a.confidence);
    }
    return gaps;
  }, [analysis, severityFilter, sortMode]);

  const severityCounts = useMemo(() => {
    if (!analysis) return { critical: 0, high: 0, medium: 0, low: 0 };
    return analysis.gaps.reduce(
      (acc, g) => {
        const key = g.severity as keyof typeof acc;
        if (key in acc) acc[key]++;
        return acc;
      },
      { critical: 0, high: 0, medium: 0, low: 0 }
    );
  }, [analysis]);

  function handleExportJson() {
    if (!analysis) return;
    const exportData = {
      id: analysis.id,
      title: analysis.title,
      analyzedAt: analysis.createdAt,
      engineReport: analysis.engineReport,
      aiSummary: analysis.aiSummary,
      totalGaps: analysis.gaps.length,
      gaps: analysis.gaps.map((g) => ({
        gapType: g.gapType,
        severity: g.severity,
        confidence: g.confidence,
        source: g.source,
        description: g.description,
        recommendation: g.recommendation,
      })),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const titleSlug = analysis.title ? slugify(analysis.title) : `analysis-${analysis.id}`;
    a.download = `${titleSlug}-gaps.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const getGapIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes("security")) return <Shield className="w-4 h-4 shrink-0" />;
    if (t.includes("scale") || t.includes("performance")) return <Zap className="w-4 h-4 shrink-0" />;
    if (t.includes("data") || t.includes("state")) return <Database className="w-4 h-4 shrink-0" />;
    return <AlertTriangle className="w-4 h-4 shrink-0" />;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-muted-foreground gap-4">
        <Loader2 className="w-8 h-8 animate-spin" />
        <div className="text-sm">Retrieving analysis results...</div>
      </div>
    );
  }

  if (isError || !analysis) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-bold text-destructive mb-2">Analysis Not Found</h2>
        <Button variant="outline" asChild>
          <Link href="/history">Back to History</Link>
        </Button>
      </div>
    );
  }

  const engineReport = analysis.engineReport;
  const aiSummary = analysis.aiSummary;
  const hasEngineData = !!engineReport;

  const aiGapCount = analysis.gaps.filter((g) => g.source === "ai").length;
  const logicGapCount = analysis.gaps.filter((g) => g.source === "logic-engine").length;

  const severityFilterButtons: { key: SeverityFilter; label: string }[] = [
    { key: "critical", label: "Critical" },
    { key: "high", label: "High" },
    { key: "medium", label: "Medium" },
    { key: "low", label: "Low" },
  ];

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" asChild className="h-8 w-8 mt-0.5 shrink-0">
            <Link href="/history"><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono mb-0.5">
              <Link href="/history" className="hover:text-foreground transition-colors flex items-center gap-1">
                <Clock className="w-3 h-3" />
                History
              </Link>
              <span className="text-border">/</span>
              <span className="text-foreground truncate max-w-[200px]">
                {analysis.title || `Analysis #${analysis.id}`}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight leading-tight">
              {analysis.title || `Analysis #${analysis.id}`}
            </h1>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span>{new Date(analysis.createdAt).toLocaleString()}</span>
              <span className="text-border">|</span>
              <span>{analysis.gaps.length} gaps identified</span>
              {logicGapCount > 0 && (
                <>
                  <span className="text-border">|</span>
                  <span className="flex items-center gap-1" style={{ color: "#0C447C" }}>
                    <Cpu className="w-3 h-3" />{logicGapCount} engine
                  </span>
                </>
              )}
              {aiGapCount > 0 && (
                <>
                  <span className="text-border">|</span>
                  <span className="flex items-center gap-1" style={{ color: "#3C3489" }}>
                    <Bot className="w-3 h-3" />{aiGapCount} AI
                  </span>
                </>
              )}
              {severityCounts.critical > 0 && (
                <>
                  <span className="text-border">|</span>
                  <span style={{ color: "#791F1F" }}>{severityCounts.critical} critical</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleExportJson}>
            <Download className="w-4 h-4 mr-1.5" />
            Export JSON
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (confirm("Delete this analysis? This cannot be undone.")) {
                deleteAnalysis.mutate({ id: analysis.id });
              }
            }}
            disabled={deleteAnalysis.isPending}
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            Delete
          </Button>
        </div>
      </div>

      {/* Split view */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start flex-1">
        {/* Left: PRD text + section coverage */}
        <div className="flex flex-col gap-3" style={{ height: "calc(100vh - 16rem)" }}>
          <Card className="bg-card/50 flex flex-col flex-1 overflow-hidden">
            <CardHeader className="py-2.5 px-4 border-b border-border bg-muted/20 shrink-0">
              <CardTitle className="text-xs font-mono flex items-center gap-2 text-muted-foreground">
                <ChevronRight className="w-3.5 h-3.5" />
                ORIGINAL_PRD.md
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                  {analysis.prdText}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {hasEngineData && (
            <div className="shrink-0">
              <SectionCoveragePanel sections={engineReport!.sections} />
            </div>
          )}
        </div>

        {/* Right: readiness card + AI summary + gaps panel */}
        <div className="flex flex-col gap-3" style={{ height: "calc(100vh - 16rem)" }}>
          {/* Readiness card */}
          {hasEngineData && <ReadinessCard report={engineReport!} />}

          {/* AI Summary */}
          {aiSummary && <AISummaryCard summary={aiSummary} />}

          {/* Severity filter buttons */}
          <div className="grid grid-cols-4 gap-2 shrink-0">
            {severityFilterButtons.map(({ key, label }) => {
              const s = getSeverityStyle(key);
              const isActive = severityFilter === key;
              return (
                <button
                  key={key}
                  onClick={() => setSeverityFilter(severityFilter === key ? "all" : key)}
                  className="rounded-md px-2 py-2 text-center transition-all"
                  style={{
                    background: s.bg,
                    color: s.text,
                    border: `1px solid ${isActive ? s.text : s.border}`,
                    outline: isActive ? `2px solid ${s.border}` : "none",
                    outlineOffset: 1,
                    opacity: !isActive && severityFilter !== "all" ? 0.6 : 1,
                  }}
                >
                  <div className="text-lg font-bold font-mono leading-none">
                    {severityCounts[key]}
                  </div>
                  <div style={{ fontSize: 9, textTransform: "uppercase", marginTop: 2 }}>
                    {label}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Filter + sort controls */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-xs font-mono font-bold flex items-center gap-1.5 text-foreground mr-auto">
              <Activity className="w-3.5 h-3.5" />
              ENGINEERING_GAPS ({filteredGaps.length})
            </div>
            <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as SeverityFilter)}>
              <SelectTrigger className="h-7 text-xs w-32 font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
              <SelectTrigger className="h-7 text-xs w-32 font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="severity">By Severity</SelectItem>
                <SelectItem value="confidence">By Confidence</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Gap cards */}
          <ScrollArea className="flex-1 pr-1">
            <div className="space-y-3 pt-1">
              {filteredGaps.map((gap) => (
                <div key={gap.id} className="rounded-lg border border-border bg-card overflow-hidden">
                  {/* Top section */}
                  <div className="px-4 py-3 space-y-2.5">
                    {/* Header row: icon + type + severity LEFT, source badge RIGHT */}
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{getGapIcon(gap.gapType)}</span>
                      <span style={{ fontSize: 14, fontWeight: 500 }} className="truncate">
                        {gap.gapType}
                      </span>
                      <SeverityBadge severity={gap.severity} />
                      {/* Source badge pushed to right */}
                      <span style={{ marginLeft: "auto" }}>
                        {gap.source === "ai" ? (
                          <span style={{
                            background: "#EEEDFE",
                            color: "#3C3489",
                            border: "1px solid #AFA9EC",
                            fontSize: 12,
                            fontWeight: 500,
                            padding: "3px 10px",
                            borderRadius: 20,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            whiteSpace: "nowrap",
                          }}>
                            <Sparkles className="w-3 h-3" />AI detected
                          </span>
                        ) : (
                          <span style={{
                            background: "#E6F1FB",
                            color: "#0C447C",
                            border: "1px solid #85B7EB",
                            fontSize: 12,
                            fontWeight: 500,
                            padding: "3px 10px",
                            borderRadius: 20,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            whiteSpace: "nowrap",
                          }}>
                            <Cpu className="w-3 h-3" />Logic engine
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Description */}
                    <p style={{ fontSize: 14, lineHeight: 1.6 }} className="text-foreground">
                      {gap.description}
                    </p>

                    {/* Confidence bar + feedback */}
                    <div className="flex items-center justify-between">
                      <ConfidenceBar confidence={gap.confidence} />
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs text-muted-foreground hover:text-green-500 px-2"
                          onClick={() => submitFeedback.mutate({ id: gap.id, data: { isHelpful: true } })}
                        >
                          <ThumbsUp className="w-3 h-3 mr-1" />
                          <span className="font-mono">{gap.helpfulCount || 0}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs text-muted-foreground hover:text-red-500 px-2"
                          onClick={() => submitFeedback.mutate({ id: gap.id, data: { isHelpful: false } })}
                        >
                          <ThumbsDown className="w-3 h-3 mr-1" />
                          <span className="font-mono">{gap.notHelpfulCount || 0}</span>
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Recommendation section */}
                  {gap.recommendation && (
                    <div
                      className="px-4 py-2.5 flex items-start gap-2"
                      style={{
                        borderTop: "1px solid var(--color-border)",
                        background: "var(--color-muted)",
                      }}
                    >
                      <Lightbulb className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#EF9F27" }} />
                      <p style={{ fontSize: 13, lineHeight: 1.5 }} className="text-muted-foreground">
                        {gap.recommendation}
                      </p>
                    </div>
                  )}
                </div>
              ))}

              {filteredGaps.length === 0 && (
                <div className="p-8 text-center text-muted-foreground border border-dashed border-border rounded-lg bg-card/30 flex flex-col items-center">
                  <CheckCircle2 className="w-8 h-8 mb-2 opacity-50" style={{ color: "#3B6D11" }} />
                  <p className="text-sm">
                    {severityFilter !== "all"
                      ? `No ${severityFilter} gaps found.`
                      : "No engineering gaps detected."}
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
