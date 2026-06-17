import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAnalyses,
  useGetAnalysesSummary,
  useDeleteAnalysis,
  getListAnalysesQueryKey,
  getGetAnalysesSummaryQueryKey,
} from "@workspace/api-client-react";
import {
  Clock, Search, Trash2, ArrowRight, Loader2, History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type SeverityFilter = "all" | "critical" | "high" | "clean";
type SortMode = "newest" | "oldest" | "most_gaps" | "fewest_gaps";

export default function HistoryPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");

  const { data: analyses, isLoading } = useListAnalyses({
    query: { queryKey: getListAnalysesQueryKey() },
  });

  const { data: summary } = useGetAnalysesSummary({
    query: { queryKey: getGetAnalysesSummaryQueryKey() },
  });

  const deleteAnalysis = useDeleteAnalysis({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAnalysesSummaryQueryKey() });
      },
    },
  });

  const filtered = useMemo(() => {
    if (!analyses) return [];
    let list = [...analyses];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((a) => a.title.toLowerCase().includes(q));
    }

    if (severityFilter === "critical") {
      list = list.filter((a) => a.criticalCount > 0);
    } else if (severityFilter === "high") {
      list = list.filter((a) => a.highCount > 0);
    } else if (severityFilter === "clean") {
      list = list.filter((a) => a.criticalCount === 0 && a.highCount === 0);
    }

    if (sortMode === "newest") {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortMode === "oldest") {
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (sortMode === "most_gaps") {
      list.sort((a, b) => b.gapCount - a.gapCount);
    } else if (sortMode === "fewest_gaps") {
      list.sort((a, b) => a.gapCount - b.gapCount);
    }

    return list;
  }, [analyses, search, severityFilter, sortMode]);

  function getBorderColor(criticalCount: number, highCount: number) {
    if (criticalCount > 0) return "border-l-destructive";
    if (highCount > 0) return "border-l-orange-500";
    return "border-l-green-500";
  }

  const total = analyses?.length ?? 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Clock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Analysis History</h1>
            <p className="text-sm text-muted-foreground">
              All your previous PRD analyses, sorted by most recent
            </p>
          </div>
        </div>
        {!isLoading && (
          <Badge variant="outline" className="font-mono text-xs px-2.5 py-1 shrink-0 mt-1">
            {total} {total === 1 ? "analysis" : "analyses"} total
          </Badge>
        )}
      </div>

      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title..."
            className="pl-8 font-mono text-sm bg-card"
          />
        </div>
        <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as SeverityFilter)}>
          <SelectTrigger className="w-full sm:w-44 font-mono text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Has Critical</SelectItem>
            <SelectItem value="high">Has High</SelectItem>
            <SelectItem value="clean">Clean (no critical/high)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
          <SelectTrigger className="w-full sm:w-44 font-mono text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
            <SelectItem value="most_gaps">Most Gaps</SelectItem>
            <SelectItem value="fewest_gaps">Fewest Gaps</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      {!isLoading && analyses && analyses.length > 0 && (
        <p className="text-xs text-muted-foreground font-mono -mt-2">
          Showing {filtered.length} of {total} {total === 1 ? "analysis" : "analyses"}
        </p>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-mono">Loading analyses...</span>
        </div>
      ) : filtered.length === 0 && total === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <History className="w-8 h-8 text-muted-foreground opacity-50" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold">No analyses yet</h2>
            <p className="text-sm text-muted-foreground">
              Run your first PRD analysis to see results here
            </p>
          </div>
          <Button asChild>
            <Link href="/">
              Analyze a PRD
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Link>
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
          No analyses match your current filters.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((analysis) => (
            <div
              key={analysis.id}
              className={`rounded-lg border border-border bg-card border-l-4 ${getBorderColor(analysis.criticalCount, analysis.highCount)} transition-colors hover:border-primary/40`}
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <span className="font-semibold text-sm leading-snug flex-1 min-w-0">
                    {analysis.title || `Analysis #${analysis.id}`}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono shrink-0">
                    {new Date(analysis.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="text-[11px] font-mono text-destructive bg-destructive/10 border border-destructive/20 rounded px-1.5 py-0.5">
                    🔴 Critical: {analysis.criticalCount}
                  </span>
                  <span className="text-[11px] font-mono text-orange-500 bg-orange-500/10 border border-orange-500/20 rounded px-1.5 py-0.5">
                    🟠 High: {analysis.highCount}
                  </span>
                  <span className="text-[11px] font-mono text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 rounded px-1.5 py-0.5">
                    🟡 Medium: {analysis.mediumCount}
                  </span>
                  <span className="text-[11px] font-mono text-blue-500 bg-blue-500/10 border border-blue-500/20 rounded px-1.5 py-0.5">
                    🔵 Low: {analysis.lowCount}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground font-mono">
                    {analysis.gapCount} total gaps
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button asChild size="sm" variant="outline" className="h-7 text-xs font-mono">
                      <Link href={`/analyses/${analysis.id}`}>
                        View Analysis
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      disabled={deleteAnalysis.isPending}
                      onClick={() => {
                        if (confirm(`Delete "${analysis.title}"? This cannot be undone.`)) {
                          deleteAnalysis.mutate({ id: analysis.id });
                        }
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
