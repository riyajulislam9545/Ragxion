import { useEffect, useState } from "react";
import { 
  useGetAdminStats, 
  useAdminListUsers, 
  useListTournaments, 
  useCreateTournament, 
  useUpdateTournament, 
  useAdminListWithdrawals, 
  useProcessWithdrawal,
  useDeclareWinners,
  useGetTournamentRegistrations,
  useAdminListDeposits,
  useAdminApproveDeposit,
  useAdminRejectDeposit,
  getGetAdminStatsQueryKey,
  getAdminListUsersQueryKey,
  getListTournamentsQueryKey,
  getAdminListWithdrawalsQueryKey,
  getGetTournamentRegistrationsQueryKey,
  getAdminListDepositsQueryKey,
  getGetTournamentQueryKey,
  type Tournament,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Trophy, Wallet, Activity, Edit, Plus, CheckCircle, XCircle, Award, FileText, Radio } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { format } from "date-fns";
import { Textarea } from "@/components/ui/textarea";
import TournamentImageUpload from "@/components/tournament-image-upload";
import { getTournamentImageUrl } from "@/lib/tournament-media";

const createTourneySchema = z.object({
  gameName: z.string().min(2).max(100),
  teamSize: z.enum(["solo", "duo", "squad"]),
  maxSlots: z.coerce.number().min(2),
  entryFee: z.coerce.number().min(0),
  basePrize1st: z.coerce.number().min(0),
  basePrize2nd: z.coerce.number().min(0),
  basePrize3rd: z.coerce.number().min(0),
  registrationDeadline: z.string(),
  status: z.enum(["upcoming", "registration_open"]),
});

const declareWinnersSchema = z.object({
  winner1stRegistrationId: z.coerce.number().min(1),
  winner2ndRegistrationId: z.coerce.number().optional().nullable(),
  winner3rdRegistrationId: z.coerce.number().optional().nullable(),
});

