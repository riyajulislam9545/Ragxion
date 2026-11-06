import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Trophy, Users, Swords, Shield, ChevronRight, Zap } from "lucide-react";
import { useListTournaments } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const { data: tournaments, isLoading } = useListTournaments({ status: 'upcoming' });

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <header className="h-16 border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center">
            <Trophy className="w-6 h-6 text-primary mr-2" />
            <span className="font-display font-bold text-xl tracking-wider text-foreground">RAGXION</span>
          </div>
          <div className="flex space-x-4">
            <Link href="/sign-in">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/sign-up">
              <Button className="shadow-[0_0_15px_rgba(168,85,247,0.4)] hover:shadow-[0_0_25px_rgba(168,85,247,0.6)] transition-shadow">
                Join Arena
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative pt-32 pb-20 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.15),transparent_50%)] pointer-events-none" />
          
          <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
            <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary mb-6">
              <Zap className="w-4 h-4 mr-2" />
              Bangladesh's Premier Esports Hub
            </div>
            <h1 className="text-5xl md:text-7xl font-display font-bold mb-6 tracking-tight">
              COMPETE. <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">DOMINATE.</span> WIN.
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Register for high-stakes tournaments, battle against the best teams, and withdraw your winnings instantly to bKash or Nagad.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/sign-up">
                <Button size="lg" className="w-full sm:w-auto text-lg h-14 px-8 shadow-[0_0_20px_rgba(168,85,247,0.4)]">
                  Start Playing Now
                </Button>
              </Link>
              <Link href="/tournaments">
                <Button variant="outline" size="lg" className="w-full sm:w-auto text-lg h-14 px-8">
                  Browse Tournaments
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 border-t border-border/50 bg-card/30">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-background p-8 rounded-2xl border border-border">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6">
                  <Swords className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Daily Tournaments</h3>
                <p className="text-muted-foreground">New tournaments added daily across popular titles. Solo, duo, or squad up.</p>
              </div>
              <div className="bg-background p-8 rounded-2xl border border-border relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <Trophy className="w-32 h-32" />
                </div>
                <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center mb-6 relative z-10">
                  <Trophy className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-xl font-bold mb-3 relative z-10">Real Cash Prizes</h3>
                <p className="text-muted-foreground relative z-10">Transparent prize pools. The more teams that join, the bigger the payout.</p>
              </div>
              <div className="bg-background p-8 rounded-2xl border border-border">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-6">
                  <Shield className="w-6 h-6 text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold mb-3">Instant Withdrawals</h3>
                <p className="text-muted-foreground">Secure your winnings easily with fast bKash and Nagad payouts.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Upcoming Tournaments Preview */}
        <section className="py-20 border-t border-border/50">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex justify-between items-end mb-10">
              <div>
                <h2 className="text-3xl font-display font-bold mb-2">Upcoming Events</h2>
                <p className="text-muted-foreground">Spots fill up fast. Register your team today.</p>
              </div>
              <Link href="/tournaments">
                <Button variant="ghost" className="hidden sm:flex items-center">
                  View All <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>

            {isLoading ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                  <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
                    <Skeleton className="h-32 w-full rounded-none" />
                    <div className="p-5 space-y-4">
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                      <div className="pt-4 border-t border-border flex justify-between">
                        <Skeleton className="h-8 w-1/3" />
                        <Skeleton className="h-8 w-1/3" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : tournaments && tournaments.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tournaments.slice(0, 3).map((tournament) => (
                  <div key={tournament.id} className="rounded-xl border border-border bg-card overflow-hidden hover:border-primary/50 transition-colors group">
                    <div className="h-32 bg-muted relative p-5 flex flex-col justify-end">
                      <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent z-0" />
                      <h3 className="text-xl font-bold relative z-10 text-foreground">{tournament.gameName}</h3>
                      <div className="flex items-center text-sm text-primary font-medium relative z-10">
                        <Users className="w-4 h-4 mr-1" />
                        {tournament.teamSize.toUpperCase()}
                      </div>
                    </div>
                    <div className="p-5">
                      <div className="flex justify-between mb-4 text-sm">
                        <span className="text-muted-foreground">Entry Fee</span>
                        <span className="font-mono text-foreground font-bold">{tournament.entryFee} TK</span>
                      </div>
                      <div className="flex justify-between mb-6 text-sm">
                        <span className="text-muted-foreground">Est. Prize Pool</span>
                        <span className="font-mono text-accent font-bold">{tournament.estimatedPrizePool} TK</span>
                      </div>
                      <Link href={`/tournaments/${tournament.id}`}>
                        <Button className="w-full group-hover:shadow-[0_0_15px_rgba(168,85,247,0.3)] transition-shadow">
                          View Details
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-card rounded-xl border border-border">
                <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-1">No upcoming tournaments</h3>
                <p className="text-muted-foreground">Check back soon for new events.</p>
              </div>
            )}
            
            <div className="mt-8 text-center sm:hidden">
              <Link href="/tournaments">
                <Button variant="outline" className="w-full">
                  View All Tournaments
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/50 py-8 bg-card text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center mb-4">
          <Trophy className="w-5 h-5 text-primary mr-2 opacity-50" />
          <span className="font-display font-bold tracking-widest opacity-50">RAGXION</span>
        </div>
        <p>&copy; {new Date().getFullYear()} Ragxion Esports. Bangladesh.</p>
      </footer>
    </div>
  );
}
