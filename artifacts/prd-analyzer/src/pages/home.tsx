import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Play, ArrowRight, Activity, Loader2, Cpu, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useCreateAnalysis,
  useListAnalyses,
  useGetAnalysesSummary,
  getListAnalysesQueryKey,
  getGetAnalysesSummaryQueryKey,
} from "@workspace/api-client-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const formSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters."),
  prdText: z.string().min(50, "PRD must be at least 50 characters to analyze."),
});

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#3b82f6",
};

const PIPELINE_STEPS = [
  { label: "Running logic engine", sublabel: "Structural analysis", delay: 0 },
  { label: "Detecting ambiguities", sublabel: "Pattern matching", delay: 900 },
  { label: "Sending to GPT-4o", sublabel: "AI semantic analysis", delay: 2000 },
  { label: "Merging findings", sublabel: "Deduplication & ranking", delay: 0 },
];

function getBorderColor(criticalCount: number, highCount: number) {
  if (criticalCount > 0) return "border-l-destructive";
  if (highCount > 0) return "border-l-orange-500";
  return "border-l-green-500";
}

export default function Home() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [loadingStep, setLoadingStep] = useState(0);

  const { data: analyses, isLoading: isAnalysesLoading } = useListAnalyses({
    query: { queryKey: getListAnalysesQueryKey() },
  });

  const { data: summary, isLoading: isSummaryLoading } = useGetAnalysesSummary({
    query: { queryKey: getGetAnalysesSummaryQueryKey() },
  });

  const createAnalysis = useCreateAnalysis({
    mutation: {
      onSuccess: (data) => {
        setLoadingStep(3);
        queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAnalysesSummaryQueryKey() });
        setLocation(`/analyses/${data.id}`);
      },
    },
  });

  // Advance loading steps while pending
  useEffect(() => {
    if (!createAnalysis.isPending) {
      setLoadingStep(0);
      return;
    }
    setLoadingStep(0);
    const t1 = setTimeout(() => setLoadingStep(1), PIPELINE_STEPS[1].delay);
    const t2 = setTimeout(() => setLoadingStep(2), PIPELINE_STEPS[2].delay);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [createAnalysis.isPending]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", prdText: "" },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    createAnalysis.mutate({ data: { prdText: values.prdText, title: values.title } });
  }

  const SEVERITY_CHART_ORDER = ["critical", "high", "medium", "low"];
  const chartData = [...(summary?.severityBreakdown ?? [])]
    .sort(
      (a, b) =>
        SEVERITY_CHART_ORDER.indexOf(a.severity) -
        SEVERITY_CHART_ORDER.indexOf(b.severity)
    )
    .map((b) => ({
      name: b.severity.charAt(0).toUpperCase() + b.severity.slice(1),
      count: b.count,
      fill: SEVERITY_COLORS[b.severity] ?? "#6b7280",
    }));

  const recentAnalyses = analyses?.slice(0, 5) ?? [];

  return (
    <div className="space-y-8">
      {/* Hero banner */}
      <div className="rounded-lg border border-border bg-card/50 px-6 py-8 flex items-start gap-4">
        <div className="w-10 h-10 rounded-md bg-primary flex items-center justify-center shrink-0 mt-0.5">
          <Cpu className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            AI-Powered PRD Engineering Readiness Analyzer
          </h1>
          <p className="text-muted-foreground text-sm max-w-2xl">
            Paste any Product Requirements Document and get an instant AI audit of engineering gaps —
            missing technical specs, security blind spots, scalability issues, ambiguous requirements,
            and more. Gaps are ranked by severity and confidence.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: form + recent analyses */}
        <div className="lg:col-span-2 space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight">New Analysis</h2>
            <p className="text-sm text-muted-foreground">
              Provide a title and paste your PRD text below.
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-xs text-muted-foreground uppercase tracking-wide">
                      PRD Title <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. User Authentication Module v2.0"
                        className="font-mono text-sm bg-card"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="prdText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-xs text-muted-foreground uppercase tracking-wide">
                      PRD Content <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Paste PRD content here..."
                        className="min-h-[360px] font-mono text-sm resize-y p-4 bg-card focus-visible:ring-1"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full sm:w-auto"
                disabled={createAnalysis.isPending}
              >
                {createAnalysis.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4 fill-current" />
                    Run Analysis
                  </>
                )}
              </Button>

              {/* Multi-step loading indicator */}
              {createAnalysis.isPending && (
                <div className="rounded-lg border border-border bg-card/60 p-4 space-y-2.5">
                  <div className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider mb-3">
                    Analysis Pipeline
                  </div>
                  {PIPELINE_STEPS.map((step, i) => {
                    const isDone = i < loadingStep;
                    const isActive = i === loadingStep;
                    const isPending = i > loadingStep;
                    return (
                      <div
                        key={i}
                        className={`flex items-center gap-3 transition-opacity duration-300 ${
                          isPending ? "opacity-30" : "opacity-100"
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-mono border ${
                            isDone
                              ? "bg-green-500/20 border-green-500/40 text-green-500"
                              : isActive
                              ? "bg-primary/20 border-primary/40 text-primary"
                              : "bg-muted border-border text-muted-foreground"
                          }`}
                        >
                          {isDone ? (
                            <Check className="w-3 h-3" />
                          ) : isActive ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <span>{i + 1}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div
                            className={`text-xs font-medium ${
                              isDone
                                ? "text-green-500"
                                : isActive
                                ? "text-foreground"
                                : "text-muted-foreground"
                            }`}
                          >
                            {step.label}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {step.sublabel}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </form>
          </Form>

          {/* Recent analyses */}
          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h2 className="text-lg font-bold tracking-tight">Recent Analyses</h2>
              {analyses && analyses.length > 0 && (
                <Link
                  href="/history"
                  className="text-xs text-primary hover:underline font-mono flex items-center gap-1"
                >
                  View all in History
                  <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </div>
            {isAnalysesLoading ? (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading history...
              </div>
            ) : recentAnalyses.length > 0 ? (
              <div className="grid grid-cols-1 gap-3">
                {recentAnalyses.map((analysis) => (
                  <div
                    key={analysis.id}
                    className={`rounded-lg border border-border bg-card/50 border-l-4 ${getBorderColor(analysis.criticalCount, analysis.highCount)} hover:border-primary/40 transition-colors`}
                  >
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-sm truncate max-w-[70%]">
                          {analysis.title || `Analysis #${analysis.id}`}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono shrink-0 ml-2">
                          {new Date(analysis.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="text-[11px] font-mono text-destructive bg-destructive/10 border border-destructive/20 rounded px-1.5 py-0.5">
                          🔴 {analysis.criticalCount} critical
                        </span>
                        <span className="text-[11px] font-mono text-orange-500 bg-orange-500/10 border border-orange-500/20 rounded px-1.5 py-0.5">
                          🟠 {analysis.highCount} high
                        </span>
                        <span className="text-[11px] font-mono text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 rounded px-1.5 py-0.5">
                          🟡 {analysis.mediumCount} med
                        </span>
                        <span className="text-[11px] font-mono text-blue-500 bg-blue-500/10 border border-blue-500/20 rounded px-1.5 py-0.5">
                          🔵 {analysis.lowCount} low
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground font-mono">
                          {analysis.gapCount} total gaps
                        </span>
                        <Link
                          href={`/analyses/${analysis.id}`}
                          className="text-xs text-primary hover:underline font-mono flex items-center gap-1"
                        >
                          View Analysis
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground bg-muted/50 p-8 text-center rounded-md border border-border border-dashed">
                No previous analyses. Paste a PRD above to get started.
              </div>
            )}
          </div>
        </div>

        {/* Right: system metrics */}
        <div className="space-y-4">
          <Card className="bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-mono">
                <Activity className="w-4 h-4" />
                SYSTEM_METRICS
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {isSummaryLoading ? (
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </div>
              ) : summary ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="text-[10px] text-muted-foreground font-mono uppercase">Analyses</div>
                      <div className="text-2xl font-bold font-mono">{summary.totalAnalyses}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] text-muted-foreground font-mono uppercase">Total Gaps</div>
                      <div className="text-2xl font-bold font-mono">{summary.totalGaps}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] text-muted-foreground font-mono uppercase">Avg/PRD</div>
                      <div className="text-2xl font-bold font-mono">{summary.avgGapsPerAnalysis}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] text-muted-foreground font-mono uppercase">Feedback</div>
                      <div className="text-2xl font-bold font-mono">{summary.totalFeedback}</div>
                    </div>
                  </div>

                  {chartData.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[10px] font-mono uppercase text-muted-foreground border-b border-border pb-1">
                        Severity Distribution
                      </div>
                      <ResponsiveContainer width="100%" height={120}>
                        <BarChart data={chartData} barSize={24}>
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis hide />
                          <Tooltip
                            contentStyle={{
                              background: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: 4,
                              fontSize: 11,
                            }}
                            cursor={{ fill: "hsl(var(--muted))" }}
                          />
                          <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
