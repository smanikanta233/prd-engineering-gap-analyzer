import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetAnalysesSummary,
  useListAnalyses,
  useDeleteAnalysis,
  getGetAnalysesSummaryQueryKey,
  getListAnalysesQueryKey,
} from "@workspace/api-client-react";
import { ArrowLeft, Loader2, Trash2, ExternalLink, Search, History, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SEVERITY_BAR_COLORS: Record<string, string> = {
  critical: "#E24B4A",
  high:     "#EF9F27",
  medium:   "#3B82F6",
  low:      "#3B6D11",
};

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, { bg: string; text: string; border: string }> = {
    critical: { bg: "#FCEBEB", text: "#791F1F", border: "#F09595" },
    high:     { bg: "#FAEEDA", text: "#633806", border: "#EF9F27" },
    medium:   { bg: "#E6F1FB", text: "#0C447C", border: "#85B7EB" },
    low:      { bg: "#EAF3DE", text: "#27500A", border: "#97C459" },
  };
  const s = styles[severity?.toLowerCase()] ?? { bg: "#F3F4F6", text: "#374151", border: "#D1D5DB" };
  const label = severity
    ? severity.charAt(0).toUpperCase() + severity.slice(1)
    : "—";
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
    }}>
      ● {label}
    </span>
  );
}

const TH_STYLE: React.CSSProperties = {
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  fontWeight: 500,
  paddingBottom: 10,
  paddingTop: 4,
  paddingLeft: 12,
  paddingRight: 12,
};

