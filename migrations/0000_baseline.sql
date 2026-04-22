CREATE TYPE "public"."category" AS ENUM('ACTIVE_INGREDIENT', 'SUPPORTING_INGREDIENT', 'PRIMARY_PACKAGING', 'SECONDARY_PACKAGING', 'FINISHED_GOOD');--> statement-breakpoint
CREATE TYPE "public"."po_status" AS ENUM('DRAFT', 'SUBMITTED', 'PARTIALLY_RECEIVED', 'CLOSED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('ACTIVE', 'DISCONTINUED');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('PO_RECEIPT', 'PRODUCTION_CONSUMPTION', 'PRODUCTION_OUTPUT', 'COUNT_ADJUSTMENT');--> statement-breakpoint
CREATE TYPE "public"."uom" AS ENUM('g', 'mg', 'L', 'mL', 'gal', 'pcs', 'lb', 'oz');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'OPERATOR');--> statement-breakpoint
CREATE TABLE "erp_app_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" text DEFAULT 'Neurogan' NOT NULL,
	"default_uom" text DEFAULT 'g' NOT NULL,
	"low_stock_threshold" numeric DEFAULT '1' NOT NULL,
	"date_format" text DEFAULT 'MM/DD/YYYY' NOT NULL,
	"auto_generate_batch_numbers" text DEFAULT 'true' NOT NULL,
	"batch_number_prefix" text DEFAULT 'BATCH' NOT NULL,
	"auto_generate_lot_numbers" text DEFAULT 'true' NOT NULL,
	"lot_number_prefix" text DEFAULT 'LOT' NOT NULL,
	"fg_lot_number_prefix" text DEFAULT 'FG' NOT NULL,
	"sku_prefix_raw_material" text DEFAULT 'RA' NOT NULL,
	"sku_prefix_finished_good" text DEFAULT 'US' NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "erp_batch_production_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"production_batch_id" varchar NOT NULL,
	"batch_number" text NOT NULL,
	"lot_number" text,
	"product_id" varchar NOT NULL,
	"recipe_id" varchar,
	"status" text DEFAULT 'IN_PROGRESS' NOT NULL,
	"theoretical_yield" numeric,
	"actual_yield" numeric,
	"yield_percentage" numeric,
	"yield_min_threshold" numeric,
	"yield_max_threshold" numeric,
	"yield_deviation" text,
	"processing_lines" text,
	"cleaning_verified" text,
	"cleaning_verified_by" text,
	"cleaning_verified_at" timestamp,
	"cleaning_record_reference" text,
	"qc_reviewed_by" text,
	"qc_reviewed_at" timestamp,
	"qc_disposition" text,
	"qc_notes" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "erp_bpr_deviations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bpr_id" varchar NOT NULL,
	"bpr_step_id" varchar,
	"deviation_description" text NOT NULL,
	"investigation" text,
	"impact_evaluation" text,
	"corrective_actions" text,
	"preventive_actions" text,
	"disposition" text,
	"scientific_rationale" text,
	"reported_by" text,
	"reported_at" timestamp,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"signature_of_reviewer" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "erp_bpr_steps" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bpr_id" varchar NOT NULL,
	"step_number" numeric NOT NULL,
	"step_description" text NOT NULL,
	"performed_by" text,
	"performed_at" timestamp,
	"verified_by" text,
	"verified_at" timestamp,
	"component_id" varchar,
	"component_lot_id" varchar,
	"target_weight_measure" numeric,
	"actual_weight_measure" numeric,
	"uom" text,
	"weighed_by" text,
	"weight_verified_by" text,
	"added_by" text,
	"addition_verified_by" text,
	"monitoring_results" text,
	"test_results" text,
	"test_reference" text,
	"notes" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "erp_coa_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lot_id" varchar NOT NULL,
	"receiving_record_id" varchar,
	"production_batch_id" varchar,
	"source_type" text DEFAULT 'SUPPLIER' NOT NULL,
	"lab_name" text,
	"analyst_name" text,
	"analysis_date" text,
	"file_name" text,
	"file_data" text,
	"document_number" text,
	"tests_performed" text,
	"overall_result" text,
	"identity_test_performed" text,
	"identity_test_method" text,
	"identity_confirmed" text,
	"qc_reviewed_by" text,
	"qc_reviewed_at" timestamp,
	"qc_accepted" text,
	"qc_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "erp_locations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	CONSTRAINT "erp_locations_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "erp_lots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" varchar NOT NULL,
	"lot_number" text NOT NULL,
	"supplier_name" text,
	"received_date" text,
	"expiration_date" text,
	"supplier_coa_url" text,
	"neurogan_coa_url" text,
	"purchase_price" numeric,
	"purchase_uom" text,
	"po_reference" text,
	"notes" text,
	"quarantine_status" text DEFAULT 'APPROVED',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "erp_po_line_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"quantity_ordered" numeric NOT NULL,
	"quantity_received" numeric DEFAULT '0' NOT NULL,
	"unit_price" numeric,
	"uom" text NOT NULL,
	"lot_number" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "erp_product_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "erp_product_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "erp_product_category_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" varchar NOT NULL,
	"category_id" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erp_production_batches" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_number" text NOT NULL,
	"product_id" varchar NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"planned_quantity" numeric NOT NULL,
	"actual_quantity" numeric,
	"output_uom" text DEFAULT 'pcs' NOT NULL,
	"output_lot_number" text,
	"output_expiration_date" text,
	"start_date" text,
	"end_date" text,
	"qc_status" text DEFAULT 'PENDING',
	"qc_notes" text,
	"qc_disposition" text,
	"qc_reviewed_by" text,
	"yield_percentage" numeric,
	"operator_name" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "erp_production_batches_batch_number_unique" UNIQUE("batch_number")
);
--> statement-breakpoint
CREATE TABLE "erp_production_inputs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"lot_id" varchar NOT NULL,
	"location_id" varchar NOT NULL,
	"quantity_used" numeric NOT NULL,
	"uom" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erp_production_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" varchar NOT NULL,
	"content" text NOT NULL,
	"author" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "erp_products" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"sku" text NOT NULL,
	"category" text DEFAULT 'ACTIVE_INGREDIENT' NOT NULL,
	"default_uom" text DEFAULT 'g' NOT NULL,
	"description" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"low_stock_threshold" numeric,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "erp_products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "erp_purchase_orders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"po_number" text NOT NULL,
	"supplier_id" varchar NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"order_date" text,
	"expected_delivery_date" text,
	"notes" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "erp_purchase_orders_po_number_unique" UNIQUE("po_number")
);
--> statement-breakpoint
CREATE TABLE "erp_receiving_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" varchar,
	"lot_id" varchar NOT NULL,
	"supplier_id" varchar,
	"unique_identifier" text NOT NULL,
	"date_received" text,
	"quantity_received" numeric,
	"uom" text,
	"supplier_lot_number" text,
	"container_condition_ok" text,
	"seals_intact" text,
	"labels_match" text,
	"invoice_matches_po" text,
	"visual_exam_notes" text,
	"visual_exam_by" text,
	"visual_exam_at" timestamp,
	"status" text DEFAULT 'QUARANTINED' NOT NULL,
	"qc_reviewed_by" text,
	"qc_reviewed_at" timestamp,
	"qc_disposition" text,
	"qc_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "erp_recipe_lines" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"quantity" numeric NOT NULL,
	"uom" text NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "erp_recipes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" varchar NOT NULL,
	"name" text NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "erp_supplier_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" varchar NOT NULL,
	"file_name" text NOT NULL,
	"file_type" text,
	"file_size" numeric,
	"file_data" text,
	"uploaded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "erp_supplier_qualifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" varchar NOT NULL,
	"qualification_date" text,
	"qualification_method" text,
	"qualified_by" text,
	"approved_by" text,
	"last_requalification_date" text,
	"next_requalification_due" text,
	"requalification_frequency" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "erp_suppliers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"contact_email" text,
	"contact_phone" text,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "erp_transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lot_id" varchar NOT NULL,
	"location_id" varchar NOT NULL,
	"type" text NOT NULL,
	"quantity" numeric NOT NULL,
	"uom" text NOT NULL,
	"production_batch_id" text,
	"notes" text,
	"performed_by" text,
	"created_at" timestamp DEFAULT now()
);
