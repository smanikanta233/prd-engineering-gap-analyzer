import { useParams, Link, useLocation } from "wouter";
import { useGetAnalysis, useSubmitGapFeedback, useDeleteAnalysis, getGetAnalysisQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, ThumbsUp, ThumbsDown, Trash2, AlertTriangle, Shield, Zap, Database, CheckCircle2, ChevronRight, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export default function AnalysisDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const analysisId = parseInt(id || "0", 10);

  const { data: analysis, isLoading, isError } = useGetAnalysis(analysisId, {
    query: {
      enabled: !!analysisId && !isNaN(analysisId),
      queryKey: getGetAnalysisQueryKey(analysisId),
    }
  });

  const deleteAnalysis = useDeleteAnalysis({
    mutation: {
      onSuccess: () => {
        setLocation("/");
      }
    }
  });

  const submitFeedback = useSubmitGapFeedback({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(analysisId) });
      }
    }
  });

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
          <Link href="/">Return Home</Link>
        </Button>
      </div>
    );
  }

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'high': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'medium': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'low': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getGapIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('security')) return <Shield className="w-4 h-4" />;
    if (t.includes('scale') || t.includes('performance')) return <Zap className="w-4 h-4" />;
    if (t.includes('data') || t.includes('state')) return <Database className="w-4 h-4" />;
    return <AlertTriangle className="w-4 h-4" />;
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="h-8 w-8">
            <Link href="/">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div className="space-y-0.5">
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              {analysis.title || `Analysis #${analysis.id}`}
            </h1>
            <div className="text-xs text-muted-foreground font-mono">
              {new Date(analysis.createdAt).toLocaleString()} • {analysis.gaps.length} gaps identified
            </div>
          </div>
        </div>
        <Button 
          variant="destructive" 
          size="sm" 
          onClick={() => {
            if (confirm('Delete this analysis?')) {
              deleteAnalysis.mutate({ id: analysis.id });
            }
          }}
          disabled={deleteAnalysis.isPending}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <Card className="bg-card/50 flex flex-col h-[calc(100vh-12rem)]">
          <CardHeader className="py-3 px-4 border-b border-border bg-muted/20">
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
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

        <div className="flex flex-col h-[calc(100vh-12rem)] overflow-hidden">
          <div className="text-sm font-mono font-bold mb-3 flex items-center gap-2 text-foreground">
            <Activity className="w-4 h-4" />
            ENGINEERING_GAPS_DETECTED
          </div>
          <ScrollArea className="flex-1 pr-4 -mr-4">
            <div className="space-y-4">
              {analysis.gaps.map((gap) => (
                <Card key={gap.id} className="bg-card">
                  <CardHeader className="py-3 px-4 flex flex-row items-center justify-between border-b border-border/50">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{getGapIcon(gap.gapType)}</span>
                      <span className="font-mono text-sm font-semibold">{gap.gapType}</span>
                    </div>
                    <Badge variant="outline" className={`${getSeverityColor(gap.severity)} uppercase text-[10px] px-1.5 py-0 rounded-sm`}>
                      {gap.severity}
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4">
                    <p className="text-sm leading-relaxed">
                      {gap.description}
                    </p>
                    
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2">
                        <div className="text-[10px] text-muted-foreground font-mono uppercase bg-muted px-1.5 py-0.5 rounded-sm">
                          Confidence: {(gap.confidence * 100).toFixed(0)}%
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-xs text-muted-foreground hover:text-green-500"
                          onClick={() => submitFeedback.mutate({ id: gap.id, data: { isHelpful: true } })}
                        >
                          <ThumbsUp className="w-3 h-3 mr-1.5" />
                          <span className="font-mono">{gap.helpfulCount || 0}</span>
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-xs text-muted-foreground hover:text-red-500"
                          onClick={() => submitFeedback.mutate({ id: gap.id, data: { isHelpful: false } })}
                        >
                          <ThumbsDown className="w-3 h-3 mr-1.5" />
                          <span className="font-mono">{gap.notHelpfulCount || 0}</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {analysis.gaps.length === 0 && (
                <div className="p-8 text-center text-muted-foreground border border-dashed border-border rounded-lg bg-card/30 flex flex-col items-center">
                  <CheckCircle2 className="w-8 h-8 text-green-500 mb-2 opacity-50" />
                  <p className="font-mono text-sm">No engineering gaps detected.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
