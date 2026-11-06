import { Link } from "wouter";
import { useGetDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, Trophy, Swords, TrendingUp, ArrowUpRight, ArrowDownRight, Clock, Target, ArrowRightLeft, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: dashboard, isLoading } = useGetDashboard();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-display font-bold">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!dashboard) return null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            Welcome, {dashboard.user.username || "Player"}
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-muted-foreground text-sm">Your arena overview.</p>
            {dashboard.user.arenaId && (
              <span className="font-mono text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                {dashboard.user.arenaId}
              </span>
            )}
          </div>
        </div>
        <Link href="/deposit">
          <Button className="shadow-[0_0_15px_rgba(168,85,247,0.3)]">
            <Plus className="w-4 h-4 mr-2" />
            Deposit Funds
          </Button>
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-primary" />
              </div>
            </div>
            <p className="text-xs font-medium text-muted-foreground mb-0.5">Balance</p>
            <h3 className="text-2xl font-mono font-bold text-foreground">
              {dashboard.user.walletBalance.toLocaleString()}
              <span className="text-sm text-muted-foreground font-sans ml-1">TK</span>
            </h3>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                <Trophy className="w-4 h-4 text-accent" />
              </div>
            </div>
            <p className="text-xs font-medium text-muted-foreground mb-0.5">Winnings</p>
            <h3 className="text-2xl font-mono font-bold text-foreground">
              {dashboard.totalWon.toLocaleString()}
              <span className="text-sm text-muted-foreground font-sans ml-1">TK</span>
            </h3>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Swords className="w-4 h-4 text-emerald-500" />
              </div>
            </div>
            <p className="text-xs font-medium text-muted-foreground mb-0.5">Active Tourneys</p>
            <h3 className="text-2xl font-bold text-foreground">{dashboard.activeRegistrations}</h3>
          </CardContent>
        </Card>

        <Card className={`bg-card border-border ${dashboard.pendingDeposits > 0 ? "border-yellow-500/40" : ""}`}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-yellow-500" />
              </div>
              {dashboard.pendingDeposits > 0 && (
                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px] px-1.5">
                  {dashboard.pendingDeposits} pending
                </Badge>
              )}
            </div>
            <p className="text-xs font-medium text-muted-foreground mb-0.5">Deposits</p>
            <Link href="/deposit">
              <button className="text-sm font-medium text-primary hover:underline">
                {dashboard.pendingDeposits > 0 ? "View pending" : "Add funds →"}
              </button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent transactions */}
        <Card className="border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Transactions</CardTitle>
                <CardDescription>Your latest financial activity</CardDescription>
              </div>
              <Link href="/profile">
                <Button variant="ghost" size="sm" className="text-primary">View All</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {dashboard.recentTransactions.length > 0 ? (
              <div className="space-y-3">
                {dashboard.recentTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        tx.type === "recharge" ? "bg-blue-500/10 text-blue-400" :
                        tx.type === "prize_won" ? "bg-accent/10 text-accent" :
                        tx.type === "withdrawal" ? "bg-destructive/10 text-destructive" :
                        "bg-orange-500/10 text-orange-400"
                      }`}>
                        {tx.type === "recharge" && <ArrowDownRight className="w-4 h-4" />}
                        {tx.type === "prize_won" && <Trophy className="w-4 h-4" />}
                        {tx.type === "withdrawal" && <ArrowUpRight className="w-4 h-4" />}
                        {tx.type === "fee_paid" && <Swords className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium capitalize">{tx.type.replace("_", " ")}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(tx.createdAt), "dd MMM, hh:mm a")}
                        </p>
                      </div>
                    </div>
                    <div className={`text-sm font-mono font-bold ${
                      ["recharge", "prize_won"].includes(tx.type) ? "text-emerald-400" : "text-foreground"
                    }`}>
                      {["recharge", "prize_won"].includes(tx.type) ? "+" : "-"}{tx.amount.toLocaleString()} TK
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <ArrowRightLeft className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                <p className="text-sm text-muted-foreground">No transactions yet</p>
                <Link href="/deposit">
                  <Button variant="ghost" size="sm" className="mt-2 text-primary">Deposit funds to get started</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* CTA card */}
        <Card className="border-border bg-card overflow-hidden relative">
          <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
            <Target className="w-64 h-64" />
          </div>
          <CardHeader className="relative z-10">
            <CardTitle>Ready to Compete?</CardTitle>
            <CardDescription>Browse and join active esports tournaments.</CardDescription>
          </CardHeader>
          <CardContent className="relative z-10">
            <p className="text-muted-foreground mb-6 text-sm">
              New tournaments for PUBG Mobile, Free Fire, and Call of Duty are added regularly. Keep your wallet funded and enter!
            </p>
            <Link href="/tournaments">
              <Button className="w-full sm:w-auto shadow-[0_0_15px_rgba(168,85,247,0.3)]">
                <Swords className="w-4 h-4 mr-2" />
                Browse Tournaments
              </Button>
            </Link>

            <div className="mt-8 pt-6 border-t border-border">
              <h4 className="text-sm font-medium mb-4 flex items-center text-foreground">
                <TrendingUp className="w-4 h-4 mr-2 text-primary" />
                Your Stats
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Total Spent</p>
                  <p className="text-lg font-mono font-bold text-foreground">{dashboard.totalSpent.toLocaleString()} <span className="text-xs">TK</span></p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Win / Spend Ratio</p>
                  <p className="text-lg font-mono font-bold text-accent">
                    {dashboard.totalSpent > 0 ? (dashboard.totalWon / dashboard.totalSpent).toFixed(2) : "0.00"}x
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