function EditTournamentDialog({
  tournament,
  isOpen,
  onClose,
}: {
  tournament: Tournament | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const updateTourney = useUpdateTournament();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [finalInformation, setFinalInformation] = useState("");

  useEffect(() => {
    if (tournament && isOpen) {
      setImageUrl(tournament.imageUrl ?? null);
      setFinalInformation(tournament.finalInformation ?? "");
    }
  }, [tournament, isOpen]);

  if (!tournament) return null;

  const canPublish =
    tournament.status === "registration_closed" || tournament.status === "ongoing";

  const handleSave = () => {
    updateTourney.mutate(
      {
        id: tournament.id,
        data: {
          imageUrl: imageUrl || "",
          finalInformation: finalInformation.trim(),
        },
      },
      {
        onSuccess: () => {
          toast({
            title: canPublish ? "Match brief published" : "Tournament content saved",
            description: canPublish
              ? "Players can now access the final information from the tournament page."
              : "The brief will become visible when registration closes or the event goes ongoing.",
          });
          queryClient.invalidateQueries({ queryKey: getListTournamentsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetTournamentQueryKey(tournament.id) });
          onClose();
        },
        onError: (err: any) =>
          toast({
            title: "Could not save tournament content",
            description: err.message || "Please try again.",
            variant: "destructive",
          }),
      },
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-4 w-4 text-primary" aria-hidden="true" />
            Edit {tournament.gameName}
          </DialogTitle>
          <DialogDescription>
            Update the public artwork and the exact match brief players will use on tournament day.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          <div>
            <p className="mb-2 text-sm font-medium">Tournament artwork</p>
            <TournamentImageUpload value={imageUrl} onChange={setImageUrl} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="final-information" className="text-sm font-medium">
                Final information
              </label>
              <Badge
                variant="outline"
                className={
                  canPublish && finalInformation.trim()
                    ? "border-emerald-500/40 text-emerald-400"
                    : "border-border text-muted-foreground"
                }
              >
                <Radio className="mr-1.5 h-3 w-3" aria-hidden="true" />
                {canPublish && finalInformation.trim() ? "Ready to publish" : "Not published"}
              </Badge>
            </div>
            <Textarea
              id="final-information"
              value={finalInformation}
              onChange={(event) => setFinalInformation(event.target.value)}
              placeholder={"Example:\nCheck-in opens at 8:45 PM.\nRoom ID: shared in the verified team channel.\nBring your registered team name exactly as entered."}
              className="min-h-48 resize-y leading-6"
              aria-describedby="final-information-help"
            />
            <p id="final-information-help" className="text-xs leading-5 text-muted-foreground">
              {canPublish
                ? "This content is visible to players now because registration is closed."
                : "Save it early if you like. Players will only see it after this tournament reaches Registration Closed or Ongoing."}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={handleSave} disabled={updateTourney.isPending}>
            {updateTourney.isPending ? "Saving..." : canPublish ? "Save & publish brief" : "Save tournament content"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeclareWinnersDialog({ 
  tournamentId, 
  isOpen, 
  onClose 
}: { 
  tournamentId: number | null, 
  isOpen: boolean, 
  onClose: () => void 
}) {
  const { data: registrations, isLoading } = useGetTournamentRegistrations(tournamentId || 0, {
    query: {
      enabled: !!tournamentId && isOpen,
      queryKey: getGetTournamentRegistrationsQueryKey(tournamentId || 0)
    }
  });
  
  const declareWinners = useDeclareWinners();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof declareWinnersSchema>>({
    resolver: zodResolver(declareWinnersSchema),
    defaultValues: {
      winner1stRegistrationId: 0,
      winner2ndRegistrationId: null,
      winner3rdRegistrationId: null,
    }
  });

  const onSubmit = (values: z.infer<typeof declareWinnersSchema>) => {
    if (!tournamentId) return;
    declareWinners.mutate({
      id: tournamentId,
      data: {
        winner1stRegistrationId: values.winner1stRegistrationId,
        winner2ndRegistrationId: values.winner2ndRegistrationId || null,
        winner3rdRegistrationId: values.winner3rdRegistrationId || null,
      }
    }, {
      onSuccess: () => {
        toast({ title: "Winners Declared and Prizes Distributed" });
        queryClient.invalidateQueries({ queryKey: getListTournamentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
        onClose();
        form.reset();
      },
      onError: (err: any) => {
        toast({ title: "Failed", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Declare Winners</DialogTitle>
          <DialogDescription>
            Select the winning teams. Prizes will be distributed automatically to their wallets.
          </DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <div className="py-8 flex justify-center"><Skeleton className="h-8 w-8 rounded-full" /></div>
        ) : !registrations || registrations.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">No registrations found.</div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="winner1stRegistrationId" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-yellow-500 font-bold flex items-center"><Trophy className="w-4 h-4 mr-1" /> 1st Place</FormLabel>
                  <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value ? field.value.toString() : ""}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select 1st place" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {registrations.map(r => <SelectItem key={r.id} value={r.id.toString()}>{r.teamName} ({r.username})</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="winner2ndRegistrationId" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-400 font-bold flex items-center"><Trophy className="w-4 h-4 mr-1" /> 2nd Place (Optional)</FormLabel>
                  <Select onValueChange={(v) => field.onChange(v ? Number(v) : null)} value={field.value ? field.value.toString() : ""}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select 2nd place" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {registrations.map(r => <SelectItem key={r.id} value={r.id.toString()}>{r.teamName} ({r.username})</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="winner3rdRegistrationId" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-amber-700 font-bold flex items-center"><Trophy className="w-4 h-4 mr-1" /> 3rd Place (Optional)</FormLabel>
                  <Select onValueChange={(v) => field.onChange(v ? Number(v) : null)} value={field.value ? field.value.toString() : ""}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select 3rd place" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {registrations.map(r => <SelectItem key={r.id} value={r.id.toString()}>{r.teamName} ({r.username})</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="submit" disabled={declareWinners.isPending} className="w-full">
                  {declareWinners.isPending ? "Processing..." : "Distribute Prizes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function Admin() {
  const { data: stats, isLoading: isStatsLoading } = useGetAdminStats();
  const { data: users, isLoading: isUsersLoading } = useAdminListUsers();
  const { data: tournaments, isLoading: isTourneysLoading } = useListTournaments();
  const { data: withdrawals, isLoading: isWdLoading } = useAdminListWithdrawals({ status: 'pending' });
  const { data: deposits, isLoading: isDepositsLoading } = useAdminListDeposits(undefined, {
    query: { queryKey: getAdminListDepositsQueryKey(), refetchInterval: 10_000 },
  });

  const createTourney = useCreateTournament();
  const updateTourney = useUpdateTournament();
  const processWd = useProcessWithdrawal();
  const approveDeposit = useAdminApproveDeposit();
  const rejectDeposit = useAdminRejectDeposit();
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [createImageUrl, setCreateImageUrl] = useState<string | null>(null);
  const [editTournament, setEditTournament] = useState<Tournament | null>(null);
  const [declareWinnersOpen, setDeclareWinnersOpen] = useState(false);
  const [declareWinnersTourneyId, setDeclareWinnersTourneyId] = useState<number | null>(null);

  const handleApproveDeposit = (id: number) => {
    approveDeposit.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Deposit Approved", description: "Balance credited to user's wallet." });
        queryClient.invalidateQueries({ queryKey: getAdminListDepositsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
      },
      onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
    });
  };

  const handleRejectDeposit = (id: number) => {
    rejectDeposit.mutate({ id, data: { adminNote: "Rejected by admin" } }, {
      onSuccess: () => {
        toast({ title: "Deposit Rejected" });
        queryClient.invalidateQueries({ queryKey: getAdminListDepositsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
      },
      onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
    });
  };

  const form = useForm<z.infer<typeof createTourneySchema>>({
    resolver: zodResolver(createTourneySchema),
    defaultValues: {
      gameName: "",
      teamSize: "squad",
      maxSlots: 16,
      entryFee: 100,
      basePrize1st: 1000,
      basePrize2nd: 500,
      basePrize3rd: 200,
      status: "upcoming",
      registrationDeadline: new Date(Date.now() + 86400000).toISOString().slice(0, 16)
    },
  });

  const onCreateSubmit = (values: z.infer<typeof createTourneySchema>) => {
    createTourney.mutate({
      data: {
        ...values,
        registrationDeadline: new Date(values.registrationDeadline).toISOString(),
        imageUrl: createImageUrl || undefined,
      }
    }, {
      onSuccess: () => {
        setCreateOpen(false);
        form.reset();
        setCreateImageUrl(null);
        toast({ title: "Tournament Created" });
        queryClient.invalidateQueries({ queryKey: getListTournamentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
      },
      onError: (err: any) => {
        toast({ title: "Failed", description: err.message, variant: "destructive" });
      }
    });
  };

  const handleProcessWd = (id: number, action: 'completed' | 'rejected', adminNote?: string) => {
    processWd.mutate({
      id,
      data: { action: action === 'completed' ? 'approve' : 'reject', adminNote }
    }, {
      onSuccess: () => {
         toast({ title: `Withdrawal ${action === "completed" ? "Completed" : "Rejected"}` });
        queryClient.invalidateQueries({ queryKey: getAdminListWithdrawalsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
      },
      onError: (err: any) => {
        toast({ title: "Failed", description: err.message, variant: "destructive" });
      }
    });
  };

  const handleUpdateStatus = (id: number, status: any) => {
    updateTourney.mutate({
      id,
      data: { status }
    }, {
      onSuccess: () => {
        toast({ title: "Status Updated" });
        queryClient.invalidateQueries({ queryKey: getListTournamentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetTournamentQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
      }
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Admin Panel</h1>
        <p className="text-muted-foreground">Manage the entire Ragxion platform.</p>
      </div>

      {isStatsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="border-border bg-card">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Users</p>
                <p className="text-2xl font-bold font-mono">{stats.totalUsers}</p>
              </div>
              <Users className="w-8 h-8 text-primary opacity-50" />
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Tourneys</p>
                <p className="text-2xl font-bold font-mono">{stats.activeTournaments}</p>
              </div>
              <Trophy className="w-8 h-8 text-accent opacity-50" />
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Platform Rev</p>
                <p className="text-2xl font-bold font-mono">{stats.totalFeesCollected} <span className="text-xs">TK</span></p>
              </div>
              <Wallet className="w-8 h-8 text-emerald-500 opacity-50" />
            </CardContent>
          </Card>
          <Card className={`border-border bg-card ${stats.pendingDeposits > 0 ? "border-yellow-500/40" : ""}`}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Deposits</p>
                <p className={`text-2xl font-bold font-mono ${stats.pendingDeposits > 0 ? "text-yellow-400" : ""}`}>{stats.pendingDeposits}</p>
                {stats.pendingDeposits > 0 && <p className="text-xs text-muted-foreground">{stats.pendingDepositAmount} TK</p>}
              </div>
              <Activity className="w-8 h-8 text-yellow-500 opacity-50" />
            </CardContent>
          </Card>
          <Card className="border-border bg-card border-l-destructive">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending WDs</p>
                <p className="text-2xl font-bold font-mono text-destructive">{stats.pendingWithdrawals}</p>
              </div>
              <Activity className="w-8 h-8 text-destructive opacity-50" />
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card className="border-border">
        <Tabs defaultValue="deposits" className="w-full">
          <CardHeader className="pb-0 border-b border-border">
            <TabsList className="bg-transparent border-0 w-full justify-start rounded-none h-auto p-0 space-x-6 overflow-x-auto">
              <TabsTrigger value="deposits" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-3 data-[state=active]:shadow-none">
                Deposits
                {stats?.pendingDeposits ? (
                  <Badge className="ml-2 px-1.5 py-0 min-w-5 h-5 rounded-full bg-yellow-500/20 text-yellow-400 border-yellow-500/30">{stats.pendingDeposits}</Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="withdrawals" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-3 data-[state=active]:shadow-none">
                Withdrawals
                {stats?.pendingWithdrawals ? (
                  <Badge variant="destructive" className="ml-2 px-1.5 py-0 min-w-5 h-5 rounded-full">{stats.pendingWithdrawals}</Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="tournaments" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-3 data-[state=active]:shadow-none">
                Tournaments
              </TabsTrigger>
              <TabsTrigger value="users" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-3 data-[state=active]:shadow-none">
                Users
              </TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent className="pt-6 p-0 sm:p-6">

            {/* Deposits Tab */}
            <TabsContent value="deposits" className="m-0">
              <div className="px-4 sm:px-0">
                {isDepositsLoading ? <Skeleton className="h-64" /> : deposits && deposits.length > 0 ? (
                  <div className="space-y-4">
                    {deposits.map(dep => (
                      <div key={dep.id} className={`flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg gap-4 ${
                        dep.status === "pending"
                          ? "border-yellow-500/20 bg-yellow-500/5"
                          : "border-border bg-card"
                      }`}>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold font-mono text-xl text-foreground">{dep.amount} TK</h4>
                            <Badge className={
                              dep.status === "approved"
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                : dep.status === "rejected"
                                  ? "bg-red-500/20 text-red-400 border-red-500/30"
                                  : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                            }>
                              {dep.status === "approved" ? "Approved" : dep.status === "rejected" ? "Rejected" : "Pending"}
                            </Badge>
                            <Badge variant="outline" className="text-xs">{dep.method}</Badge>
                          </div>
                          <p className="text-sm text-foreground">
                            <strong>{dep.username || "User"}</strong>
                            {dep.arenaId && <span className="font-mono text-primary ml-2">({dep.arenaId})</span>}
                          </p>
                          <p className="text-sm font-mono mt-1 text-primary p-2 bg-muted inline-block rounded">
                            TxID: {dep.transactionId}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(dep.createdAt), 'MMM d, yyyy h:mm a')}
                          </p>
                        </div>
                        {dep.status === "pending" ? (
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Button
                              variant="outline"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/50"
                              onClick={() => handleRejectDeposit(dep.id)}
                              disabled={rejectDeposit.isPending || approveDeposit.isPending}
                            >
                              <XCircle className="w-4 h-4 mr-2" /> Reject
                            </Button>
                            <Button
                              className="bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={() => handleApproveDeposit(dep.id)}
                              disabled={approveDeposit.isPending || rejectDeposit.isPending}
                            >
                              <CheckCircle className="w-4 h-4 mr-2" /> Approve & Credit
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 border border-border rounded-lg bg-card">
                    <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3 opacity-50" />
                    <h3 className="text-lg font-medium">No deposit requests</h3>
                    <p className="text-muted-foreground text-sm">New deposit requests will appear here.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="withdrawals" className="m-0">
              <div className="px-4 sm:px-0">
                {isWdLoading ? <Skeleton className="h-64" /> : withdrawals && withdrawals.length > 0 ? (
                  <div className="space-y-4">
                    {withdrawals.map(wd => (
                      <div key={wd.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 border border-border bg-card rounded-lg gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold font-mono text-xl text-foreground">{wd.amount} TK</h4>
                            <Badge variant="outline" className="border-yellow-500 text-yellow-500">Pending</Badge>
                          </div>
                          <p className="text-sm text-foreground">
                            <strong>{wd.username || "User"}</strong> ({wd.userId}) requested to {wd.method}
                          </p>
                          <p className="text-sm font-mono mt-1 text-primary p-2 bg-muted inline-block rounded">
                            Account: {wd.accountNumber}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Requested at: {format(new Date(wd.requestedAt), 'MMM d, yyyy h:mm a')}
                          </p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Button 
                            variant="outline" 
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/50"
                            onClick={() => handleProcessWd(wd.id, 'rejected', 'Rejected by admin')}
                            disabled={processWd.isPending}
                          >
                            <XCircle className="w-4 h-4 mr-2" /> Reject
                          </Button>
                          <Button 
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => handleProcessWd(wd.id, 'completed')}
                            disabled={processWd.isPending}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" /> Mark Completed
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 border border-border rounded-lg bg-card">
                    <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3 opacity-50" />
                    <h3 className="text-lg font-medium">All caught up!</h3>
                    <p className="text-muted-foreground">No pending withdrawal requests.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="tournaments" className="m-0">
              <div className="px-4 sm:px-0 mb-4 flex justify-end">
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                  <DialogTrigger asChild>
                    <Button><Plus className="w-4 h-4 mr-2" /> Create Tournament</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Create New Tournament</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onCreateSubmit)} className="space-y-4">
                        <FormField control={form.control} name="gameName" render={({ field }) => (
                          <FormItem><FormLabel>Game Name</FormLabel><FormControl><Input placeholder="Valorant 5v5" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField control={form.control} name="teamSize" render={({ field }) => (
                            <FormItem><FormLabel>Format</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                <SelectContent>
                                  <SelectItem value="solo">Solo</SelectItem><SelectItem value="duo">Duo</SelectItem><SelectItem value="squad">Squad</SelectItem>
                                </SelectContent>
                              </Select>
                            <FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name="maxSlots" render={({ field }) => (
                            <FormItem><FormLabel>Max Slots</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                        </div>
                        <FormField control={form.control} name="entryFee" render={({ field }) => (
                          <FormItem><FormLabel>Entry Fee (TK per team)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <div className="grid grid-cols-3 gap-4">
                          <FormField control={form.control} name="basePrize1st" render={({ field }) => (
                            <FormItem><FormLabel>1st Prize</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name="basePrize2nd" render={({ field }) => (
                            <FormItem><FormLabel>2nd Prize</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name="basePrize3rd" render={({ field }) => (
                            <FormItem><FormLabel>3rd Prize</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField control={form.control} name="registrationDeadline" render={({ field }) => (
                            <FormItem><FormLabel>Deadline</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name="status" render={({ field }) => (
                            <FormItem><FormLabel>Initial Status</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                <SelectContent>
                                  <SelectItem value="upcoming">Upcoming</SelectItem>
                                  <SelectItem value="registration_open">Registration Open</SelectItem>
                                </SelectContent>
                              </Select>
                            <FormMessage /></FormItem>
                          )} />
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Tournament artwork</p>
                          <TournamentImageUpload value={createImageUrl} onChange={setCreateImageUrl} />
                        </div>
                        <DialogFooter>
                          <Button type="submit" disabled={createTourney.isPending} className="w-full">
                            {createTourney.isPending ? "Creating..." : "Create Tournament"}
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="rounded-md border border-border overflow-hidden overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Game</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reg.</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isTourneysLoading ? (
                      <TableRow><TableCell colSpan={5} className="text-center">Loading...</TableCell></TableRow>
                    ) : tournaments?.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-mono text-muted-foreground">#{t.id}</TableCell>
                        <TableCell className="min-w-48">
                          <div className="flex items-center gap-3">
                            {getTournamentImageUrl(t.imageUrl) ? (
                              <img
                                src={getTournamentImageUrl(t.imageUrl) ?? undefined}
                                alt=""
                                className="h-9 w-14 rounded-md border border-border object-cover"
                              />
                            ) : (
                              <div className="h-9 w-14 rounded-md border border-dashed border-border bg-muted" aria-hidden="true" />
                            )}
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">{t.gameName}</p>
                              {t.finalInformation ? (
                                <span className="mt-0.5 inline-flex items-center text-[11px] text-accent">
                                  <FileText className="mr-1 h-3 w-3" aria-hidden="true" /> Brief saved
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select 
                            defaultValue={t.status} 
                            onValueChange={(val) => handleUpdateStatus(t.id, val)}
                            disabled={t.status === 'completed'}
                          >
                            <SelectTrigger className="h-8 text-xs w-[160px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="upcoming">Upcoming</SelectItem>
                              <SelectItem value="registration_open">Reg Open</SelectItem>
                              <SelectItem value="registration_closed">Reg Closed</SelectItem>
                              <SelectItem value="ongoing">Ongoing</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="font-mono">{t.registeredCount}/{t.maxSlots}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditTournament(t)}
                              aria-label={`Edit ${t.gameName}`}
                            >
                              <Edit className="mr-1 h-4 w-4" /> Edit
                            </Button>
                            <Button variant="ghost" size="sm" asChild>
                              <a href={`/tournaments/${t.id}`} target="_blank" rel="noreferrer">View</a>
                            </Button>
                            {t.status === 'completed' && !t.winner1stId && (
                              <Button variant="outline" size="sm" onClick={() => {
                                setDeclareWinnersTourneyId(t.id);
                                setDeclareWinnersOpen(true);
                              }}>
                                <Award className="w-4 h-4 mr-1" /> Winners
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="users" className="m-0 px-4 sm:px-0">
              <div className="rounded-md border border-border overflow-hidden overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Phone / Email</TableHead>
                      <TableHead className="text-right">Wallet</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isUsersLoading ? (
                      <TableRow><TableCell colSpan={4} className="text-center">Loading...</TableCell></TableRow>
                    ) : users?.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-mono text-muted-foreground">#{u.id}</TableCell>
                        <TableCell className="font-bold text-foreground">
                          {u.username || "—"}
                          {u.isAdmin && <Badge variant="secondary" className="ml-2 text-[10px]">ADMIN</Badge>}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{u.phone || "—"}</div>
                          <div className="text-xs text-muted-foreground">{u.email || "—"}</div>
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-primary">{u.walletBalance} TK</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            
          </CardContent>
        </Tabs>
      </Card>
      
      <DeclareWinnersDialog 
        tournamentId={declareWinnersTourneyId} 
        isOpen={declareWinnersOpen} 
        onClose={() => setDeclareWinnersOpen(false)} 
      />
      <EditTournamentDialog
        tournament={editTournament}
        isOpen={!!editTournament}
        onClose={() => setEditTournament(null)}
      />
    </div>
  );
}