const TD_STYLE: React.CSSProperties = {
  fontSize: 14,
  paddingTop: 10,
  paddingBottom: 10,
  paddingLeft: 12,
  paddingRight: 12,
};

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [loadedAt] = useState(() => new Date());

  const { data: summary, isLoading: isSummaryLoading } = useGetAnalysesSummary({
    query: { queryKey: getGetAnalysesSummaryQueryKey() },
  });

  const { data: analyses, isLoading: isAnalysesLoading } = useListAnalyses({
    query: { queryKey: getListAnalysesQueryKey() },
  });

  const deleteAnalysis = useDeleteAnalysis({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAnalysesSummaryQueryKey() });
      },
    },
  });

  const filteredAnalyses = useMemo(() => {
    if (!analyses) return [];
    if (!search.trim()) return analyses;
    const q = search.toLowerCase();
    return analyses.filter((a) => a.title.toLowerCase().includes(q));
  }, [analyses, search]);

  const maxSeverityCount = useMemo(() => {
    if (!summary?.severityBreakdown?.length) return 1;
    return Math.max(...summary.severityBreakdown.map((b) => b.count), 1);
  }, [summary]);

  const isLoading = isSummaryLoading || isAnalysesLoading;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Page header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" asChild className="h-8 w-8 mt-0.5 shrink-0">
          <Link href="/"><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">System overview and management</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading data...</span>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Analyses",     value: summary?.totalAnalyses ?? 0 },
              { label: "Total Gaps Detected", value: summary?.totalGaps ?? 0 },
              { label: "Avg Gaps per PRD",   value: summary?.avgGapsPerAnalysis ?? 0 },
              { label: "Total Feedback",     value: summary?.totalFeedback ?? 0 },
            ].map((stat) => (
              <Card key={stat.label} className="bg-card">
                <CardContent className="pt-5 pb-4">
                  <div style={{ fontSize: 13 }} className="text-muted-foreground mb-1">
                    {stat.label}
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 500 }} className="font-mono">
                    {stat.value}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Severity distribution */}
            <Card className="bg-card">
              <CardHeader className="pb-3">
                <CardTitle style={{ fontSize: 16, fontWeight: 500 }}>Severity distribution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(["critical", "high", "medium", "low"] as const).map((sev) => {
                  const entry = summary?.severityBreakdown?.find((b) => b.severity === sev);
                  const count = entry?.count ?? 0;
                  const pct = Math.round((count / maxSeverityCount) * 100);
                  return (
                    <div key={sev} className="space-y-1.5">
                      <div className="flex justify-between" style={{ fontSize: 13 }}>
                        <span style={{ color: SEVERITY_BAR_COLORS[sev], fontWeight: 500 }}>
                          {sev.charAt(0).toUpperCase() + sev.slice(1)}
                        </span>
                        <span className="text-muted-foreground font-mono">{count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: SEVERITY_BAR_COLORS[sev] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Feedback summary */}
            <Card className="bg-card">
              <CardHeader className="pb-3">
                <CardTitle style={{ fontSize: 16, fontWeight: 500 }}>Feedback summary</CardTitle>
              </CardHeader>
              <CardContent>
                {!summary?.feedbackSummary?.length ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-3 text-muted-foreground">
                    <MessageSquare className="w-8 h-8 opacity-30" />
                    <p style={{ fontSize: 14 }}>No feedback recorded yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="text-left" style={TH_STYLE}>Gap Type</th>
                          <th className="text-right" style={TH_STYLE}>Helpful</th>
                          <th className="text-right" style={TH_STYLE}>Not helpful</th>
                          <th className="text-right" style={TH_STYLE}>Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.feedbackSummary.map((row) => (
                          <tr key={row.gapType} className="border-b border-border/50">
                            <td style={{ ...TD_STYLE, maxWidth: 160 }} className="truncate">
                              {row.gapType}
                            </td>
                            <td style={{ ...TD_STYLE, textAlign: "right", color: "#3B6D11" }}>
                              {row.helpfulCount}
                            </td>
                            <td style={{ ...TD_STYLE, textAlign: "right", color: "#E24B4A" }}>
                              {row.notHelpfulCount}
                            </td>
                            <td style={{ ...TD_STYLE, textAlign: "right" }} className="text-muted-foreground">
                              {(row.helpfulnessRate * 100).toFixed(0)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Gap type breakdown */}
          <Card className="bg-card">
            <CardHeader className="pb-3">
              <CardTitle style={{ fontSize: 16, fontWeight: 500 }}>Gap type breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {!summary?.gapTypeBreakdown?.length ? (
                <p style={{ fontSize: 14 }} className="text-muted-foreground">No gap data yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left" style={TH_STYLE}>Gap Category</th>
                        <th className="text-right" style={TH_STYLE}>Count</th>
                        <th className="text-right" style={TH_STYLE}>Avg Confidence</th>
                        <th className="text-right" style={TH_STYLE}>Most Common Severity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.gapTypeBreakdown.map((row) => (
                        <tr key={row.gapType} className="border-b border-border/50">
                          <td style={TD_STYLE}>{row.gapType}</td>
                          <td style={{ ...TD_STYLE, textAlign: "right" }} className="font-mono">
                            {row.count}
                          </td>
                          <td style={{ ...TD_STYLE, textAlign: "right" }} className="text-muted-foreground font-mono">
                            {(row.avgConfidence * 100).toFixed(0)}%
                          </td>
                          <td style={{ ...TD_STYLE, textAlign: "right" }}>
                            <SeverityBadge severity={row.mostCommonSeverity} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* All analyses table */}
          <Card className="bg-card">
            <CardHeader className="pb-3 flex flex-row items-center justify-between flex-wrap gap-2">
              <CardTitle style={{ fontSize: 16, fontWeight: 500 }}>All analyses</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" asChild className="h-7 text-xs">
                  <Link href="/history">
                    <History className="w-3.5 h-3.5 mr-1.5" />
                    View History
                  </Link>
                </Button>
                <div className="relative w-48">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter by title..."
                    className="pl-8 h-7 text-xs"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!filteredAnalyses.length ? (
                <div style={{ fontSize: 14 }} className="text-muted-foreground text-center py-8 border border-dashed border-border rounded-md">
                  {search ? `No analyses matching "${search}".` : "No analyses yet."}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left" style={TH_STYLE}>Title</th>
                        <th className="text-right" style={TH_STYLE}>Date</th>
                        <th className="text-right" style={TH_STYLE}>Gaps</th>
                        <th className="text-right" style={TH_STYLE}>Critical</th>
                        <th className="text-right" style={TH_STYLE}>High</th>
                        <th className="text-right" style={TH_STYLE}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAnalyses.map((analysis) => (
                        <tr key={analysis.id} className="border-b border-border/50">
                          <td style={{ ...TD_STYLE, maxWidth: 200 }} className="truncate">
                            <Link
                              href={`/analyses/${analysis.id}`}
                              className="text-primary hover:underline"
                            >
                              {analysis.title}
                            </Link>
                          </td>
                          <td style={{ ...TD_STYLE, textAlign: "right" }} className="text-muted-foreground">
                            {new Date(analysis.createdAt).toLocaleDateString()}
                          </td>
                          <td style={{ ...TD_STYLE, textAlign: "right" }} className="font-mono">
                            {analysis.gapCount}
                          </td>
                          <td style={{ ...TD_STYLE, textAlign: "right", color: "#E24B4A" }} className="font-mono">
                            {analysis.criticalCount}
                          </td>
                          <td style={{ ...TD_STYLE, textAlign: "right", color: "#EF9F27" }} className="font-mono">
                            {analysis.highCount}
                          </td>
                          <td style={{ ...TD_STYLE, textAlign: "right" }}>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => setLocation(`/analyses/${analysis.id}`)}
                              >
                                <ExternalLink className="w-3 h-3 mr-1" />
                                View
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                                disabled={deleteAnalysis.isPending}
                                onClick={() => {
                                  if (confirm(`Delete "${analysis.title}"?`)) {
                                    deleteAnalysis.mutate({ id: analysis.id });
                                  }
                                }}
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Last updated */}
          <p className="text-xs text-muted-foreground text-right pb-2">
            Dashboard data as of {loadedAt.toLocaleString()}
          </p>
        </>
      )}
    </div>
  );
}
