import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, Trash2, Beaker, Play, CheckCircle, Pause, RotateCcw, Pencil, XCircle, AlertTriangle, Info, MessageSquare, Send, ClipboardCheck, Printer } from "lucide-react";
import { Link } from "wouter";
import { formatQty } from "@/lib/formatQty";
import type {
  ProductionBatchWithDetails,
  Product,
  Location,
  InventoryGrouped,
  RecipeWithDetails,
} from "@shared/schema";

// Types for FIFO allocation API response
interface FIFOAllocation {
  lotId: string;
  lotNumber: string;
  locationId: string;
  locationName: string;
  quantity: number;
  expirationDate: string | null;
  uom: string;
}

// ── Status badge ──

function statusBadge(status: string) {
  switch (status) {
    case "DRAFT":
      return <Badge variant="secondary" className="text-xs" data-testid={`badge-status-${status}`}>Draft</Badge>;
    case "IN_PROGRESS":
      return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-0 text-xs" data-testid={`badge-status-${status}`}>In Progress</Badge>;
    case "COMPLETED":
      return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-0 text-xs" data-testid={`badge-status-${status}`}>Completed</Badge>;
    case "ON_HOLD":
      return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-0 text-xs" data-testid={`badge-status-${status}`}>On Hold</Badge>;
    case "SCRAPPED":
      return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-0 text-xs" data-testid={`badge-status-${status}`}>Scrapped</Badge>;
    default:
      return <Badge variant="secondary" className="text-xs">{status}</Badge>;
  }
}

function qcStatusBadge(status: string | null) {
  switch (status) {
    case "PASS":
      return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-0 text-xs" data-testid="badge-qc-pass">Pass</Badge>;
    case "FAIL":
      return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-0 text-xs" data-testid="badge-qc-fail">Fail</Badge>;
    case "ON_HOLD":
      return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-0 text-xs" data-testid="badge-qc-hold">QC Hold</Badge>;
    case "PENDING":
    default:
      return <Badge variant="secondary" className="text-xs" data-testid="badge-qc-pending">Pending</Badge>;
  }
}

// ── Batch list item ──

