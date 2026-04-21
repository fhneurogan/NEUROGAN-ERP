import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, AlertTriangle, Loader2, ChevronRight } from "lucide-react";
import { QmsComplianceBanner } from "@/components/qms-compliance-banner";
import { useQmsUser } from "@/components/qms-user-selector";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

interface Complaint {
  id: string;
  number: string;
  category: string;
  lotId: string | null;
  lotNumber: string | null;
  sku: string | null;
  productName: string | null;
  source: string;
  gorgiasTicketId: string | null;
  customerName: string | null;
  description: string;
  status: string;
  lotLinkageRequired: boolean;
  rootCause: string | null;
  correctiveAction: string | null;
  closedBy: string | null;
  closedAt: string | null;
  receivedAt: string | null;
  createdAt: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  under_investigation: "Under Investigation",
  pending_qc_review: "Pending QC Review",
  closed: "Closed",
  escalated_sae: "Escalated (SAE)",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  under_investigation: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  pending_qc_review: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  closed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  escalated_sae: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const CATEGORY_LABELS: Record<string, string> = {
  quality: "Quality",
  adverse_event: "Adverse Event",
  serious_adverse_event: "Serious Adverse Event (SAE)",
  labeling: "Labeling",
  foreign_matter: "Foreign Matter",
};

export default function QmsComplaints() {
  const queryClient = useQueryClient();
  const { activeUser } = useQmsUser();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [newComplaint, setNewComplaint] = useState({
    category: "quality",
    customerName: "",
    source: "gorgias",
    gorgiasTicketId: "",
    lotNumber: "",
    description: "",
  });

  const { data: complaints = [], isLoading } = useQuery<Complaint[]>({
    queryKey: ["/api/qms/complaints", statusFilter],
    queryFn: () => {
      const params = statusFilter ? `?status=${statusFilter}` : "";
      return fetch(`/api/qms/complaints${params}`).then(r => r.json());
    },
  });

  const selected = complaints.find(c => c.id === selectedId);

  const createMutation = useMutation({
    mutationFn: (data: typeof newComplaint) =>
      apiRequest("POST", "/api/qms/complaints", {
        ...data,
        actorId: activeUser?.id,
        actorEmail: activeUser?.email,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/qms/complaints"] });
      queryClient.invalidateQueries({ queryKey: ["/api/qms/dashboard"] });
      setShowCreate(false);
      setNewComplaint({ category: "quality", customerName: "", source: "gorgias", gorgiasTicketId: "", lotNumber: "", description: "" });
    },
  });

  const transitionMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("POST", `/api/qms/complaints/${id}/transition`, {
        newStatus: status,
        actorId: activeUser?.id,
        actorEmail: activeUser?.email,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/qms/complaints"] });
      queryClient.invalidateQueries({ queryKey: ["/api/qms/dashboard"] });
    },
  });

  function nextStatus(current: string): string | null {
    const transitions: Record<string, string> = {
      open: "under_investigation",
      under_investigation: "pending_qc_review",
      pending_qc_review: "closed",
    };
    return transitions[current] ?? null;
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Complaint Management</h1>
          <p className="text-sm text-muted-foreground">
            Track customer complaints, adverse events, and quality investigations.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Log Complaint
        </button>
      </div>

      <QmsComplianceBanner />

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {["", "open", "under_investigation", "pending_qc_review", "closed", "escalated_sae"].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === s
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {s ? STATUS_LABELS[s] : "All"}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : complaints.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mb-2 opacity-30" />
            No complaints found.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Number</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lot</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Received</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {complaints.map(c => (
                <tr
                  key={c.id}
                  onClick={() => setSelectedId(c.id === selectedId ? null : c.id)}
                  className="cursor-pointer hover:bg-muted/40 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs font-medium">{c.number}</td>
                  <td className="px-4 py-3 text-xs">{CATEGORY_LABELS[c.category] ?? c.category}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{c.customerName ?? "—"}</td>
                  <td className="px-4 py-3 text-xs font-mono">{c.lotNumber ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[c.status] ?? ""}`}>
                      {STATUS_LABELS[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {c.receivedAt ? format(new Date(c.receivedAt), "MMM d, yyyy") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${selectedId === c.id ? "rotate-90" : ""}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">{selected.number}</h2>
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLORS[selected.status] ?? ""}`}>
              {STATUS_LABELS[selected.status] ?? selected.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div><span className="text-muted-foreground">Category:</span> {CATEGORY_LABELS[selected.category] ?? selected.category}</div>
            <div><span className="text-muted-foreground">Source:</span> {selected.source}</div>
            <div><span className="text-muted-foreground">Customer:</span> {selected.customerName ?? "—"}</div>
            <div><span className="text-muted-foreground">Gorgias Ticket:</span> {selected.gorgiasTicketId ?? "—"}</div>
            <div><span className="text-muted-foreground">Lot:</span> {selected.lotNumber ?? "—"}</div>
            <div><span className="text-muted-foreground">SKU:</span> {selected.sku ?? "—"}</div>
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Description</div>
            <p className="text-sm">{selected.description}</p>
          </div>

          {selected.rootCause && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Root Cause</div>
              <p className="text-sm">{selected.rootCause}</p>
            </div>
          )}

          {selected.correctiveAction && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Corrective Action</div>
              <p className="text-sm">{selected.correctiveAction}</p>
            </div>
          )}

          {selected.lotLinkageRequired && !selected.lotNumber && (
            <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              Lot linkage required before this complaint can be closed.
            </div>
          )}

          {nextStatus(selected.status) && (
            <div className="flex justify-end">
              <button
                onClick={() => transitionMutation.mutate({ id: selected.id, status: nextStatus(selected.status)! })}
                disabled={transitionMutation.isPending}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {transitionMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Advance to: {STATUS_LABELS[nextStatus(selected.status)!]}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-card border border-border p-6 shadow-xl">
            <h2 className="text-base font-semibold mb-4">Log New Complaint</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Category</label>
                <select
                  value={newComplaint.category}
                  onChange={e => setNewComplaint(p => ({ ...p, category: e.target.value }))}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Source</label>
                <select
                  value={newComplaint.source}
                  onChange={e => setNewComplaint(p => ({ ...p, source: e.target.value }))}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="gorgias">Gorgias</option>
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="in_person">In Person</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Customer Name</label>
                <input
                  value={newComplaint.customerName}
                  onChange={e => setNewComplaint(p => ({ ...p, customerName: e.target.value }))}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Gorgias Ticket ID</label>
                <input
                  value={newComplaint.gorgiasTicketId}
                  onChange={e => setNewComplaint(p => ({ ...p, gorgiasTicketId: e.target.value }))}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  placeholder="e.g. #12345"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Lot Number (if known)</label>
                <input
                  value={newComplaint.lotNumber}
                  onChange={e => setNewComplaint(p => ({ ...p, lotNumber: e.target.value }))}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Description *</label>
                <textarea
                  value={newComplaint.description}
                  onChange={e => setNewComplaint(p => ({ ...p, description: e.target.value }))}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[80px]"
                  placeholder="Describe the complaint..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate(newComplaint)}
                disabled={!newComplaint.description || createMutation.isPending}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Log Complaint
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
