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
import { ArrowLeft, Loader2, Trash2, ExternalLink, Search, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-destructive",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-blue-500",
};

const SEVERITY_TEXT: Record<string, string> = {
  critical: "text-destructive",
  high: "text-orange-500",
  medium: "text-yellow-500",
  low: "text-blue-500",
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
          <span className="text-sm font-mono">Loading data...</span>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Analyses", value: summary?.totalAnalyses ?? 0 },
              { label: "Total Gaps Detected", value: summary?.totalGaps ?? 0 },
              { label: "Avg Gaps per PRD", value: summary?.avgGapsPerAnalysis ?? 0 },
              { label: "Total Feedback Given", value: summary?.totalFeedback ?? 0 },
            ].map((stat) => (
              <Card key={stat.label} className="bg-card">
                <CardContent className="pt-5 pb-4">
                  <div className="text-[10px] font-mono uppercase text-muted-foreground tracking-wide mb-1">
                    {stat.label}
                  </div>
                  <div className="text-3xl font-bold font-mono">{stat.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Severity distribution */}
            <Card className="bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-mono">SEVERITY_DISTRIBUTION</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(["critical", "high", "medium", "low"] as const).map((sev) => {
                  const entry = summary?.severityBreakdown?.find((b) => b.severity === sev);
                  const count = entry?.count ?? 0;
                  const pct = Math.round((count / maxSeverityCount) * 100);
                  return (
                    <div key={sev} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className={`font-mono uppercase ${SEVERITY_TEXT[sev]}`}>{sev}</span>
                        <span className="font-mono text-muted-foreground">{count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${SEVERITY_COLORS[sev]}`}
                          style={{ width: `${pct}%` }}
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
                <CardTitle className="text-sm font-mono">FEEDBACK_SUMMARY</CardTitle>
              </CardHeader>
              <CardContent>
                {!summary?.feedbackSummary?.length ? (
                  <p className="text-sm text-muted-foreground">No feedback recorded yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="text-left pb-2 font-medium">Gap Type</th>
                          <th className="text-right pb-2 font-medium">Helpful</th>
                          <th className="text-right pb-2 font-medium">Not</th>
                          <th className="text-right pb-2 font-medium">Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.feedbackSummary.map((row) => (
                          <tr key={row.gapType} className="border-b border-border/50">
                            <td className="py-2 truncate max-w-[140px] text-foreground">
                              {row.gapType}
                            </td>
                            <td className="py-2 text-right text-green-500">{row.helpfulCount}</td>
                            <td className="py-2 text-right text-destructive">{row.notHelpfulCount}</td>
                            <td className="py-2 text-right">
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

          {/* Gap type breakdown table */}
          <Card className="bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-mono">GAP_TYPE_BREAKDOWN</CardTitle>
            </CardHeader>
            <CardContent>
              {!summary?.gapTypeBreakdown?.length ? (
                <p className="text-sm text-muted-foreground">No gap data yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left pb-2 font-medium">Gap Category</th>
                        <th className="text-right pb-2 font-medium">Count</th>
                        <th className="text-right pb-2 font-medium">Avg Confidence</th>
                        <th className="text-right pb-2 font-medium">Most Common Severity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.gapTypeBreakdown.map((row) => (
                        <tr key={row.gapType} className="border-b border-border/50">
                          <td className="py-2 text-foreground">{row.gapType}</td>
                          <td className="py-2 text-right">{row.count}</td>
                          <td className="py-2 text-right">{(row.avgConfidence * 100).toFixed(0)}%</td>
                          <td className="py-2 text-right">
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 uppercase ${
                                row.mostCommonSeverity === "critical"
                                  ? "bg-destructive/10 text-destructive border-destructive/20"
                                  : row.mostCommonSeverity === "high"
                                  ? "bg-orange-500/10 text-orange-500 border-orange-500/20"
                                  : row.mostCommonSeverity === "medium"
                                  ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                                  : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                              }`}
                            >
                              {row.mostCommonSeverity}
                            </Badge>
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
              <CardTitle className="text-sm font-mono">ALL_ANALYSES</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" asChild className="h-7 text-xs font-mono">
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
                    className="pl-8 h-7 text-xs font-mono"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!filteredAnalyses.length ? (
                <div className="text-sm text-muted-foreground text-center py-8 border border-dashed border-border rounded-md">
                  {search ? `No analyses matching "${search}".` : "No analyses yet."}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left pb-2 font-medium">Title</th>
                        <th className="text-right pb-2 font-medium">Date</th>
                        <th className="text-right pb-2 font-medium">Gaps</th>
                        <th className="text-right pb-2 font-medium">Critical</th>
                        <th className="text-right pb-2 font-medium">High</th>
                        <th className="text-right pb-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAnalyses.map((analysis) => (
                        <tr key={analysis.id} className="border-b border-border/50">
                          <td className="py-2 max-w-[200px] truncate">
                            <Link
                              href={`/analyses/${analysis.id}`}
                              className="text-primary hover:underline"
                            >
                              {analysis.title}
                            </Link>
                          </td>
                          <td className="py-2 text-right text-muted-foreground">
                            {new Date(analysis.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-2 text-right">{analysis.gapCount}</td>
                          <td className="py-2 text-right text-destructive">{analysis.criticalCount}</td>
                          <td className="py-2 text-right text-orange-500">{analysis.highCount}</td>
                          <td className="py-2 text-right">
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

          {/* Last updated timestamp */}
          <p className="text-xs text-muted-foreground font-mono text-right pb-2">
            Dashboard data as of {loadedAt.toLocaleString()}
          </p>
        </>
      )}
    </div>
  );
}
