-- 0013: Remove placeholder seed users and stale test users.
--
-- Keeps only the three real accounts seeded at launch:
--   Frederik (008), Steven (009), Carrie (002).
-- All other seed-bootstrap accounts (admin, prod, prod2, recv, viewer,
-- disabled) are deleted, along with any leaked integration-test users.

DO $$
DECLARE
  placeholder_ids uuid[] := ARRAY[
    '00000000-0000-0001-0000-000000000001'::uuid,  -- Admin Seed
    '00000000-0000-0001-0000-000000000003'::uuid,  -- Production Lead
    '00000000-0000-0001-0000-000000000004'::uuid,  -- Production Op 2
    '00000000-0000-0001-0000-000000000005'::uuid,  -- Warehouse Clerk
    '00000000-0000-0001-0000-000000000006'::uuid,  -- Read-Only Viewer
    '00000000-0000-0001-0000-000000000007'::uuid   -- Disabled User
  ];
  frederik_id uuid := '00000000-0000-0001-0000-000000000008';
BEGIN
  -- Re-attribute any role grants that reference a placeholder user
  UPDATE erp_user_roles
    SET granted_by_user_id = frederik_id
    WHERE granted_by_user_id = ANY(placeholder_ids);

  -- Delete FK-dependent rows before removing the users themselves
  DELETE FROM erp_audit_trail         WHERE user_id = ANY(placeholder_ids);
  DELETE FROM erp_electronic_signatures WHERE user_id = ANY(placeholder_ids);
  DELETE FROM erp_approved_materials  WHERE approved_by_user_id = ANY(placeholder_ids);
  DELETE FROM erp_user_roles          WHERE user_id = ANY(placeholder_ids);
  -- erp_password_history cascades on delete, no explicit step needed

  DELETE FROM erp_users WHERE id = ANY(placeholder_ids);

  -- Clean up stale integration-test users (e.g. viewer@f06.test, qa@f06.test)
  DELETE FROM erp_audit_trail
    WHERE user_id IN (SELECT id FROM erp_users WHERE email LIKE '%@%.test');
  DELETE FROM erp_electronic_signatures
    WHERE user_id IN (SELECT id FROM erp_users WHERE email LIKE '%@%.test');
  DELETE FROM erp_user_roles
    WHERE user_id IN (SELECT id FROM erp_users WHERE email LIKE '%@%.test');
  DELETE FROM erp_users WHERE email LIKE '%@%.test';
END $$;
