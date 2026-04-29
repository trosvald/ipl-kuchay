# Milestone 3 - Kavling And Resident Management

Source sections:

- Master plan sections 8.2, 10.2, 13.7, 13.8, 20, 22 Milestone 3.

Goal:

- Admin can manage kavlings, residents, and resident-to-kavling mappings.

Scope:

- Admin lists/forms.
- Resident `/app` home with linked kavlings.
- Audit logs for sensitive changes.

Files to create/change:

- `features/kavlings/KavlingListPage.tsx`
- `features/kavlings/KavlingForm.tsx`
- `features/residents/ResidentListPage.tsx`
- `features/residents/ResidentForm.tsx`
- `features/residents/KavlingResidentMapping.tsx`
- `features/resident/ResidentHomePage.tsx`
- `features/audit/auditTypes.ts`
- `lib/validation.ts`
- App Router route files under `app/admin/*` and `app/app/*` as needed.
- Edge Function/RPC files if admin mutations are server-mediated.

Data contracts:

- Kavling editable fields: `code`, `block`, `sort_order`, `active`, `notes`.
- Resident editable admin fields: `full_name`, `display_name`, `phone`, `email`, `role`, `is_active`.
- Mapping fields: `kavling_id`, `profile_id`, `relation`, `is_primary`, `active`.
- Only one active primary resident per kavling.

Mutation rules:

- Do not hard-delete kavlings with invoices; set `active = false`.
- Role `super_admin` can be assigned or removed only by existing `super_admin`.
- All create/update/deactivate/link/unlink operations must write `audit_logs`.
- Resident queries must be filtered by RLS, not only UI filtering.

Tasks:

1. Build `/admin/kavlings` list/create/edit/deactivate.
2. Build `/admin/residents` list/create/edit/deactivate.
3. Add resident-kavling mapping UI.
4. Enforce super-admin-only `super_admin` assignment.
5. Write audit logs for CRUD and mapping changes.
6. Build resident home showing linked kavlings.

Acceptance:

- Admin links resident to `Kav 1`.
- Resident sees only linked kavling(s).
- Resident cannot query neighbor mappings.
- Inactive kavlings do not appear for new billing generation.
- Audit log records admin actions.
- Attempting second active primary resident for one kavling fails or forces explicit replacement.

Out of scope:

- Do not generate invoices yet.
- Do not implement imports yet.

Verification:

```bash
npm run typecheck
npm run test
npm run build
```

Manual:

- Test resident cannot access neighbor mapping through UI and direct Supabase query.
