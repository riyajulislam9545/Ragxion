import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useClerk, useUser, Show } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Trophy, Home, LayoutDashboard, Swords, User as UserIcon, ShieldAlert, LogOut, Wallet, Menu } from "lucide-react";
import { useUpsertMe, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { signOut } = useClerk();
  const { user, isLoaded, isSignedIn } = useUser();
  const queryClient = useQueryClient();
  const upsertMe = useUpsertMe();
  const provisioningUserId = useRef<string | null>(null);
  const {
    data: dbUser,
    isLoading: isUserLoading,
    isError: isUserError,
    error: userError,
  } = useGetMe({
    query: { enabled: Boolean(isLoaded && isSignedIn), queryKey: getGetMeQueryKey() },
  });
  const isProfileMissing =
    typeof userError === "object" &&
    userError !== null &&
    "status" in userError &&
    userError.status === 404;

  useEffect(() => {
    if (!isSignedIn || !user) {
      provisioningUserId.current = null;
      return;
    }

    if (
      isUserLoading ||
      dbUser ||
      !isUserError ||
      !isProfileMissing ||
      provisioningUserId.current === user.id
    ) {
      return;
    }

    provisioningUserId.current = user.id;
    upsertMe.mutate(
      {
        data: {
          email: user.primaryEmailAddress?.emailAddress,
          username: user.username || user.firstName || undefined,
        },
      },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        },
      },
    );
  }, [
    isSignedIn,
    user,
    isUserLoading,
    isUserError,
    isProfileMissing,
    userError,
    dbUser,
    queryClient,
    upsertMe.mutate,
  ]);

  const isProvisioning = Boolean(
    isSignedIn &&
      user &&
      isUserError &&
      isProfileMissing &&
      !upsertMe.isError,
  );
  const profileError =
    isSignedIn && isUserError && !isProvisioning && !dbUser
      ? upsertMe.error ?? userError
      : upsertMe.isError && !dbUser
        ? upsertMe.error
        : null;

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/tournaments", label: "Tournaments", icon: Swords },
    { href: "/profile", label: "Profile", icon: UserIcon },
  ];

  if (dbUser?.isAdmin) {
    navItems.push({ href: "/admin", label: "Admin Panel", icon: ShieldAlert });
  }

  const navigation = (
    <nav className="flex-1 overflow-y-auto p-4 space-y-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location === item.href || location.startsWith(`${item.href}/`);
        return (
          <Link key={item.href} href={item.href}>
            <div
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center px-3 py-2.5 rounded-md cursor-pointer transition-colors ${
                isActive 
                  ? "bg-primary text-primary-foreground font-medium shadow-[0_0_15px_rgba(168,85,247,0.3)]" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Icon className={`w-5 h-5 mr-3 ${isActive ? "text-primary-foreground" : ""}`} />
              {item.label}
            </div>
          </Link>
        );
      })}
    </nav>
  );

  const accountSummary = (
    <div className="p-4 border-b border-border bg-muted/20">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
          {user?.username?.[0]?.toUpperCase() || user?.firstName?.[0]?.toUpperCase() || "U"}
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="text-sm font-medium text-foreground truncate">
            {user?.username || user?.firstName || "Player"}
          </div>
          <div className="text-xs text-muted-foreground flex items-center mt-1">
            <Wallet className="w-3 h-3 mr-1 text-primary" />
            {isUserLoading ? (
              <Skeleton className="h-3 w-12" />
            ) : (
              <span className="font-mono text-primary font-bold">{dbUser?.walletBalance ?? 0} TK</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const signOutButton = (
    <Button 
      variant="ghost" 
      className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10"
      onClick={() => {
        setMobileMenuOpen(false);
        void signOut({ redirectUrl: import.meta.env.BASE_URL || "/" });
      }}
    >
      <LogOut className="w-5 h-5 mr-3" />
      Sign Out
    </Button>
  );

  if (isSignedIn && (!isLoaded || isUserLoading || isProvisioning || (!dbUser && !profileError))) {
    return (
      <div className="min-h-[100dvh] space-y-6 bg-background p-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <Skeleton key={item} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="min-h-[100dvh] bg-background p-6">
        <Alert variant="destructive" className="mx-auto max-w-2xl">
          <AlertTitle>Could not load your account</AlertTitle>
          <AlertDescription>
            {profileError instanceof Error
              ? profileError.message
              : "The server could not prepare your profile. Please refresh and try again."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] min-w-0 bg-background">
      {/* Sidebar */}
      <div className="hidden md:flex md:w-64 md:shrink-0 border-r border-border bg-card flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <Trophy className="w-6 h-6 text-primary mr-2" />
          <span className="font-display font-bold text-xl tracking-wider text-foreground">RAGXION</span>
        </div>
        {accountSummary}
        {navigation}

        <div className="p-4 border-t border-border">
          {signOutButton}
        </div>
      </div>

      {/* Main Content */}
      <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur md:hidden">
          <div className="flex items-center">
            <Trophy className="mr-2 h-5 w-5 text-primary" />
            <span className="font-display text-lg font-bold tracking-wider text-foreground">RAGXION</span>
          </div>
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <Button
              variant="outline"
              size="icon"
              className="border-border"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <SheetContent side="left" className="flex w-[min(18rem,85vw)] flex-col gap-0 bg-card p-0">
              <SheetHeader className="border-b border-border px-6 py-5 text-left">
                <SheetTitle className="flex items-center font-display tracking-wider">
                  <Trophy className="mr-2 h-5 w-5 text-primary" />
                  RAGXION
                </SheetTitle>
              </SheetHeader>
              {accountSummary}
              {navigation}
              <div className="border-t border-border p-4">
                {signOutButton}
              </div>
            </SheetContent>
          </Sheet>
        </header>
        <div className="mx-auto w-full max-w-6xl p-4 sm:p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
