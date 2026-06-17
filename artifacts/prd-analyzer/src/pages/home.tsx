import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Play, ArrowRight, Activity, AlertTriangle, Info, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useCreateAnalysis, useListAnalyses, useGetAnalysesSummary, getListAnalysesQueryKey, getGetAnalysesSummaryQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";

const formSchema = z.object({
  prdText: z.string().min(50, "PRD must be at least 50 characters to analyze."),
});

export default function Home() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: analyses, isLoading: isAnalysesLoading } = useListAnalyses({
    query: {
      queryKey: getListAnalysesQueryKey(),
    }
  });

  const { data: summary, isLoading: isSummaryLoading } = useGetAnalysesSummary({
    query: {
      queryKey: getGetAnalysesSummaryQueryKey(),
    }
  });

  const createAnalysis = useCreateAnalysis({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAnalysesSummaryQueryKey() });
        setLocation(`/analyses/${data.id}`);
      }
    }
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prdText: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    createAnalysis.mutate({ data: { prdText: values.prdText } });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">New Analysis</h1>
          <p className="text-muted-foreground">
            Paste your Product Requirements Document (PRD) below to identify engineering gaps, edge cases, and missing technical specifications.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="prdText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">PRD Text</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Paste PRD content here..." 
                      className="min-h-[400px] font-mono text-sm resize-y p-4 bg-card focus-visible:ring-1"
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

        <div className="space-y-4 pt-8">
          <h2 className="text-xl font-bold tracking-tight border-b border-border pb-2">Recent Analyses</h2>
          {isAnalysesLoading ? (
            <div className="text-sm text-muted-foreground flex items-center">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading history...
            </div>
          ) : analyses && analyses.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {analyses.map(analysis => (
                <Link key={analysis.id} href={`/analyses/${analysis.id}`}>
                  <Card className="hover:border-primary/50 transition-colors cursor-pointer bg-card/50">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-base truncate max-w-[80%] font-medium">
                          {analysis.title || `Analysis #${analysis.id}`}
                        </CardTitle>
                        <span className="text-xs text-muted-foreground font-mono">
                          {new Date(analysis.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="pb-4">
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1.5 text-destructive font-mono">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>{analysis.criticalCount} CRIT</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-orange-500 font-mono">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>{analysis.highCount} HIGH</span>
                        </div>
                        <div className="text-muted-foreground font-mono">
                          {analysis.gapCount} Total Gaps
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground bg-muted/50 p-8 text-center rounded-md border border-border border-dashed">
              No previous analyses found.
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="w-4 h-4" />
              System Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {isSummaryLoading ? (
              <div className="text-sm text-muted-foreground">Loading metrics...</div>
            ) : summary ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground font-mono">TOTAL_ANALYSES</div>
                    <div className="text-2xl font-bold font-mono">{summary.totalAnalyses}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground font-mono">TOTAL_GAPS</div>
                    <div className="text-2xl font-bold font-mono">{summary.totalGaps}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium font-mono border-b border-border pb-1">SEVERITY_DISTRIBUTION</div>
                  <div className="space-y-1.5 pt-2">
                    {summary.severityBreakdown?.map(b => (
                      <div key={b.severity} className="flex justify-between items-center text-sm">
                        <span className="capitalize">{b.severity}</span>
                        <span className="font-mono">{b.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
