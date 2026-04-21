import { AlertTriangle, ShieldAlert } from "lucide-react";

export function QmsComplianceBanner() {
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-2.5 text-xs text-amber-800 dark:text-amber-300">
        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          <strong>Part 11 Note:</strong> This system currently uses a hardcoded 4-digit PIN for
          re-authentication (demo mode). This is <strong>NOT</strong> 21 CFR Part 11 compliant for
          production or FDA inspection use.
        </span>
      </div>
      <div className="flex items-start gap-2 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-2.5 text-xs text-red-800 dark:text-red-300">
        <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          <strong>TODO — Required before FDA inspection or production release:</strong> Replace
          hardcoded PIN users and PIN re-auth with (1) Google Workspace OAuth 2.0 / OIDC for login
          (identification component) and (2) TOTP via Google Authenticator for e-signature
          re-authentication (authentication component). This satisfies 21 CFR Part 11 §11.200(a)(1)
          two-component electronic signature requirements. User records must also be migrated from
          the seeded demo users to verified employee identities with individual TOTP secrets stored
          under envelope encryption. Estimated effort: 3–5 days. See architecture plan on file.
        </span>
      </div>
    </div>
  );
}
