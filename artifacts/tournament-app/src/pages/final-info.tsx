import { ArrowLeft, CalendarClock, ClipboardCheck, Info, Radio, ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import { Link, useParams } from "wouter";
import { useGetTournament, getGetTournamentQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function FinalInfo() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { data, isLoading, isError } = useGetTournament(id, {
    query: { enabled: !!id, queryKey: getGetTournamentQueryKey(id) },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-[28rem] w-full rounded-2xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-destructive" />
        <h1 className="font-display text-2xl font-bold">Information unavailable</h1>
        <p className="mt-2 text-muted-foreground">We could not load this tournament&apos;s match brief.</p>
        <Link href="/tournaments" className="mt-6 inline-flex">
          <Button variant="outline">Back to tournaments</Button>
        </Link>
      </div>
    );
  }

  const { tournament } = data;
  const isPublished =
    (tournament.status === "registration_closed" || tournament.status === "ongoing") &&
    Boolean(tournament.finalInformation?.trim());

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      <Link
        href={`/tournaments/${tournament.id}`}
        className="inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
        Back to {tournament.gameName}
      </Link>

      <header className="relative overflow-hidden rounded-2xl border border-primary/25 bg-card px-6 py-8 sm:px-10">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <Badge className="border-primary/30 bg-primary/10 text-primary">
              <Radio className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Match brief
            </Badge>
            <span className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {tournament.status.replace("_", " ")}
            </span>
          </div>
          <h1 className="max-w-3xl font-display text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
            {tournament.gameName}
            <span className="block text-primary">final information</span>
          </h1>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center">
              <CalendarClock className="mr-2 h-4 w-4 text-accent" aria-hidden="true" />
              {tournament.registrationDeadline
                ? format(new Date(tournament.registrationDeadline), "MMM d, yyyy · h:mm a")
                : "Schedule to be announced"}
            </span>
            <span className="inline-flex items-center">
              <ClipboardCheck className="mr-2 h-4 w-4 text-accent" aria-hidden="true" />
              {tournament.registeredCount}/{tournament.maxSlots} slots confirmed
            </span>
          </div>
        </div>
      </header>

      {isPublished ? (
        <Card className="overflow-hidden border-accent/30 bg-card shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
          <CardHeader className="border-b border-border bg-accent/[0.06] px-6 py-5 sm:px-10">
            <CardTitle className="flex items-center gap-3 text-xl">
              <Info className="h-5 w-5 text-accent" aria-hidden="true" />
              Read before you queue
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              This brief is authored by Ragxion admins. Keep it open during match check-in.
            </p>
          </CardHeader>
          <CardContent className="px-6 py-8 sm:px-10 sm:py-10">
            <div className="prose prose-invert max-w-none whitespace-pre-wrap text-[15px] leading-7 text-foreground/90">
              {tournament.finalInformation}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border bg-card">
          <CardContent className="px-6 py-16 text-center sm:px-10">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
              <CalendarClock className="h-7 w-7 text-primary" aria-hidden="true" />
            </div>
            <h2 className="font-display text-2xl font-bold">The match brief is not published yet</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
              Final room details and check-in instructions appear here after registration closes and the admins publish them.
            </p>
            <Link href={`/tournaments/${tournament.id}`} className="mt-7 inline-flex">
              <Button variant="outline">Return to tournament</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}