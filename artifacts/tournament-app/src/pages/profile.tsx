import { useState, useEffect } from "react";
import { 
  useGetMe, 
  useGetMyRegistrations, 
  useGetMyTransactions, 
  useGetMyWithdrawals,
  useUpsertMe,
  useRequestWithdrawal,
  getGetMeQueryKey,
  getGetMyWithdrawalsQueryKey,
  getGetMyTransactionsQueryKey,
  getGetDashboardQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wallet, Settings, Clock, ArrowUpRight, ArrowDownRight, Swords, Trophy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { format } from "date-fns";

const profileSchema = z.object({
  username: z.string().min(2).max(50).optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
});

const withdrawSchema = z.object({
  amount: z.coerce.number().min(100, "Minimum withdrawal is 100 TK"),
  method: z.enum(["bKash", "Nagad"]),
  accountNumber: z.string().min(11, "Valid number required"),
});

export default function Profile() {
  const { data: user, isLoading: isUserLoading } = useGetMe();
  const { data: registrations, isLoading: isRegLoading } = useGetMyRegistrations();
  const { data: transactions, isLoading: isTxLoading } = useGetMyTransactions();
  const { data: withdrawals, isLoading: isWdLoading } = useGetMyWithdrawals();
  
  const upsertMe = useUpsertMe();
  const requestWithdrawal = useRequestWithdrawal();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { username: "", phone: "" },
  });

  const withdrawForm = useForm<z.infer<typeof withdrawSchema>>({
    resolver: zodResolver(withdrawSchema),
    defaultValues: { amount: 100, method: "bKash", accountNumber: "" },
  });

  useEffect(() => {
    if (user) {
      profileForm.reset({
        username: user.username || "",
        phone: user.phone || "",
      });
    }
  }, [user, profileForm]);

  const onProfileSubmit = (values: z.infer<typeof profileSchema>) => {
    upsertMe.mutate({
      data: {
        username: values.username || undefined,
        phone: values.phone || undefined,
      }
    }, {
      onSuccess: () => {
        toast({ title: "Profile Updated", description: "Your details have been saved." });
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      },
      onError: (err: any) => {
        toast({ title: "Update Failed", description: err.message, variant: "destructive" });
      }
    });
  };

  const onWithdrawSubmit = (values: z.infer<typeof withdrawSchema>) => {
    if (user && values.amount > user.walletBalance) {
      withdrawForm.setError("amount", { message: "Insufficient balance" });
      return;
    }
    
    requestWithdrawal.mutate({
      data: {
        amount: values.amount,
        method: values.method as any,
        accountNumber: values.accountNumber,
      }
    }, {
      onSuccess: () => {
        setWithdrawOpen(false);
        withdrawForm.reset({ amount: 100, method: values.method, accountNumber: values.accountNumber });
        toast({ title: "Withdrawal Requested", description: "Your request is pending admin approval." });
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMyWithdrawalsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMyTransactionsQueryKey() });
      },
      onError: (err: any) => {
        toast({ title: "Request Failed", description: err.message, variant: "destructive" });
      }
    });
  };

  if (isUserLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-display font-bold">Profile</h1>
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">My Profile</h1>
        <p className="text-muted-foreground">Manage your account and transactions.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 border-border">
          <CardHeader>
            <CardTitle>Wallet & ID</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {user?.arenaId && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Your Arena ID</p>
                <p className="text-3xl font-mono font-bold text-primary tracking-widest">{user.arenaId}</p>
                <p className="text-xs text-muted-foreground mt-1">Use this as reference when depositing</p>
              </div>
            )}
            <div className="bg-card border border-border p-5 rounded-xl text-center shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
              <p className="text-sm text-muted-foreground mb-1">Available Balance</p>
              <h3 className="text-4xl font-mono font-bold text-primary">{user?.walletBalance.toLocaleString()} <span className="text-xl font-sans text-muted-foreground">TK</span></h3>
            </div>
            
            <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
              <DialogTrigger asChild>
                <Button className="w-full shadow-[0_0_15px_rgba(168,85,247,0.3)]">
                  <ArrowUpRight className="w-4 h-4 mr-2" />
                  Withdraw Funds
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Request Withdrawal</DialogTitle>
                  <DialogDescription>
                    Min: 100 TK. Withdrawals are processed within 24 hours.
                  </DialogDescription>
                </DialogHeader>
                
                <Form {...withdrawForm}>
                  <form onSubmit={withdrawForm.handleSubmit(onWithdrawSubmit)} className="space-y-4 mt-4">
                    <FormField
                      control={withdrawForm.control}
                      name="method"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Method</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select method" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="bKash">bKash</SelectItem>
                              <SelectItem value="Nagad">Nagad</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={withdrawForm.control}
                      name="accountNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account Number</FormLabel>
                          <FormControl>
                            <Input placeholder="017XXXXXXXX" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={withdrawForm.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount (TK)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="100" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-between items-center p-3 bg-muted rounded-lg text-sm">
                      <span className="text-muted-foreground">Available Balance</span>
                      <span className="font-mono">{user?.walletBalance || 0} TK</span>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={requestWithdrawal.isPending} className="w-full">
                        {requestWithdrawal.isPending ? "Submitting..." : "Submit Request"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 border-border">
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...profileForm}>
              <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <FormField
                    control={profileForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>In-Game Name / Username</FormLabel>
                        <FormControl>
                          <Input placeholder="PlayerOne" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={profileForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input placeholder="017XXXXXXXX" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="pt-2 flex justify-end">
                  <Button type="submit" disabled={upsertMe.isPending || !profileForm.formState.isDirty}>
                    {upsertMe.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border">
        <Tabs defaultValue="registrations" className="w-full">
          <CardHeader className="pb-0 border-b border-border">
            <TabsList className="bg-transparent border-0 w-full justify-start rounded-none h-auto p-0 space-x-6">
              <TabsTrigger value="registrations" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-3 data-[state=active]:shadow-none">
                My Tournaments
              </TabsTrigger>
              <TabsTrigger value="transactions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-3 data-[state=active]:shadow-none">
                Transactions
              </TabsTrigger>
              <TabsTrigger value="withdrawals" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-3 data-[state=active]:shadow-none">
                Withdrawals
              </TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent className="pt-6">
            <TabsContent value="registrations" className="m-0">
              {isRegLoading ? (
                <div className="space-y-4"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
              ) : registrations && registrations.length > 0 ? (
                <div className="space-y-4">
                  {registrations.map(reg => (
                    <div key={reg.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-border bg-card rounded-lg gap-4">
                      <div>
                        <h4 className="font-bold text-foreground">{reg.tournament.gameName}</h4>
                        <div className="flex items-center text-sm text-muted-foreground mt-1">
                          <Swords className="w-3.5 h-3.5 mr-1" />
                          Team: <span className="font-medium text-foreground ml-1">{reg.teamName}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={
                          reg.tournament.status === 'completed' ? 'border-muted text-muted-foreground' : 'border-primary text-primary'
                        }>
                          {reg.tournament.status.replace('_', ' ')}
                        </Badge>
                        <Button variant="secondary" size="sm" asChild>
                          <a href={`/tournaments/${reg.tournamentId}`}>View</a>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">No tournament registrations found.</div>
              )}
            </TabsContent>

            <TabsContent value="transactions" className="m-0">
              {isTxLoading ? (
                <div className="space-y-4"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
              ) : transactions && transactions.length > 0 ? (
                <div className="space-y-2">
                  {transactions.map(tx => (
                    <div key={tx.id} className="flex items-center justify-between p-3 border border-border bg-card rounded-lg">
                      <div className="flex items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 shrink-0 ${
                          tx.type === 'recharge' ? 'bg-blue-500/10 text-blue-500' :
                          tx.type === 'prize_won' ? 'bg-accent/10 text-accent' :
                          tx.type === 'withdrawal' ? 'bg-destructive/10 text-destructive' :
                          'bg-orange-500/10 text-orange-500'
                        }`}>
                          {tx.type === 'recharge' && <ArrowDownRight className="w-4 h-4" />}
                          {tx.type === 'prize_won' && <Trophy className="w-4 h-4" />}
                          {tx.type === 'withdrawal' && <ArrowUpRight className="w-4 h-4" />}
                          {tx.type === 'fee_paid' && <Swords className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium capitalize">{tx.type.replace('_', ' ')}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(tx.createdAt), 'MMM d, yyyy h:mm a')}</p>
                        </div>
                      </div>
                      <div className={`font-mono font-bold ${
                        ['recharge', 'prize_won'].includes(tx.type) ? 'text-emerald-500' : 'text-foreground'
                      }`}>
                        {['recharge', 'prize_won'].includes(tx.type) ? '+' : '-'}{tx.amount} TK
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">No transactions found.</div>
              )}
            </TabsContent>

            <TabsContent value="withdrawals" className="m-0">
              {isWdLoading ? (
                <div className="space-y-4"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
              ) : withdrawals && withdrawals.length > 0 ? (
                <div className="space-y-3">
                  {withdrawals.map(wd => (
                    <div key={wd.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-border bg-card rounded-lg gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold font-mono text-lg">{wd.amount} TK</h4>
                          <Badge variant="outline" className={
                            wd.status === 'completed' ? 'border-emerald-500 text-emerald-500' :
                            wd.status === 'rejected' ? 'border-destructive text-destructive' :
                            'border-yellow-500 text-yellow-500'
                          }>
                            {wd.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {wd.method} • {wd.accountNumber} • {format(new Date(wd.requestedAt), 'MMM d, h:mm a')}
                        </p>
                        {wd.adminNote && (
                          <p className="text-sm text-destructive mt-2 bg-destructive/10 p-2 rounded border border-destructive/20">
                            Note: {wd.adminNote}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">No withdrawals requested yet.</div>
              )}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}
