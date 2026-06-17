import { useParams, Link, useLocation } from "wouter";
import { useGetAnalysis, useSubmitGapFeedback, useDeleteAnalysis, getGetAnalysisQueryKey } from "@workspace/api-client-react";
import type { EngineReport, EngineSections } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  ArrowLeft, Loader2, ThumbsUp, ThumbsDown, Trash2, AlertTriangle,
  Shield, Zap, Database, CheckCircle2, ChevronRight, Activity, Download,
  Clock, Lightbulb, Bot, Cpu, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type SeverityFilter = "all" | "critical" | "high" | "medium" | "low";
type SortMode = "severity" | "confidence";

const SEVERITY_ORDER: Record<string, number> = { critical: 1, high: 2, medium: 3, low: 4 };

const SECTION_LABELS: { key: keyof Omit<EngineSections, "totalDetected" | "totalExpected" | "completenessPercent" | "missingSections">; label: string }[] = [
  { key: "problemStatement", label: "Problem Statement" },
  { key: "goal", label: "Goal" },
  { key: "scope", label: "Scope" },
  { key: "acceptanceCriteria", label: "Acceptance Criteria" },
  { key: "assumptions", label: "Assumptions" },
  { key: "edgeCases", label: "Edge Cases" },
  { key: "dependencies", label: "Dependencies" },
  { key: "errorHandling", label: "Error Handling" },
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

function gradeColor(grade: string): string {
  switch (grade) {
    case "A": return "text-green-500 border-green-500/40 bg-green-500/10";
    case "B": return "text-emerald-500 border-emerald-500/40 bg-emerald-500/10";
    case "C": return "text-yellow-500 border-yellow-500/40 bg-yellow-500/10";
    case "D": return "text-orange-500 border-orange-500/40 bg-orange-500/10";
    default:  return "text-destructive border-destructive/40 bg-destructive/10";
  }
}

function scoreBarColor(score: number): string {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-emerald-500";
  if (score >= 40) return "bg-yellow-500";
  if (score >= 25) return "bg-orange-500";
  return "bg-destructive";
}

function ReadinessCard({ report }: { report: EngineReport }) {
  const { confidence, sections, summary, processingTimeMs } = report;
  const barW = Math.max(2, confidence.totalScore);

  return (
    <Card className="bg-card/60 border-border">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          {/* Score + grade */}
          <div className="flex items-center gap-3 shrink-0">
            <div className={`w-16 h-16 rounded-lg border-2 flex flex-col items-center justify-center ${gradeColor(confidence.grade)}`}>
              <span className="text-2xl font-black font-mono leading-none">{confidence.grade}</span>
            </div>
            <div>
              <div className="text-3xl font-black font-mono leading-none">
                {confidence.totalScore}
                <span className="text-sm font-normal text-muted-foreground">/100</span>
              </div>
              <div className={`text-xs font-semibold mt-0.5 ${gradeColor(confidence.grade).split(" ")[0]}`}>
                {summary.readinessLabel}
              </div>
            </div>
          </div>

          {/* Score bar + interpretation */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${scoreBarColor(confidence.totalScore)}`}
                style={{ width: `${barW}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {confidence.interpretation}
            </p>
          </div>

          {/* Mini stats */}
          <div className="flex sm:flex-col gap-3 sm:gap-1.5 shrink-0 text-right">
            <div>
              <div className="text-[10px] font-mono text-muted-foreground uppercase">Sections</div>
              <div className="text-sm font-bold font-mono">
                {sections.totalDetected}
                <span className="text-muted-foreground font-normal">/{sections.totalExpected}</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-mono text-muted-foreground uppercase">Issues</div>
              <div className="text-sm font-bold font-mono">{summary.totalIssuesFound}</div>
            </div>
            <div>
              <div className="text-[10px] font-mono text-muted-foreground uppercase">Engine</div>
              <div className="text-sm font-bold font-mono">{processingTimeMs}ms</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AISummaryCard({ summary }: { summary: string }) {
  return (
    <Card className="bg-card/60 border-indigo-500/20 border-l-4 border-l-indigo-500">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
            <div className="w-5 h-5 rounded-sm bg-indigo-500/20 flex items-center justify-center">
              <Bot className="w-3 h-3 text-indigo-400" />
            </div>
            <span className="text-[10px] font-mono font-semibold text-indigo-400 uppercase tracking-wide">GPT-4o</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionCoveragePanel({ sections }: { sections: EngineSections }) {
  return (
    <Card className="bg-card/40 border-border/60">
      <CardHeader className="py-2 px-4 border-b border-border/40">
        <CardTitle className="text-[10px] font-mono text-muted-foreground flex items-center gap-1.5">
          <Activity className="w-3 h-3" />
          SECTION_COVERAGE — {sections.completenessPercent.toFixed(0)}% complete
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {SECTION_LABELS.map(({ key, label }) => {
            const present = sections[key] as boolean;
            return (
              <div key={key} className="flex items-center gap-1.5">
                {present ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-destructive/70 shrink-0" />
                )}
                <span className={`text-[11px] font-mono ${present ? "text-muted-foreground" : "text-destructive/80"}`}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
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

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical": return "bg-destructive/10 text-destructive border-destructive/20";
      case "high": return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "medium": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "low": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getGapIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes("security")) return <Shield className="w-4 h-4" />;
    if (t.includes("scale") || t.includes("performance")) return <Zap className="w-4 h-4" />;
    if (t.includes("data") || t.includes("state")) return <Database className="w-4 h-4" />;
    return <AlertTriangle className="w-4 h-4" />;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-muted-foreground gap-4">
        <Loader2 className="w-8 h-8 animate-spin" />
        <div className="font-mono text-sm">Retrieving analysis results...</div>
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
            <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono flex-wrap">
              <span>{new Date(analysis.createdAt).toLocaleString()}</span>
              <span className="text-border">|</span>
              <span>{analysis.gaps.length} gaps identified</span>
              {logicGapCount > 0 && (
                <>
                  <span className="text-border">|</span>
                  <span className="text-blue-500 flex items-center gap-1">
                    <Cpu className="w-3 h-3" />{logicGapCount} engine
                  </span>
                </>
              )}
              {aiGapCount > 0 && (
                <>
                  <span className="text-border">|</span>
                  <span className="text-indigo-400 flex items-center gap-1">
                    <Bot className="w-3 h-3" />{aiGapCount} AI
                  </span>
                </>
              )}
              {severityCounts.critical > 0 && (
                <>
                  <span className="text-border">|</span>
                  <span className="text-destructive">{severityCounts.critical} critical</span>
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

      {/* Readiness Score Card */}
      {hasEngineData && <ReadinessCard report={engineReport!} />}

      {/* AI Summary Card */}
      {aiSummary && <AISummaryCard summary={aiSummary} />}

      {/* Split view */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start flex-1">
        {/* Left: original PRD + section coverage */}
        <div className="flex flex-col gap-3" style={{ height: "calc(100vh - 20rem)" }}>
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

        {/* Right: gaps panel */}
        <div className="flex flex-col" style={{ height: "calc(100vh - 20rem)" }}>
          {/* Severity summary cards */}
          <div className="grid grid-cols-4 gap-2 mb-3 shrink-0">
            {(["critical", "high", "medium", "low"] as const).map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(severityFilter === sev ? "all" : sev)}
                className={`rounded-md border px-2 py-2 text-center transition-colors ${getSeverityColor(sev)} ${
                  severityFilter === sev ? "ring-1 ring-offset-1 ring-offset-background" : "opacity-80 hover:opacity-100"
                }`}
              >
                <div className="text-lg font-bold font-mono leading-none">{severityCounts[sev]}</div>
                <div className="text-[9px] font-mono uppercase mt-0.5 opacity-80">{sev}</div>
              </button>
            ))}
          </div>

          {/* Filter + sort controls */}
          <div className="flex items-center gap-2 mb-3 shrink-0">
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

          <ScrollArea className="flex-1 pr-1">
            <div className="space-y-3">
              {filteredGaps.map((gap) => (
                <Card key={gap.id} className="bg-card">
                  <CardHeader className="py-2.5 px-4 flex flex-row items-center justify-between border-b border-border/50">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-muted-foreground shrink-0">{getGapIcon(gap.gapType)}</span>
                      <span className="font-mono text-xs font-semibold truncate">{gap.gapType}</span>
                      {/* Source badge */}
                      {gap.source === "ai" ? (
                        <span className="shrink-0 inline-flex items-center gap-0.5 text-[9px] font-mono px-1.5 py-0.5 rounded-sm bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          <Bot className="w-2.5 h-2.5" />AI
                        </span>
                      ) : (
                        <span className="shrink-0 inline-flex items-center gap-0.5 text-[9px] font-mono px-1.5 py-0.5 rounded-sm bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          <Cpu className="w-2.5 h-2.5" />Engine
                        </span>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={`${getSeverityColor(gap.severity)} uppercase text-[10px] px-1.5 py-0 rounded-sm shrink-0 ml-2`}
                    >
                      {gap.severity}
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-3 space-y-2.5">
                    <p className="text-sm leading-relaxed">{gap.description}</p>

                    {/* Recommendation callout */}
                    {gap.recommendation && (
                      <div className="flex items-start gap-2 bg-muted/40 rounded-md px-3 py-2 border border-border/50">
                        <Lightbulb className="w-3.5 h-3.5 text-yellow-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-muted-foreground leading-relaxed">{gap.recommendation}</p>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-0.5">
                      <div className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded-sm">
                        Confidence: {(gap.confidence * 100).toFixed(0)}%
                      </div>
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
                  </CardContent>
                </Card>
              ))}
              {filteredGaps.length === 0 && (
                <div className="p-8 text-center text-muted-foreground border border-dashed border-border rounded-lg bg-card/30 flex flex-col items-center">
                  <CheckCircle2 className="w-8 h-8 text-green-500 mb-2 opacity-50" />
                  <p className="font-mono text-sm">
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
