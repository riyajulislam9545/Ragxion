import { useState } from "react";
import { Link } from "wouter";
import { useListTournaments, TournamentStatus } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Users, Swords, Calendar } from "lucide-react";
import { format } from "date-fns";
import { getTournamentImageUrl } from "@/lib/tournament-media";

export default function Tournaments() {
  const [statusFilter, setStatusFilter] = useState<TournamentStatus | "all">("all");
  
  const { data: tournaments, isLoading, isError } = useListTournaments(
    statusFilter === "all" ? undefined : { status: statusFilter }
  );

  const getStatusColor = (status: TournamentStatus) => {
    switch (status) {
      case "upcoming": return "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20";
      case "registration_open": return "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20";
      case "registration_closed": return "bg-orange-500/10 text-orange-500 hover:bg-orange-500/20";
      case "ongoing": return "bg-primary/10 text-primary hover:bg-primary/20";
      case "completed": return "bg-muted text-muted-foreground hover:bg-muted/80";
      default: return "bg-muted text-foreground";
    }
  };

  const getStatusLabel = (status: TournamentStatus) => {
    return status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Tournaments</h1>
          <p className="text-muted-foreground">Find and join active esports competitions.</p>
        </div>
        <div className="w-full sm:w-64">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as TournamentStatus | "all")}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tournaments</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="registration_open">Registration Open</SelectItem>
              <SelectItem value="registration_closed">Registration Closed</SelectItem>
              <SelectItem value="ongoing">Ongoing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i} className="overflow-hidden border-border">
              <Skeleton className="h-32 w-full rounded-none" />
              <CardContent className="p-5 space-y-4">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="pt-4 border-t border-border flex justify-between">
                  <Skeleton className="h-8 w-1/3" />
                  <Skeleton className="h-8 w-1/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 py-16 text-center">
          <Trophy className="mx-auto mb-4 h-12 w-12 text-destructive/70" />
          <h3 className="text-xl font-medium">Tournament feed unavailable</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            We could not load the current competitions. Please refresh and try again.
          </p>
        </div>
      ) : tournaments && tournaments.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tournaments.map((tournament) => (
            <Card key={tournament.id} className="group flex flex-col overflow-hidden border-border bg-card transition-colors hover:border-primary/50">
              <div className="relative flex h-44 flex-col justify-between bg-muted p-5">
                {getTournamentImageUrl(tournament.imageUrl) ? (
                  <img
                    src={getTournamentImageUrl(tournament.imageUrl) ?? undefined}
                    alt={`${tournament.gameName} tournament artwork`}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : null}
                <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(13,10,24,0.9),rgba(13,10,24,0.26)_65%,rgba(16,185,190,0.18))] pointer-events-none" />
                <div className="flex justify-between items-start relative z-10">
                  <Badge variant="secondary" className={`${getStatusColor(tournament.status)} border-0`}>
                    {getStatusLabel(tournament.status)}
                  </Badge>
                  <div className="flex items-center text-sm font-medium bg-background/50 backdrop-blur-sm px-2 py-1 rounded-md">
                    <Users className="w-3.5 h-3.5 mr-1" />
                    {tournament.registeredCount}/{tournament.maxSlots}
                  </div>
                </div>
                <div className="relative z-10">
                  <h3 className="text-xl font-bold text-foreground truncate" title={tournament.gameName}>
                    {tournament.gameName}
                  </h3>
                  <div className="flex items-center text-sm text-primary font-medium mt-1">
                    <Swords className="w-4 h-4 mr-1" />
                    {tournament.teamSize.toUpperCase()}
                  </div>
                </div>
              </div>
              <CardContent className="p-5 flex-1 flex flex-col">
                <div className="space-y-3 mb-6 flex-1">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Entry Fee</span>
                    <span className="font-mono text-foreground font-bold bg-muted px-2 py-0.5 rounded">{tournament.entryFee} TK</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Est. Prize Pool</span>
                    <span className="font-mono text-accent font-bold bg-accent/10 px-2 py-0.5 rounded">{tournament.estimatedPrizePool} TK</span>
                  </div>
                  {tournament.registrationDeadline && (
                    <div className="flex justify-between items-center text-sm pt-2 border-t border-border">
                      <span className="text-muted-foreground flex items-center">
                        <Calendar className="w-3.5 h-3.5 mr-1" /> Deadline
                      </span>
                      <span className="text-foreground">{format(new Date(tournament.registrationDeadline), 'MMM d, h:mm a')}</span>
                    </div>
                  )}
                </div>
                <Link
                  href={`/tournaments/${tournament.id}`}
                  className={`inline-flex h-10 w-full items-center justify-center rounded-md px-4 text-sm font-medium transition-shadow group-hover:shadow-[0_0_15px_rgba(71,221,232,0.22)] ${
                    tournament.status === "registration_open"
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border border-input bg-transparent hover:bg-secondary"
                  }`}
                >
                  View Details
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-card rounded-xl border border-border">
          <Trophy className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-medium mb-2">No tournaments found</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            There are currently no tournaments matching your filters. Try selecting a different status or check back later.
          </p>
        </div>
      )}
    </div>
  );
}
