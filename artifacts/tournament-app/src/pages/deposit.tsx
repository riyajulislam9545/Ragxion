import { useState } from "react";
import { Link } from "wouter";
import { useGetMe, useSubmitDepositRequest, useGetMyDeposits, getGetMyDepositsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft, Copy, CheckCircle, Clock, XCircle, Wallet, Smartphone } from "lucide-react";
import { format } from "date-fns";

const BKASH_NUMBER = "+8801751030017";
const NAGAD_NUMBER = "+8801620308148";

const depositSchema = z.object({
  amount: z.coerce.number().min(10, "Minimum deposit is 10 TK").max(50000, "Maximum deposit is 50000 TK"),
  transactionId: z.string().min(1, "Transaction ID is required").max(100),
});

type Method = "bKash" | "Nagad";

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Approved</Badge>;
  if (status === "rejected") return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Rejected</Badge>;
  return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pending</Badge>;
}

export default function Deposit() {
  const { data: user, isLoading: isUserLoading } = useGetMe();
  const { data: deposits, isLoading: isDepositsLoading } = useGetMyDeposits();
  const submitDeposit = useSubmitDepositRequest();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [method, setMethod] = useState<Method | null>(null);
  const [copied, setCopied] = useState(false);

  const form = useForm<z.infer<typeof depositSchema>>({
    resolver: zodResolver(depositSchema),
    defaultValues: { amount: 100, transactionId: "" },
  });

  const selectedNumber = method === "bKash" ? BKASH_NUMBER : NAGAD_NUMBER;

  function copyNumber() {
    navigator.clipboard.writeText(selectedNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function onSubmit(values: z.infer<typeof depositSchema>) {
    if (!method) return;
    submitDeposit.mutate({
      data: { amount: values.amount, method, transactionId: values.transactionId }
    }, {
      onSuccess: () => {
        toast({
          title: "Deposit Request Submitted",
          description: "Your request is pending admin approval. Balance will be credited once approved.",
        });
        form.reset({ amount: 100, transactionId: "" });
        setMethod(null);
        queryClient.invalidateQueries({ queryKey: getGetMyDepositsQueryKey() });
      },
      onError: (err: any) => {
        toast({
          title: "Submission Failed",
          description: err.message || "Could not submit deposit request.",
          variant: "destructive",
        });
      }
    });
  }

  if (isUserLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Deposit Funds</h1>
          <p className="text-muted-foreground">Send money via bKash or Nagad and submit your transaction ID.</p>
        </div>
      </div>

      {/* User ID reminder */}
      {user?.arenaId && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Your Arena ID (use as reference when sending money)</p>
                <p className="text-2xl font-mono font-bold text-primary tracking-widest">{user.arenaId}</p>
              </div>
              <Wallet className="w-10 h-10 text-primary/40" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 1 — Method selection */}
      {!method ? (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-primary" />
              Choose Payment Method
            </CardTitle>
            <CardDescription>Select the mobile banking service you want to send money from.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setMethod("bKash")}
              className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-border p-6 hover:border-pink-500/60 hover:bg-pink-500/5 transition-all group"
            >
              <div className="w-14 h-14 rounded-full bg-pink-500/20 flex items-center justify-center text-2xl font-bold text-pink-400 group-hover:scale-110 transition-transform">৳b</div>
              <span className="font-bold text-foreground">bKash</span>
              <span className="text-xs text-muted-foreground font-mono">{BKASH_NUMBER}</span>
            </button>
            <button
              onClick={() => setMethod("Nagad")}
              className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-border p-6 hover:border-orange-500/60 hover:bg-orange-500/5 transition-all group"
            >
              <div className="w-14 h-14 rounded-full bg-orange-500/20 flex items-center justify-center text-2xl font-bold text-orange-400 group-hover:scale-110 transition-transform">৳N</div>
              <span className="font-bold text-foreground">Nagad</span>
              <span className="text-xs text-muted-foreground font-mono">{NAGAD_NUMBER}</span>
            </button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Send via {method}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setMethod(null)} className="text-muted-foreground">
                Change method
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Instructions */}
            <div className="rounded-xl bg-muted/30 border border-border p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">How to deposit:</p>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>Open your <span className="text-foreground font-medium">{method}</span> app.</li>
                <li>
                  Send money to: {" "}
                  <button
                    onClick={copyNumber}
                    className="inline-flex items-center gap-1 font-mono font-bold text-primary hover:text-primary/80 transition-colors"
                  >
                    {selectedNumber}
                    {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </li>
                <li>
                  In the <span className="text-foreground font-medium">reference/note</span> field, write your Arena ID:{" "}
                  <span className="font-mono font-bold text-primary">{user?.arenaId ?? "—"}</span>
                </li>
                <li>Copy the <span className="text-foreground font-medium">Transaction ID</span> from the confirmation SMS.</li>
                <li>Enter the amount and Transaction ID below, then submit.</li>
              </ol>
            </div>

            {/* Form */}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (TK)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="e.g. 500"
                          {...field}
                          className="font-mono"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="transactionId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transaction ID</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. 8N7A6B5C4D"
                          {...field}
                          className="font-mono uppercase"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full shadow-[0_0_20px_rgba(168,85,247,0.3)]"
                  disabled={submitDeposit.isPending}
                >
                  {submitDeposit.isPending ? "Submitting..." : "Submit Deposit Request"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Deposit history */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg">Deposit History</CardTitle>
        </CardHeader>
        <CardContent>
          {isDepositsLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}
            </div>
          ) : !deposits || deposits.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-6">No deposit requests yet.</p>
          ) : (
            <div className="space-y-2">
              {deposits.map((d) => (
                <div key={d.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/50">
                  <div className="flex items-center gap-3">
                    {d.status === "approved" ? (
                      <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                    ) : d.status === "rejected" ? (
                      <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                    ) : (
                      <Clock className="w-4 h-4 text-yellow-400 shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{d.method} · <span className="font-mono text-primary">+{d.amount.toLocaleString()} TK</span></p>
                      <p className="text-xs text-muted-foreground font-mono">TxID: {d.transactionId}</p>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <StatusBadge status={d.status} />
                    <p className="text-xs text-muted-foreground">{format(new Date(d.createdAt), "dd MMM, hh:mm a")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
