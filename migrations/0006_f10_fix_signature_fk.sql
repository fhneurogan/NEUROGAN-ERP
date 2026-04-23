-- F-10: Change signature_id FK on erp_validation_documents to ON DELETE SET NULL.
--
-- The original migration created the FK without a delete rule (defaulting to
-- RESTRICT). This causes test teardown to fail: cleanDb() deletes all rows from
-- erp_electronic_signatures, but validation documents that were signed during
-- tests still hold FK references, triggering a constraint violation.
--
-- ON DELETE SET NULL is the correct semantic: if a signature row is ever removed
-- (test cleanup, or a future admin operation), the validation document loses its
-- signatureId link but continues to exist. In production the erp_app role has
-- REVOKE DELETE on erp_electronic_signatures, so this cascade only fires during
-- test teardown (which runs as the superuser).

ALTER TABLE erp_validation_documents
  DROP CONSTRAINT erp_validation_documents_signature_id_fkey,
  ADD CONSTRAINT erp_validation_documents_signature_id_fkey
    FOREIGN KEY (signature_id)
    REFERENCES erp_electronic_signatures(id)
    ON DELETE SET NULL;
