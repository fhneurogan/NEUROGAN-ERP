import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { KeyRound, ShieldAlert, LogOut } from "lucide-react";

// F-01 profile skeleton. Password rotation form + "force logout all sessions"
// button are F-02 scope (requires auth context). For now this page just shows
// the current user's info as fetched from GET /api/auth/me (F-02) or falls
// back to a placeholder shell when unauthenticated.

interface ProfileData {
  id: string;
  email: string;
  fullName: string;
  title: string | null;
  roles: string[];
  status: "ACTIVE" | "DISABLED";
  passwordChangedAt?: string | null;
}

export default function Profile() {
  // /api/auth/me is defined in F-02. Until it exists, this query 404s and we
  // render the placeholder. The hook is stable so F-02 lands without UI churn.
  const { data, isLoading, isError } = useQuery<ProfileData>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/auth/me");
      return res.json();
    },
    retry: false,
  });

  if (isError) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Profile</h1>
        </div>
        <div className="rounded-md border border-border p-6 bg-muted/40">
          <p className="text-sm font-medium">Sign-in required</p>
          <p className="text-xs text-muted-foreground mt-1">
            The profile page requires authentication. The login flow and password-rotation form
            ship with ticket F-02.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold mb-6">Your profile</h1>

      <div className="space-y-4 rounded-md border border-border bg-card p-4">
        {isLoading ? (
          <>
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </>
        ) : data ? (
          <>
            <ProfileField label="Full name" value={data.fullName} />
            <ProfileField label="Email" value={data.email} />
            <ProfileField label="Title" value={data.title ?? "—"} />
            <ProfileField
              label="Roles"
              value={
                <div className="flex flex-wrap gap-1">
                  {data.roles.length === 0 ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    data.roles.map((r) => (
                      <Badge key={r} variant={r === "ADMIN" ? "default" : "secondary"}>
                        {r}
                      </Badge>
                    ))
                  )}
                </div>
              }
            />
            <ProfileField label="Status" value={<Badge variant="default">{data.status}</Badge>} />
            {data.passwordChangedAt && (
              <ProfileField
                label="Password last changed"
                value={new Date(data.passwordChangedAt).toLocaleString()}
              />
            )}
          </>
        ) : null}
      </div>

      <div className="mt-6 space-y-3 rounded-md border border-dashed border-border p-4 bg-muted/30">
        <div className="flex items-start gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-sm font-medium">Rotate password</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              The password rotation form lands with ticket F-02 (authentication). You will be able
              to verify your current password and set a new one that meets the policy (12+ chars,
              complexity, 90-day cycle per spec D-02).
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" disabled data-testid="button-rotate-password">
          <KeyRound className="h-3.5 w-3.5 mr-1.5" /> Rotate password (F-02)
        </Button>
      </div>

      <div className="mt-4 space-y-3 rounded-md border border-dashed border-border p-4 bg-muted/30">
        <div className="flex items-start gap-2">
          <LogOut className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-sm font-medium">Force logout all sessions</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Available after F-02 mounts express-session + connect-pg-simple.
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" disabled data-testid="button-logout-all">
          <LogOut className="h-3.5 w-3.5 mr-1.5" /> Force logout (F-02)
        </Button>
      </div>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-start gap-3">
      <div className="text-xs text-muted-foreground pt-0.5">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}
