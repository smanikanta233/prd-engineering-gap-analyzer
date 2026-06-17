import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Play, ArrowRight, Activity, AlertTriangle, Loader2, Cpu } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
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

export default function Home() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: analyses, isLoading: isAnalysesLoading } = useListAnalyses({
    query: { queryKey: getListAnalysesQueryKey() },
  });

  const { data: summary, isLoading: isSummaryLoading } = useGetAnalysesSummary({
    query: { queryKey: getGetAnalysesSummaryQueryKey() },
  });

  const createAnalysis = useCreateAnalysis({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAnalysesSummaryQueryKey() });
        setLocation(`/analyses/${data.id}`);
      },
    },
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", prdText: "" },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    createAnalysis.mutate({ data: { prdText: values.prdText, title: values.title } });
  }

  const chartData = summary?.severityBreakdown?.map((b) => ({
    name: b.severity.charAt(0).toUpperCase() + b.severity.slice(1),
    count: b.count,
    fill: SEVERITY_COLORS[b.severity] ?? "#6b7280",
  })) ?? [];

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
                    Analyzing (this takes a few seconds)...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4 fill-current" />
                    Run Analysis
                  </>
                )}
              </Button>
            </form>
          </Form>

          {/* Recent analyses */}
          <div className="space-y-4 pt-4">
            <h2 className="text-lg font-bold tracking-tight border-b border-border pb-2">
              Recent Analyses
            </h2>
            {isAnalysesLoading ? (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading history...
              </div>
            ) : analyses && analyses.length > 0 ? (
              <div className="grid grid-cols-1 gap-3">
                {analyses.map((analysis) => (
                  <Link key={analysis.id} href={`/analyses/${analysis.id}`}>
                    <Card className="hover:border-primary/50 transition-colors cursor-pointer bg-card/50">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium text-sm truncate max-w-[70%]">
                            {analysis.title || `Analysis #${analysis.id}`}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono shrink-0 ml-2">
                            {new Date(analysis.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {analysis.criticalCount > 0 && (
                            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] px-1.5 font-mono uppercase">
                              {analysis.criticalCount} critical
                            </Badge>
                          )}
                          {analysis.highCount > 0 && (
                            <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20 text-[10px] px-1.5 font-mono uppercase">
                              {analysis.highCount} high
                            </Badge>
                          )}
                          {analysis.mediumCount > 0 && (
                            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 text-[10px] px-1.5 font-mono uppercase">
                              {analysis.mediumCount} med
                            </Badge>
                          )}
                          {analysis.lowCount > 0 && (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-[10px] px-1.5 font-mono uppercase">
                              {analysis.lowCount} low
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground font-mono ml-auto flex items-center gap-1">
                            {analysis.gapCount} gaps
                            <ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
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
