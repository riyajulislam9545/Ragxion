import { useState } from "react";
import { useParams, Link } from "wouter";
import { useGetTournament, useGetTournamentRegistrations, useRegisterForTournament, useGetMe, getGetTournamentQueryKey, getGetTournamentRegistrationsQueryKey, getGetMeQueryKey, getGetDashboardQueryKey, getGetMyRegistrationsQueryKey, getGetMyTransactionsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Trophy, Users, Swords, Calendar, AlertTriangle, ArrowLeft, CheckCircle2, FileText, ArrowUpRight, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { getTournamentImageUrl } from "@/lib/tournament-media";

const registerSchema = z.object({
  teamName: z.string().min(2, "Team name must be at least 2 characters").max(50),
});

export default function TournamentDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id || "0", 10);
  
  const { data, isLoading, isError } = useGetTournament(id, { query: { enabled: !!id, queryKey: getGetTournamentQueryKey(id) }});
  const { data: user } = useGetMe();
  const registerMutation = useRegisterForTournament();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [registerOpen, setRegisterOpen] = useState(false);

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { teamName: "" },
  });

  const onSubmit = (values: z.infer<typeof registerSchema>) => {
    registerMutation.mutate({
      id,
      data: { teamName: values.teamName }
    }, {
      onSuccess: () => {
        setRegisterOpen(false);
        toast({
          title: "Registration Successful!",
          description: `Your team ${values.teamName} has been registered.`,
        });
        queryClient.invalidateQueries({ queryKey: getGetTournamentQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMyRegistrationsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMyTransactionsQueryKey() });
      },
      onError: (err: any) => {
        toast({
          title: "Registration Failed",
          description: err.message || "Something went wrong.",
          variant: "destructive",
        });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <div className="grid md:grid-cols-3 gap-6">
          <Skeleton className="h-64 md:col-span-2 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="py-16 text-center">
        <RefreshCw className="mx-auto mb-4 h-10 w-10 text-destructive/80" />
        <h1 className="text-2xl font-bold">Tournament details unavailable</h1>
        <p className="mt-2 text-muted-foreground">The match hub could not be loaded right now.</p>
        <Link href="/tournaments" className="mt-6 inline-flex">
          <Button variant="outline">Back to tournaments</Button>
        </Link>
      </div>
    );
  }

  const { tournament, registrations, myRegistration } = data;
  const isRegistrationOpen = tournament.status === 'registration_open';
  const isFull = tournament.registeredCount >= tournament.maxSlots;
  const canRegister = isRegistrationOpen && !isFull && !myRegistration;
  const insufficientBalance = (user?.walletBalance || 0) < tournament.entryFee;
  const hasFinalInformation =
    (tournament.status === "registration_closed" || tournament.status === "ongoing") &&
    Boolean(tournament.finalInformation?.trim());

  const getStatusColor = (status: string) => {
    switch (status) {
      case "upcoming": return "bg-blue-500/10 text-blue-500";
      case "registration_open": return "bg-emerald-500/10 text-emerald-500";
      case "registration_closed": return "bg-orange-500/10 text-orange-500";
      case "ongoing": return "bg-primary/10 text-primary";
      case "completed": return "bg-muted text-muted-foreground";
      default: return "bg-muted text-foreground";
    }
  };

  return (
    <div className="space-y-6">
      <Link href="/tournaments">
        <Button variant="ghost" size="sm" className="mb-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Tournaments
        </Button>
      </Link>

      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-8 md:p-12">
        {getTournamentImageUrl(tournament.imageUrl) ? (
          <img
            src={getTournamentImageUrl(tournament.imageUrl) ?? undefined}
            alt={`${tournament.gameName} tournament artwork`}
            className="absolute inset-0 h-full w-full object-cover opacity-35"
          />
        ) : null}
        <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(13,10,24,0.98)_10%,rgba(13,10,24,0.82)_55%,rgba(13,10,24,0.42))] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between gap-6">
          <div>
            <Badge variant="secondary" className={`${getStatusColor(tournament.status)} mb-4 border-0`}>
              {tournament.status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            </Badge>
            <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-2">{tournament.gameName}</h1>
            <div className="flex flex-wrap gap-4 text-sm mt-4">
              <div className="flex items-center text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
                <Swords className="w-4 h-4 mr-2 text-primary" />
                <span className="font-medium text-foreground mr-1">{tournament.teamSize.toUpperCase()}</span> Format
              </div>
              <div className="flex items-center text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
                <Users className="w-4 h-4 mr-2 text-primary" />
                <span className="font-medium text-foreground mr-1">{tournament.registeredCount}/{tournament.maxSlots}</span> Registered
              </div>
              {tournament.registrationDeadline && (
                <div className="flex items-center text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
                  <Calendar className="w-4 h-4 mr-2 text-primary" />
                  Deadline: <span className="font-medium text-foreground ml-1">{format(new Date(tournament.registrationDeadline), 'MMM d, h:mm a')}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-col md:items-end justify-center">
            {myRegistration ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 px-6 py-4 rounded-xl flex items-center mb-4">
                <CheckCircle2 className="w-5 h-5 mr-3" />
                <div>
                  <p className="font-bold">Registered</p>
                  <p className="text-xs opacity-80">Team: {myRegistration.teamName}</p>
                </div>
              </div>
            ) : (
              <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
                <DialogTrigger asChild>
                  <Button 
                    size="lg" 
                    disabled={!canRegister}
                    className="w-full md:w-auto h-14 px-8 text-lg shadow-[0_0_20px_rgba(168,85,247,0.3)] mb-2"
                  >
                    {isFull ? "Tournament Full" : 
                     !isRegistrationOpen ? "Registration Closed" : 
                     "Register Now"}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Register for {tournament.gameName}</DialogTitle>
                    <DialogDescription>
                      Entry fee is {tournament.entryFee} TK. This will be deducted from your wallet balance.
                    </DialogDescription>
                  </DialogHeader>
                  
                  {insufficientBalance ? (
                    <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg flex items-start mt-4">
                      <AlertTriangle className="w-5 h-5 mr-3 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-bold">Insufficient Balance</p>
                        <p className="text-sm mt-1">Your balance: {user?.walletBalance || 0} TK. Required: {tournament.entryFee} TK.</p>
                        <Link href="/dashboard" className="text-sm underline font-bold mt-2 inline-block" onClick={() => setRegisterOpen(false)}>
                          Recharge Wallet
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
                        <FormField
                          control={form.control}
                          name="teamName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Team Name</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. Team Liquid" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-between items-center p-3 bg-muted rounded-lg text-sm">
                          <span className="text-muted-foreground">Your Balance</span>
                          <span className="font-mono">{user?.walletBalance || 0} TK</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-muted rounded-lg text-sm">
                          <span className="text-muted-foreground">Entry Fee</span>
                          <span className="font-mono text-destructive">-{tournament.entryFee} TK</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-muted rounded-lg font-bold border border-border">
                          <span>Remaining Balance</span>
                          <span className="font-mono">{(user?.walletBalance || 0) - tournament.entryFee} TK</span>
                        </div>
                        <DialogFooter className="mt-6">
                          <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
                            {registerMutation.isPending ? "Registering..." : `Pay ${tournament.entryFee} TK & Register`}
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  )}
                </DialogContent>
              </Dialog>
            )}
            
            <p className="text-sm text-muted-foreground mt-2 text-center md:text-right">
              Entry: <span className="font-bold text-foreground">{tournament.entryFee} TK</span> / {tournament.teamSize === 'solo' ? 'player' : 'team'}
            </p>
          </div>
        </div>
      </div>

      {hasFinalInformation && (
        <Link
          href={`/tournaments/${tournament.id}/final-info`}
          className="group block overflow-hidden rounded-2xl border border-accent/35 bg-accent/[0.07] transition-colors hover:bg-accent/[0.12]"
        >
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-accent/15 p-3 text-accent">
                <FileText className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-accent">Published match brief</p>
                <h2 className="mt-1 font-display text-xl font-bold text-foreground">Final information is ready</h2>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                  Open the admin-published room details, check-in time, and exact instructions for this tournament.
                </p>
              </div>
            </div>
            <span className="inline-flex items-center text-sm font-bold text-accent transition-transform group-hover:translate-x-1">
              Read match brief <ArrowUpRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </span>
          </div>
        </Link>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Rules & Details</CardTitle>
            </CardHeader>
            <CardContent>
              {tournament.rules ? (
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                  {tournament.rules}
                </div>
              ) : (
                <p className="text-muted-foreground italic">No specific rules provided for this tournament.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Registered Roster</CardTitle>
                <CardDescription>{registrations.length} of {tournament.maxSlots} slots filled</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {registrations.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {registrations.map((reg, idx) => (
                    <div key={reg.id} className="flex items-center p-3 bg-muted/40 rounded-lg border border-border">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs mr-3 shrink-0">
                        {idx + 1}
                      </div>
                      <div className="truncate">
                        <p className="font-bold text-sm truncate">{reg.teamName}</p>
                        <p className="text-xs text-muted-foreground truncate">by {reg.username || "Unknown"}</p>
                      </div>
                      {reg.isWinner && (
                        <Badge variant="default" className="ml-auto bg-accent text-accent-foreground shrink-0 shadow-[0_0_10px_rgba(217,70,239,0.5)]">
                          Winner
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-muted-foreground">No teams registered yet. Be the first!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border border-accent/20 relative overflow-hidden bg-card">
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 rounded-full blur-3xl -mr-10 -mt-10" />
            <CardHeader>
              <CardTitle className="flex items-center">
                <Trophy className="w-5 h-5 text-accent mr-2" />
                Prize Pool
              </CardTitle>
              <CardDescription>Estimated total: <span className="font-bold text-accent">{tournament.estimatedPrizePool} TK</span></CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-gradient-to-r from-yellow-500/10 to-transparent border-l-2 border-yellow-500 rounded-r-lg">
                  <span className="font-bold text-yellow-500">1st Place</span>
                  <span className="font-mono font-bold">
                    {tournament.finalPrize1st ?? tournament.basePrize1st ?? `${tournament.prizePercent1st}%`}
                    {tournament.finalPrize1st === undefined && tournament.basePrize1st === undefined ? '' : ' TK'}
                  </span>
                </div>
                {(tournament.basePrize2nd !== undefined || tournament.prizePercent2nd !== undefined || tournament.finalPrize2nd !== undefined) && (
                  <div className="flex justify-between items-center p-3 bg-gradient-to-r from-gray-400/10 to-transparent border-l-2 border-gray-400 rounded-r-lg">
                    <span className="font-bold text-gray-400">2nd Place</span>
                    <span className="font-mono font-bold">
                      {tournament.finalPrize2nd ?? tournament.basePrize2nd ?? `${tournament.prizePercent2nd}%`}
                      {tournament.finalPrize2nd === undefined && tournament.basePrize2nd === undefined ? '' : ' TK'}
                    </span>
                  </div>
                )}
                {(tournament.basePrize3rd !== undefined || tournament.prizePercent3rd !== undefined || tournament.finalPrize3rd !== undefined) && (
                  <div className="flex justify-between items-center p-3 bg-gradient-to-r from-amber-700/10 to-transparent border-l-2 border-amber-700 rounded-r-lg">
                    <span className="font-bold text-amber-700">3rd Place</span>
                    <span className="font-mono font-bold">
                      {tournament.finalPrize3rd ?? tournament.basePrize3rd ?? `${tournament.prizePercent3rd}%`}
                      {tournament.finalPrize3rd === undefined && tournament.basePrize3rd === undefined ? '' : ' TK'}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          {tournament.status === 'completed' && (
            <Card className="border-border">
              <CardHeader>
                <CardTitle>Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { id: tournament.winner1stId, label: "1st Place", color: "text-yellow-500" },
                    { id: tournament.winner2ndId, label: "2nd Place", color: "text-gray-400" },
                    { id: tournament.winner3rdId, label: "3rd Place", color: "text-amber-700" }
                  ].filter(w => w.id).map((winner) => {
                    const reg = registrations.find(r => r.id === winner.id);
                    return reg ? (
                      <div key={winner.label} className="flex justify-between items-center text-sm border-b border-border pb-2 last:border-0 last:pb-0">
                        <span className={`font-bold ${winner.color}`}>{winner.label}</span>
                        <span className="font-medium text-foreground">{reg.teamName}</span>
                      </div>
                    ) : null;
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
