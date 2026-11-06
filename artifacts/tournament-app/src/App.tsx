import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkProvider, SignIn, SignUp, useClerk, useAuth } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { dark } from "@clerk/themes";
import NotFound from "@/pages/not-found";

import Home from "./pages/home";
import Dashboard from "./pages/dashboard";
import Tournaments from "./pages/tournaments";
import TournamentDetail from "./pages/tournament-detail";
import FinalInfo from "./pages/final-info";
import Profile from "./pages/profile";
import Admin from "./pages/admin";
import Deposit from "./pages/deposit";
import Layout from "./components/layout";

const queryClient = new QueryClient();

setBaseUrl(import.meta.env.VITE_API_BASE_URL || null);

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkAppearance = {
  theme: dark,
  cssLayerName: "clerk",
  variables: {
    colorPrimary: "hsl(280 100% 60%)",
    colorForeground: "hsl(0 0% 98%)",
    colorMutedForeground: "hsl(240 5% 65%)",
    colorBackground: "hsl(240 10% 6%)",
    colorInput: "hsl(240 10% 12%)",
    colorInputForeground: "hsl(0 0% 98%)",
    colorNeutral: "hsl(240 10% 12%)",
    colorDanger: "hsl(0 84% 60%)",
    fontFamily: '"Inter", sans-serif',
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-card rounded-2xl w-[440px] max-w-full overflow-hidden border border-border",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
  },
};

const authPageBg = "flex min-h-[100dvh] items-center justify-center bg-background px-4 bg-[radial-gradient(circle_at_15%_50%,rgba(168,85,247,0.05),transparent_25%),radial-gradient(circle_at_85%_30%,rgba(236,72,153,0.05),transparent_25%)]";

function SignInPage() {
  return (
    <div className={`${authPageBg} flex-col gap-4`}>
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        fallbackRedirectUrl={`${basePath}/dashboard`}
      />
      <p className="max-w-[440px] px-4 text-center text-xs leading-5 text-muted-foreground">
        Existing Ragxion member-er email jodi khuje na pay, same email diye{" "}
        <a className="text-primary underline underline-offset-4" href={`${basePath}/sign-up`}>
          Sign Up
        </a>{" "}
        korun—your existing Ragxion profile and balance will be restored.
      </p>
    </div>
  );
}

function SignUpPage() {
  useEffect(() => {
    const eyeIcon = `
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2.06 12.35a1 1 0 0 1 0-.7C3.74 7.77 7.53 5 12 5c4.47 0 8.26 2.77 9.94 6.65a1 1 0 0 1 0 .7C20.26 16.23 16.47 19 12 19c-4.47 0-8.26-2.77-9.94-6.65Z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>`;
    const eyeOffIcon = `
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m3 3 18 18"/>
        <path d="M10.58 10.58a2 2 0 0 0 2.83 2.83"/>
        <path d="M9.36 5.37A10.93 10.93 0 0 1 12 5c4.47 0 8.26 2.77 9.94 6.65a1 1 0 0 1 0 .7 10.97 10.97 0 0 1-4.13 4.74"/>
        <path d="M6.61 6.61a10.97 10.97 0 0 0-4.55 5.04 1 1 0 0 0 0 .7C3.74 16.23 7.53 19 12 19a10.93 10.93 0 0 0 2.64-.37"/>
      </svg>`;

    const installPasswordToggles = () => {
      document.querySelectorAll<HTMLInputElement>('input[type="password"]').forEach((input) => {
        if (input.dataset.arenaPasswordToggle === "true") return;

        const container = input.parentElement;
        if (!container) return;

        container.classList.add("arena-password-field");
        input.classList.add("arena-password-input");
        input.dataset.arenaPasswordToggle = "true";

        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "arena-password-toggle";
        toggle.setAttribute("aria-label", "Show password");
        toggle.setAttribute("title", "Show password");
        toggle.innerHTML = eyeIcon;

        toggle.addEventListener("click", () => {
          const isVisible = input.type === "text";
          input.type = isVisible ? "password" : "text";
          toggle.setAttribute("aria-label", isVisible ? "Show password" : "Hide password");
          toggle.setAttribute("title", isVisible ? "Show password" : "Hide password");
          toggle.innerHTML = isVisible ? eyeIcon : eyeOffIcon;
        });

        container.appendChild(toggle);
      });
    };

    const observer = new MutationObserver(installPasswordToggles);
    observer.observe(document.body, { childList: true, subtree: true });
    installPasswordToggles();

    return () => {
      observer.disconnect();
      document.querySelectorAll<HTMLInputElement>('input[data-arena-password-toggle="true"]').forEach((input) => {
        input.dataset.arenaPasswordToggle = "false";
        input.classList.remove("arena-password-input");
        input.parentElement?.classList.remove("arena-password-field");
      });
      document.querySelectorAll(".arena-password-toggle").forEach((toggle) => toggle.remove());
    };
  }, []);

  return (
    <div className={authPageBg}>
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        fallbackRedirectUrl={`${basePath}/dashboard`}
      />
    </div>
  );
}

/** Renders a full-screen dark background while Clerk initialises to avoid flashing blank/white. */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    // Show nothing but keep the dark background — no flash, no blank white
    return <div className="min-h-[100dvh] bg-background" />;
  }

  if (!isSignedIn) {
    return <Redirect to="/sign-in" />;
  }

  return <>{children}</>;
}

function HomeRedirect() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <div className="min-h-[100dvh] bg-background" />;
  }

  if (isSignedIn) {
    return <Redirect to="/dashboard" />;
  }

  return <Home />;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function ClerkApiClientConfig() {
  const { getToken } = useAuth();

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    return () => setAuthTokenGetter(null);
  }, [getToken]);

  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
      localization={{
        signIn: {
          start: {
            title: "Welcome Back",
            subtitle: "Sign in to compete on Ragxion",
          },
        },
        signUp: {
          start: {
            title: "Join Ragxion",
            subtitle: "Create your account to start competing",
          },
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkApiClientConfig />
        <ClerkQueryClientCacheInvalidator />
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route path="/dashboard">
            <AuthGate><Layout><Dashboard /></Layout></AuthGate>
          </Route>
          <Route path="/tournaments">
            <Layout><Tournaments /></Layout>
          </Route>
          <Route path="/tournaments/:id/final-info">
            <Layout><FinalInfo /></Layout>
          </Route>
          <Route path="/tournaments/:id">
            <Layout><TournamentDetail /></Layout>
          </Route>
          <Route path="/profile">
            <AuthGate><Layout><Profile /></Layout></AuthGate>
          </Route>
          <Route path="/admin">
            <AuthGate><Layout><Admin /></Layout></AuthGate>
          </Route>
          <Route path="/deposit">
            <AuthGate><Layout><Deposit /></Layout></AuthGate>
          </Route>
          <Route component={NotFound} />
        </Switch>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <TooltipProvider>
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
