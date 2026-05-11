import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function readRepoFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("issue #14 medium and low regression contracts", () => {
  it("guards non-finance admin routes with the operator role gate", () => {
    const operatorOnlyRoutes = [
      "app/admin/residents/page.tsx",
      "app/admin/kavlings/page.tsx",
      "app/admin/imports/page.tsx",
      "app/admin/telegram/page.tsx",
    ];

    for (const routePath of operatorOnlyRoutes) {
      const source = readRepoFile(routePath);

      expect(source).toContain('import { RequireOperatorRole } from "@/features/auth/RequireOperatorRole";');
      expect(source).toContain("<RequireOperatorRole>");
    }
  });

  it("keeps the operator access denial copy spaced correctly", () => {
    const source = readRepoFile("features/auth/RequireOperatorRole.tsx");

    expect(source).toContain("Akses operator diperlukan");
    expect(source).not.toContain("Aksesoperator diperlukan");
  });

  it("uses preference-aware Telegram monthly summary recipients and outstanding balances", () => {
    const source = readRepoFile("supabase/functions/run-monthly-summary/index.ts");

    expect(source).toContain('.rpc("get_linked_telegram_recipients"');
    expect(source).toContain('p_template_code: "admin_monthly_summary"');
    expect(source).not.toContain('.from("telegram_accounts")');
    expect(source).toContain("amount_due, amount_paid");
    expect(source).toContain("(row.amount_due ?? 0) - (row.amount_paid ?? 0)");
  });

  it("resolves receipt resident names from the payment submitter before deterministic occupancy fallback", () => {
    const source = readRepoFile("supabase/functions/_shared/report-output.ts");

    expect(source).toContain("payment_submission_id");
    expect(source).toContain('.from("payment_submissions")');
    expect(source).toContain("submitted_by, profiles!inner(full_name, display_name)");
    expect(source.indexOf("await loadSubmitterName(paymentRow.payment_submission_id)"))
      .toBeLessThan(source.indexOf("await loadOccupantNameAtPaymentTime()"));
    expect(source).toContain('.lte("started_at", paidDate)');
    expect(source).toContain("ended_at.is.null,ended_at.gte.${paidDate}");
    expect(source).toContain('.order("is_primary", { ascending: false })');
    expect(source).toContain('.order("started_at", { ascending: false })');
    expect(source).toContain('.order("profile_id", { ascending: true })');
  });

  it("removes uploaded payment proof objects when cancelling a failed attach flow", () => {
    const edgeSource = readRepoFile("supabase/functions/cancel-payment-submission/index.ts");
    const formSource = readRepoFile("features/payments/PaymentSubmissionForm.tsx");

    expect(edgeSource).toContain("proofPath?: string");
    expect(edgeSource).toContain('.from("payment-proofs")');
    expect(edgeSource).toContain(".remove([proofPath])");
    expect(edgeSource).toContain("isExpectedProofPath(proofPath, row)");
    expect(edgeSource.indexOf(".remove([proofPath])"))
      .toBeLessThan(edgeSource.indexOf('.from("payment_submissions").update'));
    expect(edgeSource.indexOf(".remove([proofPath])"))
      .toBeLessThan(edgeSource.indexOf('.from("payment_submissions")\n      .delete()'));
    expect(formSource).toContain("let proofPath: string | null = null");
    expect(formSource).toContain("proofPath,");
    expect(formSource).toContain('"cancel-payment-submission"');
  });

  it("checks in CI all local verification gates required for launch readiness", () => {
    const workflow = readRepoFile(".github/workflows/ci.yml");

    expect(workflow).toContain("npm ci");
    expect(workflow).toContain("npm run lint");
    expect(workflow).toContain("npm run typecheck");
    expect(workflow).toContain("npm run test:unit");
    expect(workflow).toContain("npm run supabase:start");
    expect(workflow).toContain("npm run test:sql");
    expect(workflow).toContain("npm run build");
    expect(workflow).toContain("git diff --check");
  });
});