function BatchListItem({
  batch,
  isSelected,
  onClick,
}: {
  batch: ProductionBatchWithDetails;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={`item-batch-${batch.id}`}
      className={`w-full text-left px-4 pr-5 py-3 border-b border-border/50 transition-colors hover:bg-muted/50 ${
        isSelected ? "bg-primary/5 border-l-2 border-l-primary" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate" data-testid={`text-batch-number-${batch.id}`}>{batch.batchNumber}</span>
            {statusBadge(batch.status)}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate" data-testid={`text-batch-product-${batch.id}`}>
            {batch.productName}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-muted-foreground">{batch.startDate ?? "No date"}</p>
        </div>
      </div>
    </button>
  );
}

// ── Create/Edit batch form schema ──

const inputLineSchema = z.object({
  productId: z.string().min(1, "Required"),
  quantityUsed: z.string().min(1, "Required"),
  uom: z.string().min(1, "Required"),
});

const createBatchSchema = z.object({
  batchNumber: z.string().min(1, "Batch number required"),
  productId: z.string().min(1, "Product required"),
  plannedQuantity: z.string().min(1, "Planned quantity required"),
  outputUom: z.string().min(1, "UOM required"),
  startDate: z.string().optional(),
  operatorName: z.string().optional(),
  notes: z.string().optional(),
  inputs: z.array(inputLineSchema).min(1, "At least one input required"),
});

type CreateBatchForm = z.infer<typeof createBatchSchema>;

// Helper: check if a product requires lot tracking
function requiresLot(productId: string, products: Product[]): boolean {
  const p = products.find(x => x.id === productId);
  return !p || p.category !== "SECONDARY_PACKAGING";
}

// ── FIFO Allocation Breakdown ──

function AllocationBreakdown({
  allocations,
  requested,
  sufficient,
  uom,
  onOverride,
}: {
  allocations: FIFOAllocation[];
  requested: number;
  sufficient: boolean;
  uom: string;
  onOverride?: (allocs: FIFOAllocation[]) => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [editAllocations, setEditAllocations] = useState<FIFOAllocation[]>(allocations);

  useEffect(() => {
    setEditAllocations(allocations);
    setEditMode(false);
  }, [allocations]);

  const handleQtyChange = (idx: number, newQty: string) => {
    const updated = [...editAllocations];
    updated[idx] = { ...updated[idx], quantity: parseFloat(newQty) || 0 };
    setEditAllocations(updated);
  };

  const handleSaveOverride = () => {
    onOverride?.(editAllocations.filter(a => a.quantity > 0));
    setEditMode(false);
  };

  const totalAllocated = (editMode ? editAllocations : allocations).reduce((s, a) => s + a.quantity, 0);

  if (allocations.length === 0) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2" data-testid="alert-no-stock">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        No stock available for this material
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">FIFO Lot Breakdown</span>
        <div className="flex items-center gap-2">
          {!sufficient && (
            <span className="text-xs text-red-600 dark:text-red-400 font-medium" data-testid="text-insufficient-stock">
              Insufficient ({formatQty(totalAllocated)} of {formatQty(requested)} {uom})
            </span>
          )}
          {onOverride && !editMode && (
            <Button type="button" variant="ghost" size="sm" className="h-5 text-xs px-1.5" onClick={() => setEditMode(true)} data-testid="button-override-allocation">
              Override
            </Button>
          )}
          {editMode && (
            <Button type="button" variant="ghost" size="sm" className="h-5 text-xs px-1.5" onClick={handleSaveOverride} data-testid="button-save-override">
              Save
            </Button>
          )}
        </div>
      </div>
      <div className="rounded-md border bg-muted/30 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="h-7">
              <TableHead className="text-[10px] py-1">LOT #</TableHead>
              <TableHead className="text-[10px] py-1">Location</TableHead>
              <TableHead className="text-[10px] py-1">Expires</TableHead>
              <TableHead className="text-[10px] py-1 text-right">Qty</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(editMode ? editAllocations : allocations).map((a, idx) => (
              <TableRow key={`${a.lotId}-${a.locationId}`} className="h-7" data-testid={`row-allocation-${idx}`}>
                <TableCell className="text-xs font-mono py-1">{a.lotNumber}</TableCell>
                <TableCell className="text-xs py-1">{a.locationName}</TableCell>
                <TableCell className="text-xs py-1">{a.expirationDate ?? "—"}</TableCell>
                <TableCell className="text-xs py-1 text-right">
                  {editMode ? (
                    <Input
                      type="number"
                      step="any"
                      value={a.quantity}
                      onChange={e => handleQtyChange(idx, e.target.value)}
                      className="h-5 w-20 text-xs ml-auto text-right"
                      data-testid={`input-override-qty-${idx}`}
                    />
                  ) : (
                    <span>{formatQty(a.quantity)}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ── Create/Edit Batch Sheet ──

function CreateBatchSheet({
  open,
  onOpenChange,
  products,
  inventory,
  locations,
  editBatch,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  products: Product[];
  inventory: InventoryGrouped[];
  locations: Location[];
  editBatch: ProductionBatchWithDetails | null;
}) {
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const isEditMode = editBatch !== null;

  // FIFO allocations state: maps input index → allocations
  const [allocationsMap, setAllocationsMap] = useState<Map<number, { allocations: FIFOAllocation[]; sufficient: boolean; requested: number }>>(new Map());

  // Fetch next batch number
  const [nextBatchNumber, setNextBatchNumber] = useState<string>("");
  const [loadingBatchNum, setLoadingBatchNum] = useState(false);

  useEffect(() => {
    if (open && !isEditMode) {
      setLoadingBatchNum(true);
      apiRequest("GET", "/api/production-batches/next-number")
        .then(res => res.json())
        .then(data => {
          setNextBatchNumber(data.batchNumber);
          form.setValue("batchNumber", data.batchNumber);
        })
        .catch(() => {
          setNextBatchNumber("BATCH-001");
          form.setValue("batchNumber", "BATCH-001");
        })
        .finally(() => setLoadingBatchNum(false));
    }
  }, [open, isEditMode]);

  // Filter products to FINISHED_GOOD only for the product dropdown
  const finishedGoods = useMemo(() =>
    products.filter(p => p.category === "FINISHED_GOOD"),
    [products]
  );

  // All non-finished-good products that have stock (or are secondary packaging)
  const materialProducts = useMemo(() => {
    const invProductIds = new Set(inventory.map(i => i.productId));
    return products.filter(p => {
      if (p.category === "FINISHED_GOOD") return false;
      // Show if it has inventory OR is secondary packaging
      return invProductIds.has(p.id) || p.category === "SECONDARY_PACKAGING";
    });
  }, [products, inventory]);

  const defaultInputs = isEditMode && editBatch
    ? editBatch.inputs.map(inp => ({
        productId: inp.productId,
        quantityUsed: inp.quantityUsed,
        uom: inp.uom,
      }))
    : [{ productId: "", quantityUsed: "", uom: "" }];

  const form = useForm<CreateBatchForm>({
    defaultValues: {
      batchNumber: isEditMode ? editBatch?.batchNumber ?? "" : "",
      productId: isEditMode ? editBatch?.productId ?? "" : "",
      plannedQuantity: isEditMode ? editBatch?.plannedQuantity ?? "" : "",
      outputUom: isEditMode ? editBatch?.outputUom ?? "pcs" : "pcs",
      startDate: isEditMode ? editBatch?.startDate ?? today : today,
      operatorName: isEditMode ? editBatch?.operatorName ?? "" : "",
      notes: isEditMode ? editBatch?.notes ?? "" : "",
      inputs: defaultInputs,
    },
  });

  // Reset form when sheet opens or editBatch changes
  useEffect(() => {
    if (open) {
      setAllocationsMap(new Map());
      if (isEditMode && editBatch) {
        form.reset({
          batchNumber: editBatch.batchNumber,
          productId: editBatch.productId,
          plannedQuantity: editBatch.plannedQuantity,
          outputUom: editBatch.outputUom ?? "pcs",
          startDate: editBatch.startDate ?? today,
          operatorName: editBatch.operatorName ?? "",
          notes: editBatch.notes ?? "",
          inputs: editBatch.inputs.map(inp => ({
            productId: inp.productId,
            quantityUsed: inp.quantityUsed,
            uom: inp.uom,
          })),
        });
      } else {
        form.reset({
          batchNumber: "",
          productId: "",
          plannedQuantity: "",
          outputUom: "pcs",
          startDate: today,
          operatorName: "",
          notes: "",
          inputs: [{ productId: "", quantityUsed: "", uom: "" }],
        });
      }
    }
  }, [open, editBatch?.id]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "inputs",
  });

  // Fetch FIFO allocation when material + qty change
  const fetchFIFOAllocation = useCallback(async (index: number, productId: string, quantity: string) => {
    if (!productId || !quantity || parseFloat(quantity) <= 0) {
      setAllocationsMap(prev => {
        const next = new Map(prev);
        next.delete(index);
        return next;
      });
      return;
    }

    // Skip FIFO for secondary packaging
    const prod = products.find(p => p.id === productId);
    if (prod?.category === "SECONDARY_PACKAGING") return;

    try {
      const res = await apiRequest("POST", "/api/stock/allocate-fifo", {
        productId,
        quantity,
      });
      const data = await res.json();
      setAllocationsMap(prev => {
        const next = new Map(prev);
        next.set(index, {
          allocations: data.allocations,
          sufficient: data.sufficient,
          requested: data.requested,
        });
        return next;
      });
    } catch {
      // Silently handle
    }
  }, [products]);

  // ── Recipe auto-populate ──
  const selectedProductId = form.watch("productId");
  const { data: recipesData } = useQuery<RecipeWithDetails[]>({
    queryKey: ["/api/recipes", selectedProductId],
    queryFn: async () => {
      if (!selectedProductId) return [];
      const res = await apiRequest("GET", `/api/recipes?productId=${selectedProductId}`);
      return res.json();
    },
    enabled: !!selectedProductId,
  });
  const recipe = recipesData?.[0]; // First recipe for this product

  // Auto-populate inputs from recipe when product is selected (create mode only)
  useEffect(() => {
    if (!recipe || isEditMode) return;
    const plannedQty = parseFloat(form.getValues("plannedQuantity")) || 1;
    const newInputs = recipe.lines.map(line => ({
      productId: line.productId,
      quantityUsed: String(Math.round(parseFloat(line.quantity) * plannedQty * 1000000) / 1000000),
      uom: line.uom,
    }));
    if (newInputs.length > 0) {
      form.setValue("inputs", newInputs);
      // Trigger FIFO allocation for each auto-populated input
      newInputs.forEach((inp, i) => {
        if (inp.productId && inp.quantityUsed && parseFloat(inp.quantityUsed) > 0) {
          fetchFIFOAllocation(i, inp.productId, inp.quantityUsed);
        }
      });
    }
  }, [recipe?.id, selectedProductId]);

  // Recalculate input quantities when planned quantity changes and recipe is loaded
  const plannedQuantity = form.watch("plannedQuantity");
  useEffect(() => {
    if (!recipe || isEditMode) return;
    const qty = parseFloat(plannedQuantity);
    if (!qty || qty <= 0) return;
    const updatedInputs = recipe.lines.map(line => ({
      productId: line.productId,
      quantityUsed: String(Math.round(parseFloat(line.quantity) * qty * 1000000) / 1000000),
      uom: line.uom,
    }));
    if (updatedInputs.length > 0) {
      form.setValue("inputs", updatedInputs);
      // Trigger FIFO allocation for each updated input
      updatedInputs.forEach((inp, i) => {
        if (inp.productId && inp.quantityUsed && parseFloat(inp.quantityUsed) > 0) {
          fetchFIFOAllocation(i, inp.productId, inp.quantityUsed);
        }
      });
    }
  }, [plannedQuantity, recipe?.id]);

  const createMutation = useMutation({
    mutationFn: async (data: CreateBatchForm) => {
      // Build final inputs from FIFO allocations
      const finalInputs: Array<{
        productId: string;
        lotId: string;
        locationId: string;
        quantityUsed: string;
        uom: string;
      }> = [];

      for (let i = 0; i < data.inputs.length; i++) {
        const inp = data.inputs[i];
        if (!inp.productId) continue;

        const prod = products.find(p => p.id === inp.productId);
        const isSecondary = prod?.category === "SECONDARY_PACKAGING";

        if (isSecondary) {
          // Secondary packaging — no lot/location needed
          finalInputs.push({
            productId: inp.productId,
            lotId: "",
            locationId: "",
            quantityUsed: inp.quantityUsed,
            uom: inp.uom,
          });
        } else {
          // Use FIFO allocations — each allocation becomes a separate input line
          const allocData = allocationsMap.get(i);
          if (!allocData || allocData.allocations.length === 0) {
            throw new Error(`No stock allocation for ${prod?.name ?? "material"}. Please enter a quantity to trigger allocation.`);
          }
          for (const alloc of allocData.allocations) {
            finalInputs.push({
              productId: inp.productId,
              lotId: alloc.lotId,
              locationId: alloc.locationId,
              quantityUsed: String(alloc.quantity),
              uom: alloc.uom,
            });
          }
        }
      }

      if (finalInputs.length === 0) {
        throw new Error("At least one input material is required");
      }

      const payload = {
        batchNumber: data.batchNumber,
        productId: data.productId,
        plannedQuantity: data.plannedQuantity,
        outputUom: data.outputUom,
        startDate: data.startDate || null,
        operatorName: data.operatorName || null,
        notes: data.notes || null,
        inputs: finalInputs,
      };

      if (isEditMode && editBatch) {
        const res = await apiRequest("PATCH", `/api/production-batches/${editBatch.id}`, payload);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/production-batches", payload);
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production-batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      form.reset();
      setAllocationsMap(new Map());
      onOpenChange(false);
      toast({ title: isEditMode ? "Batch updated" : "Batch record created" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  function onSubmit(data: CreateBatchForm) {
    // Pre-submit validation: check that all non-secondary inputs have sufficient stock
    for (let i = 0; i < data.inputs.length; i++) {
      const inp = data.inputs[i];
      if (!inp.productId) continue;
      const prod = products.find(p => p.id === inp.productId);
      if (prod?.category === "SECONDARY_PACKAGING") continue;
      const allocData = allocationsMap.get(i);
      if (allocData && !allocData.sufficient) {
        toast({
          title: "Insufficient Stock",
          description: `${prod?.name ?? "Material"} does not have enough stock. Available: ${formatQty(allocData.allocations.reduce((s, a) => s + a.quantity, 0))} ${inp.uom}, Needed: ${inp.quantityUsed} ${inp.uom}`,
          variant: "destructive",
        });
        return;
      }
    }
    createMutation.mutate(data);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto" data-testid="sheet-create-batch">
        <SheetHeader>
          <SheetTitle>{isEditMode ? "Edit Batch Record" : "Create Batch Record"}</SheetTitle>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
            {/* Auto-generated Batch Number — read-only display */}
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">Batch Number</Label>
              <div className="flex items-center gap-2 h-9 px-3 rounded-md border bg-muted/50" data-testid="display-batch-number">
                {loadingBatchNum ? (
                  <Skeleton className="h-4 w-24" />
                ) : (
                  <span className="font-mono font-medium text-foreground text-sm">
                    {form.watch("batchNumber") || nextBatchNumber || "—"}
                  </span>
                )}
              </div>
            </div>

            {/* Product (finished good) */}
            <FormField
              control={form.control}
              name="productId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product (Finished Good)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-product">
                        <SelectValue placeholder="Select product..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {finishedGoods.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          No finished goods found. Add a product with category "Finished Good" first.
                        </div>
                      ) : (
                        finishedGoods.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Planned qty + UOM */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="plannedQuantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Planned Output Qty</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="any" placeholder="0" data-testid="input-planned-qty" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="outputUom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Output UOM</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-output-uom">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {["kg", "g", "mg", "L", "mL", "gal", "pcs", "lb", "oz"].map(u => (
                          <SelectItem key={u} value={u}>{u}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Start Date */}
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Date</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" data-testid="input-start-date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Operator */}
            <FormField
              control={form.control}
              name="operatorName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Operator Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Operator name..." data-testid="input-operator" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Additional notes..." rows={2} data-testid="input-notes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Input Materials — New FIFO-based workflow */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">Input Materials</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p className="text-xs">Select a material and enter the quantity needed. The system will auto-assign lots using FIFO (earliest expiration first). You can override the allocation if needed.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ productId: "", quantityUsed: "", uom: "" })}
                  data-testid="button-add-input"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Input
                </Button>
              </div>

              {fields.map((field, index) => {
                const watchedMaterialId = form.watch(`inputs.${index}.productId`);
                const watchedQty = form.watch(`inputs.${index}.quantityUsed`);
                const watchedUom = form.watch(`inputs.${index}.uom`);
                const isSecondaryPackaging = !requiresLot(watchedMaterialId, products);
                const allocData = allocationsMap.get(index);

                return (
                  <Card key={field.id} className="relative">
                    <CardContent className="pt-4 pb-3 px-3 space-y-2">
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 h-6 w-6"
                          onClick={() => {
                            remove(index);
                            setAllocationsMap(prev => {
                              const next = new Map(prev);
                              next.delete(index);
                              // Re-index remaining allocations
                              const reindexed = new Map<number, typeof allocData>();
                              for (const [k, v] of next) {
                                reindexed.set(k > index ? k - 1 : k, v!);
                              }
                              return reindexed as typeof prev;
                            });
                          }}
                          data-testid={`button-remove-input-${index}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}

                      {/* Material select */}
                      <FormField
                        control={form.control}
                        name={`inputs.${index}.productId`}
                        render={({ field: f }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Material</FormLabel>
                            <Select
                              onValueChange={(val) => {
                                f.onChange(val);
                                // Auto-fill UOM from the product's default
                                const prod = products.find(p => p.id === val);
                                if (prod) form.setValue(`inputs.${index}.uom`, prod.defaultUom);
                                // Clear allocation for this index
                                setAllocationsMap(prev => {
                                  const next = new Map(prev);
                                  next.delete(index);
                                  return next;
                                });
                                // Trigger FIFO allocation if qty already set
                                const currentQty = form.getValues(`inputs.${index}.quantityUsed`);
                                if (currentQty && parseFloat(currentQty) > 0) {
                                  fetchFIFOAllocation(index, val, currentQty);
                                }
                              }}
                              value={f.value}
                            >
                              <FormControl>
                                <SelectTrigger data-testid={`select-input-material-${index}`}>
                                  <SelectValue placeholder="Select material..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {materialProducts.map(p => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name} ({p.sku})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-2">
                        {/* Quantity */}
                        <FormField
                          control={form.control}
                          name={`inputs.${index}.quantityUsed`}
                          render={({ field: f }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Qty Needed</FormLabel>
                              <FormControl>
                                <Input
                                  {...f}
                                  type="number"
                                  step="any"
                                  placeholder="0"
                                  data-testid={`input-qty-used-${index}`}
                                  onBlur={(e) => {
                                    f.onBlur();
                                    // Trigger FIFO allocation on blur
                                    if (watchedMaterialId && e.target.value) {
                                      fetchFIFOAllocation(index, watchedMaterialId, e.target.value);
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      if (watchedMaterialId && f.value) {
                                        fetchFIFOAllocation(index, watchedMaterialId, f.value);
                                      }
                                    }
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* UOM */}
                        <FormField
                          control={form.control}
                          name={`inputs.${index}.uom`}
                          render={({ field: f }) => (
                            <FormItem>
                              <FormLabel className="text-xs">UOM</FormLabel>
                              <Select onValueChange={f.onChange} value={f.value}>
                                <FormControl>
                                  <SelectTrigger data-testid={`select-input-uom-${index}`}>
                                    <SelectValue placeholder="UOM" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {["kg", "g", "mg", "L", "mL", "gal", "pcs", "lb", "oz"].map(u => (
                                    <SelectItem key={u} value={u}>{u}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* FIFO Allocation Breakdown — shown for non-secondary-packaging materials */}
                      {!isSecondaryPackaging && allocData && (
                        <AllocationBreakdown
                          allocations={allocData.allocations}
                          requested={allocData.requested}
                          sufficient={allocData.sufficient}
                          uom={watchedUom}
                          onOverride={(overridden) => {
                            setAllocationsMap(prev => {
                              const next = new Map(prev);
                              const totalAlloc = overridden.reduce((s, a) => s + a.quantity, 0);
                              next.set(index, {
                                allocations: overridden,
                                sufficient: totalAlloc >= allocData.requested,
                                requested: allocData.requested,
                              });
                              return next;
                            });
                          }}
                        />
                      )}

                      {isSecondaryPackaging && (
                        <p className="text-[10px] text-muted-foreground">Secondary packaging — no lot tracking required</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={createMutation.isPending}
              data-testid="button-submit-batch"
            >
              {createMutation.isPending
                ? (isEditMode ? "Saving..." : "Creating...")
                : (isEditMode ? "Save Changes" : "Create Batch Record")}
            </Button>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

// ── Batch Notes ──

interface ProductionNote {
  id: string;
  batchId: string;
  content: string;
  author: string | null;
  createdAt: string;
}

function BatchNotes({ batchId }: { batchId: string }) {
  const [content, setContent] = useState("");
  const [author, setAuthor] = useState("");
  const { toast } = useToast();

  const { data: notes = [], isLoading } = useQuery<ProductionNote[]>({
    queryKey: ["/api/production-batches", batchId, "notes"],
    enabled: !!batchId,
  });

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/production-batches/${batchId}/notes`, {
        content,
        author: author || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production-batches", batchId, "notes"] });
      setContent("");
      toast({ title: "Note added" });
    },
    onError: () => {
      toast({ title: "Failed to add note", variant: "destructive" });
    },
  });

  function formatTimestamp(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
      " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  return (
    <div data-testid="section-batch-notes">
      <Separator className="my-4" />
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <MessageSquare className="h-4 w-4" />
        Notes
      </h3>

      {/* Notes list */}
      <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : notes.length === 0 ? (
          <p className="text-sm text-muted-foreground italic" data-testid="text-no-notes">No notes yet</p>
        ) : (
          notes.map(note => (
            <div key={note.id} className="border rounded-md p-3 text-sm" data-testid={`note-${note.id}`}>
              <p className="whitespace-pre-wrap" data-testid="note-content">{note.content}</p>
              <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                <span data-testid="note-author">{note.author || "—"}</span>
                <span>·</span>
                <span data-testid="note-timestamp">{formatTimestamp(note.createdAt)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add note form */}
      <div className="space-y-2">
        <Textarea
          placeholder="Add a note..."
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={2}
          data-testid="input-note-content"
        />
        <div className="flex items-center gap-2">
          <Input
            placeholder="Author (optional)"
            value={author}
            onChange={e => setAuthor(e.target.value)}
            className="flex-1"
            data-testid="input-note-author"
          />
          <Button
            size="sm"
            onClick={() => addNoteMutation.mutate()}
            disabled={!content.trim() || addNoteMutation.isPending}
            data-testid="button-add-note"
          >
            <Send className="h-3.5 w-3.5 mr-1.5" />
            {addNoteMutation.isPending ? "Adding..." : "Add Note"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Complete Batch Dialog ──

function CompleteBatchDialog({
  open,
  onOpenChange,
  batch,
  locations,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  batch: ProductionBatchWithDetails | null;
  locations: Location[];
}) {
  const { toast } = useToast();

  const [actualQuantity, setActualQuantity] = useState("");
  const [outputLotNumber, setOutputLotNumber] = useState("");
  const [outputExpirationDate, setOutputExpirationDate] = useState("");
  const [outputLocationId, setOutputLocationId] = useState("");
  const [qcStatus, setQcStatus] = useState("PASS");
  const [qcNotes, setQcNotes] = useState("");
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));

  // Fetch next auto-generated lot number when dialog opens
  const { data: nextLotData } = useQuery<{ lotNumber: string }>({
    queryKey: ["/api/production-batches/next-lot-number"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/production-batches/next-lot-number");
      return res.json();
    },
    enabled: open,
  });

  // Pre-fill with planned qty and next lot number when batch changes
  useMemo(() => {
    if (batch) {
      setActualQuantity(batch.plannedQuantity ?? "");
      setOutputLotNumber(nextLotData?.lotNumber ?? "");
      setOutputExpirationDate("");
      setOutputLocationId("");
      setQcStatus("PASS");
      setQcNotes("");
      setEndDate(new Date().toISOString().slice(0, 10));
    }
  }, [batch?.id, nextLotData?.lotNumber]);

  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!batch) throw new Error("No batch");
      try {
        const res = await apiRequest("POST", `/api/production-batches/${batch.id}/complete`, {
          actualQuantity,
          outputLotNumber,
          outputExpirationDate: outputExpirationDate || null,
          locationId: outputLocationId,
          qcStatus,
          qcNotes: qcNotes || null,
          endDate: endDate || undefined,
        });
        return res.json();
      } catch (err: unknown) {
        // apiRequest throws with "status: body" format; extract the message from JSON body
        const errMsg = err instanceof Error ? err.message : String(err);
        const jsonStart = errMsg.indexOf("{");
        if (jsonStart >= 0) {
          try {
            const parsed = JSON.parse(errMsg.slice(jsonStart));
            throw new Error(parsed.message || errMsg);
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== errMsg) throw parseErr;
          }
        }
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production-batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/production-batches/next-lot-number"] });
      onOpenChange(false);
      toast({ title: "Batch completed successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Insufficient Stock", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-complete-batch">
        <DialogHeader>
          <DialogTitle>Complete Batch {batch?.batchNumber}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="actual-qty">Actual Output Quantity</Label>
            <Input
              id="actual-qty"
              type="number"
              step="any"
              value={actualQuantity}
              onChange={e => setActualQuantity(e.target.value)}
              data-testid="input-actual-qty"
            />
          </div>
          <div>
            <Label htmlFor="output-lot">Output Lot Number</Label>
            <Input
              id="output-lot"
              value={outputLotNumber}
              onChange={e => setOutputLotNumber(e.target.value)}
              placeholder="e.g., FG-001"
              data-testid="input-output-lot"
            />
          </div>
          <div>
            <Label htmlFor="output-exp">Output Expiration Date</Label>
            <Input
              id="output-exp"
              type="date"
              value={outputExpirationDate}
              onChange={e => setOutputExpirationDate(e.target.value)}
              data-testid="input-output-expiration"
            />
          </div>
          <div>
            <Label htmlFor="output-location">Output Location</Label>
            <Select onValueChange={setOutputLocationId} value={outputLocationId}>
              <SelectTrigger data-testid="select-output-location">
                <SelectValue placeholder="Select location..." />
              </SelectTrigger>
              <SelectContent>
                {locations.map(loc => (
                  <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="qc-status">QC Status</Label>
            <Select onValueChange={setQcStatus} value={qcStatus}>
              <SelectTrigger data-testid="select-qc-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PASS">Pass</SelectItem>
                <SelectItem value="FAIL">Fail</SelectItem>
                <SelectItem value="ON_HOLD">On Hold</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="qc-notes">QC Notes (optional)</Label>
            <Textarea
              id="qc-notes"
              value={qcNotes}
              onChange={e => setQcNotes(e.target.value)}
              rows={2}
              placeholder="QC observations..."
              data-testid="input-qc-notes"
            />
          </div>
          <div>
            <Label htmlFor="end-date">Completion Date</Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              data-testid="input-end-date"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-complete">Cancel</Button>
          <Button
            onClick={() => completeMutation.mutate()}
            disabled={completeMutation.isPending || !actualQuantity || !outputLotNumber || !outputLocationId}
            data-testid="button-confirm-complete"
          >
            {completeMutation.isPending ? "Completing..." : "Complete Batch"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Confirm Dialog (for delete/scrap) ──

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  isPending,
  variant = "destructive",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  isPending: boolean;
  variant?: "destructive" | "default";
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" data-testid="dialog-confirm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-confirm">Cancel</Button>
          <Button
            variant={variant}
            onClick={onConfirm}
            disabled={isPending}
            data-testid="button-confirm-action"
          >
            {isPending ? "Processing..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── BPR Link ──

function BprLink({ batchId, batchStatus }: { batchId: string; batchStatus: string }) {
  const showBpr = ["IN_PROGRESS", "ON_HOLD", "COMPLETED", "SCRAPPED"].includes(batchStatus);

  const { data: bprData, isLoading: bprLoading } = useQuery<{ id: string } | null>({
    queryKey: ["/api/batch-production-records/by-batch", batchId],
    enabled: showBpr,
  });

  if (!showBpr) return null;

  if (bprLoading) {
    return (
      <Button variant="outline" size="sm" disabled className="opacity-50">
        <ClipboardCheck className="h-3.5 w-3.5 mr-1.5" />
        Loading BPR...
      </Button>
    );
  }

  if (!bprData || !bprData.id) return null;

  return (
    <Link href={`/bpr/${bprData.id}`}>
      <Button variant="outline" size="sm" data-testid="button-view-bpr">
        <ClipboardCheck className="h-3.5 w-3.5 mr-1.5" />
        View Batch Record
      </Button>
    </Link>
  );
}

// ── Detail Panel ──

function BatchDetail({
  batch,
  onStartProduction,
  onCompleteBatch,
  onPutOnHold,
  onResume,
  onEdit,
  onDelete,
  onScrap,
  isUpdating,
}: {
  batch: ProductionBatchWithDetails;
  onStartProduction: () => void;
  onCompleteBatch: () => void;
  onPutOnHold: () => void;
  onResume: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onScrap: () => void;
  isUpdating: boolean;
}) {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold" data-testid="text-detail-batch-number">{batch.batchNumber}</h2>
            {statusBadge(batch.status)}
          </div>
          <p className="text-sm text-muted-foreground mt-1" data-testid="text-detail-product">{batch.productName} ({batch.productSku})</p>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
        <div>
          <span className="text-muted-foreground">Planned Quantity</span>
          <p className="font-medium" data-testid="text-detail-planned-qty">{formatQty(batch.plannedQuantity)} {batch.outputUom}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Actual Quantity</span>
          <p className="font-medium" data-testid="text-detail-actual-qty">
            {batch.actualQuantity ? `${formatQty(batch.actualQuantity)} ${batch.outputUom}` : "—"}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground">Start Date</span>
          <p className="font-medium">{batch.startDate ?? "—"}</p>
        </div>
        <div>
          <span className="text-muted-foreground">End Date</span>
          <p className="font-medium">{batch.endDate ?? "—"}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Operator</span>
          <p className="font-medium">{batch.operatorName ?? "—"}</p>
        </div>
        <div>
          <span className="text-muted-foreground">QC Status</span>
          <div className="mt-0.5">{qcStatusBadge(batch.qcStatus)}</div>
        </div>
        {batch.qcNotes && (
          <div className="col-span-2">
            <span className="text-muted-foreground">QC Notes</span>
            <p className="font-medium">{batch.qcNotes}</p>
          </div>
        )}
        {batch.notes && (
          <div className="col-span-2">
            <span className="text-muted-foreground">Notes</span>
            <p className="font-medium">{batch.notes}</p>
          </div>
        )}
        {batch.outputLotNumber && (
          <>
            <div>
              <span className="text-muted-foreground">Output Lot #</span>
              <p className="font-medium" data-testid="text-detail-output-lot">{batch.outputLotNumber}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Output Expiration</span>
              <p className="font-medium">{batch.outputExpirationDate ?? "—"}</p>
            </div>
          </>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        {batch.status === "DRAFT" && (
          <>
            <Button
              onClick={onEdit}
              disabled={isUpdating}
              variant="outline"
              size="sm"
              data-testid="button-edit-batch"
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Edit
            </Button>
            <Button
              onClick={onStartProduction}
              disabled={isUpdating}
              size="sm"
              data-testid="button-start-production"
            >
              <Play className="h-3.5 w-3.5 mr-1.5" />
              Start Production
            </Button>
            <Button
              onClick={onDelete}
              disabled={isUpdating}
              variant="destructive"
              size="sm"
              data-testid="button-delete-batch"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Delete
            </Button>
          </>
        )}
        {batch.status === "IN_PROGRESS" && (
          <>
            <Button
              onClick={onCompleteBatch}
              disabled={isUpdating}
              size="sm"
              data-testid="button-complete-batch"
            >
              <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
              Complete Batch
            </Button>
            <Button
              onClick={onPutOnHold}
              disabled={isUpdating}
              variant="outline"
              size="sm"
              data-testid="button-put-on-hold"
            >
              <Pause className="h-3.5 w-3.5 mr-1.5" />
              Put On Hold
            </Button>
            <Button
              onClick={onScrap}
              disabled={isUpdating}
              variant="destructive"
              size="sm"
              data-testid="button-scrap-batch"
            >
              <XCircle className="h-3.5 w-3.5 mr-1.5" />
              Scrap
            </Button>
          </>
        )}
        {batch.status === "ON_HOLD" && (
          <>
            <Button
              onClick={onResume}
              disabled={isUpdating}
              size="sm"
              data-testid="button-resume"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Resume
            </Button>
            <Button
              onClick={onScrap}
              disabled={isUpdating}
              variant="destructive"
              size="sm"
              data-testid="button-scrap-batch"
            >
              <XCircle className="h-3.5 w-3.5 mr-1.5" />
              Scrap
            </Button>
          </>
        )}
        {batch.status === "COMPLETED" && (
          <Button
            onClick={onDelete}
            disabled={isUpdating}
            variant="destructive"
            size="sm"
            data-testid="button-delete-completed-batch"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Delete Batch
          </Button>
        )}
        <BprLink batchId={batch.id} batchStatus={batch.status} />
        <Button
          variant="outline"
          size="sm"
          onClick={() => { window.location.hash = `#/production/print/${batch.id}`; }}
          data-testid="button-print-batch"
        >
          <Printer className="h-3.5 w-3.5 mr-1.5" />
          Print
        </Button>
      </div>

      {/* Input materials table */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Input Materials</h3>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>LOT #</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Qty Used</TableHead>
                <TableHead>UOM</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batch.inputs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No input materials
                  </TableCell>
                </TableRow>
              ) : (
                batch.inputs.map(input => (
                  <TableRow key={input.id} data-testid={`row-input-${input.id}`}>
                    <TableCell className="text-sm">{input.productName}</TableCell>
                    <TableCell className="text-sm font-mono">{input.lotNumber}</TableCell>
                    <TableCell className="text-sm">{input.locationName}</TableCell>
                    <TableCell className="text-right text-sm">{formatQty(input.quantityUsed)}</TableCell>
                    <TableCell className="text-sm">{input.uom}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Notes section */}
      <BatchNotes batchId={batch.id} />
    </div>
  );
}

// ── Main Production Page ──

export default function Production() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [editBatch, setEditBatch] = useState<ProductionBatchWithDetails | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scrapDialogOpen, setScrapDialogOpen] = useState(false);

  const { toast } = useToast();

  const { data: batches, isLoading } = useQuery<ProductionBatchWithDetails[]>({
    queryKey: ["/api/production-batches"],
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: inventory } = useQuery<InventoryGrouped[]>({
    queryKey: ["/api/inventory"],
  });

  const { data: locations } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
  });

  const selectedBatch = useMemo(() => {
    if (!selectedId || !batches) return null;
    return batches.find(b => b.id === selectedId) ?? null;
  }, [selectedId, batches]);

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/production-batches/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production-batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/production-batches/${id}`);
      if (!res.ok && res.status !== 204) {
        const data = await res.json();
        throw new Error(data.message || "Failed to delete batch");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production-batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setSelectedId(null);
      setDeleteDialogOpen(false);
      toast({ title: "Batch deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  function handleStartProduction() {
    if (!selectedBatch) return;
    updateMutation.mutate({ id: selectedBatch.id, data: { status: "IN_PROGRESS" } });
    toast({ title: "Production started" });
  }

  function handlePutOnHold() {
    if (!selectedBatch) return;
    updateMutation.mutate({ id: selectedBatch.id, data: { status: "ON_HOLD" } });
    toast({ title: "Batch put on hold" });
  }

  function handleResume() {
    if (!selectedBatch) return;
    updateMutation.mutate({ id: selectedBatch.id, data: { status: "IN_PROGRESS" } });
    toast({ title: "Production resumed" });
  }

  function handleEdit() {
    if (!selectedBatch) return;
    setEditBatch(selectedBatch);
    setSheetOpen(true);
  }

  function handleDelete() {
    setDeleteDialogOpen(true);
  }

  function handleScrap() {
    setScrapDialogOpen(true);
  }

  function confirmDelete() {
    if (!selectedBatch) return;
    deleteMutation.mutate(selectedBatch.id);
  }

  function confirmScrap() {
    if (!selectedBatch) return;
    updateMutation.mutate(
      { id: selectedBatch.id, data: { status: "SCRAPPED" } },
      {
        onSuccess: () => {
          setScrapDialogOpen(false);
          toast({ title: "Batch scrapped" });
        },
      }
    );
  }

  function handleSheetOpenChange(open: boolean) {
    setSheetOpen(open);
    if (!open) {
      setEditBatch(null);
    }
  }

  // Delete dialog description changes based on batch status
  const deleteDescription = selectedBatch?.status === "COMPLETED"
    ? `Are you sure you want to delete completed batch ${selectedBatch?.batchNumber}? This will reverse all transaction logs (consumption and output) created when the batch was completed. Inventory levels will be restored to their pre-completion state.`
    : `Are you sure you want to delete batch ${selectedBatch?.batchNumber}? This action cannot be undone.`;

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-full">
        <div className="w-96 border-r">
          <div className="p-4 border-b">
            <Skeleton className="h-8 w-full" />
          </div>
          {[1, 2, 3].map(i => (
            <div key={i} className="p-4 border-b">
              <Skeleton className="h-5 w-32 mb-2" />
              <Skeleton className="h-4 w-48" />
            </div>
          ))}
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-6 w-48 mb-4" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full" data-testid="page-production">
        {/* Left panel: batch list */}
        <div className="w-96 shrink-0 border-r border-border flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Beaker className="h-4 w-4 text-muted-foreground" />
              <h1 className="text-sm font-semibold" data-testid="text-page-title">Production</h1>
              {batches && (
                <Badge variant="secondary" className="text-xs">{batches.length}</Badge>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditBatch(null);
                setSheetOpen(true);
              }}
              data-testid="button-new-batch"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              New Batch
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {batches && batches.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No batch records yet. Create your first batch.
              </div>
            ) : (
              batches?.map(b => (
                <BatchListItem
                  key={b.id}
                  batch={b}
                  isSelected={selectedId === b.id}
                  onClick={() => setSelectedId(b.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right panel: detail */}
        <div className="flex-1 overflow-y-auto">
          {selectedBatch ? (
            <BatchDetail
              batch={selectedBatch}
              onStartProduction={handleStartProduction}
              onCompleteBatch={() => setCompleteDialogOpen(true)}
              onPutOnHold={handlePutOnHold}
              onResume={handleResume}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onScrap={handleScrap}
              isUpdating={updateMutation.isPending}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Select a batch record to view details
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit batch sheet */}
      <CreateBatchSheet
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
        products={products ?? []}
        inventory={inventory ?? []}
        locations={locations ?? []}
        editBatch={editBatch}
      />

      {/* Complete batch dialog */}
      <CompleteBatchDialog
        open={completeDialogOpen}
        onOpenChange={setCompleteDialogOpen}
        batch={selectedBatch}
        locations={locations ?? []}
      />

      {/* Delete confirm dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={selectedBatch?.status === "COMPLETED" ? "Delete Completed Batch" : "Delete Batch"}
        description={deleteDescription}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        isPending={deleteMutation.isPending}
        variant="destructive"
      />

      {/* Scrap confirm dialog */}
      <ConfirmDialog
        open={scrapDialogOpen}
        onOpenChange={setScrapDialogOpen}
        title="Scrap Batch"
        description={`Are you sure you want to scrap batch ${selectedBatch?.batchNumber}? This will mark it as scrapped and it cannot be resumed.`}
        confirmLabel="Scrap"
        onConfirm={confirmScrap}
        isPending={updateMutation.isPending}
        variant="destructive"
      />
    </>
  );
}
