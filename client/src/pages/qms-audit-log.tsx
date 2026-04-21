import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, Loader2, Search } from "lucide-react";
import { QmsComplianceBanner } from "@/components/qms-compliance-banner";
import { format } from "date-fns";

interface AuditLogEntry {
  id: number;
  tableName: string;
  recordId: string;
  operation: string;
  actorId: string;
  actorEmail: string;
  beforeJson: string | null;
  afterJson: string | null;
  occurredAt: string | null;
}

const OP_COLORS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  UPDATE: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  DELETE: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  SIGN: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  TRANSITION: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
};

export default function QmsAuditLog() {
  const [actorFilter, setActorFilter] = useState("");
  const [tableFilter, setTableFilter] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: entries = [], isLoading } = useQuery<AuditLogEntry[]>({
    queryKey: ["/api/qms/audit-log", actorFilter, tableFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (actorFilter) params.set("actorId", actorFilter);
      if (tableFilter) params.set("table", tableFilter);
      params.set("limit", "200");
      return fetch(`/api/qms/audit-log?${params}`).then(r => r.json());
    },
  });

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Audit Log</h1>
        <p className="text-sm text-muted-foreground">
          Immutable record of all QMS write operations. INSERT-only — records cannot be modified or deleted.
        </p>
      </div>

      <QmsComplianceBanner />

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={actorFilter}
            onChange={e => setActorFilter(e.target.value)}
            placeholder="Filter by actor email..."
            className="pl-8 pr-3 py-1.5 rounded-md border border-border bg-background text-sm w-52"
          />
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={tableFilter}
            onChange={e => setTableFilter(e.target.value)}
            placeholder="Filter by table..."
            className="pl-8 pr-3 py-1.5 rounded-md border border-border bg-background text-sm w-44"
          />
        </div>
      </div>

      {/* Log table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground">
            <ShieldCheck className="h-8 w-8 mb-2 opacity-30" />
            No audit log entries found.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide w-8">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Timestamp</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Operation</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Table</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Record ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Diff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map(entry => (
                <>
                  <tr
                    key={entry.id}
                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                    className="cursor-pointer hover:bg-muted/40 transition-colors"
                  >
                    <td className="px-4 py-3 text-xs text-muted-foreground">{entry.id}</td>
                    <td className="px-4 py-3 text-xs font-mono">
                      {entry.occurredAt ? format(new Date(entry.occurredAt), "MM/dd/yyyy HH:mm:ss") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${OP_COLORS[entry.operation] ?? "bg-muted text-muted-foreground"}`}>
                        {entry.operation}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{entry.tableName}</td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground truncate max-w-[120px]">{entry.recordId}</td>
                    <td className="px-4 py-3 text-xs">{entry.actorEmail}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {(entry.beforeJson || entry.afterJson) ? "view ↓" : "—"}
                    </td>
                  </tr>
                  {expandedId === entry.id && (entry.beforeJson || entry.afterJson) && (
                    <tr key={`${entry.id}-expanded`}>
                      <td colSpan={7} className="bg-muted/20 px-4 py-3">
                        <div className="grid grid-cols-2 gap-4">
                          {entry.beforeJson && (
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Before</div>
                              <pre className="text-[10px] font-mono overflow-auto max-h-40 bg-background rounded border border-border p-2 text-muted-foreground">
                                {JSON.stringify(JSON.parse(entry.beforeJson), null, 2)}
                              </pre>
                            </div>
                          )}
                          {entry.afterJson && (
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">After</div>
                              <pre className="text-[10px] font-mono overflow-auto max-h-40 bg-background rounded border border-border p-2 text-muted-foreground">
                                {JSON.stringify(JSON.parse(entry.afterJson), null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground">
        Showing up to 200 most recent entries. All QMS write operations are logged automatically.
        This table is INSERT-only — no records can be modified or deleted.
      </p>
    </div>
  );
}
