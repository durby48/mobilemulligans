// app/api/employee-records/documents/route.ts — payroll/tax document vault.
//
//   GET    ?employee_id=…            → list a person's documents (metadata only)
//   GET    ?download=<docId>          → mint a short-lived signed URL (audited)
//   POST   (multipart form)           → upload a document to the private bucket
//   DELETE ?id=<docId>                → remove the file + its metadata row
//
// Files live in the PRIVATE Supabase Storage bucket `employee-docs` (no public
// access). They are only ever reachable through a signed URL minted here for the
// single records admin, and only for ~2 minutes. Locked + audited like the
// records route. Node runtime; never cached.

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireRecordsAdmin, writeAudit } from "@/lib/pii/authz";
import type { EmployeeDocType } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "employee-docs";
const NO_STORE = { "Cache-Control": "no-store" } as const;
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB per file
const DOC_TYPES: EmployeeDocType[] = ["w4", "w2", "paystub", "payroll_report", "other"];
const SIGNED_URL_TTL = 120; // seconds

function safeName(name: string): string {
  return name.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "document";
}

export async function GET(request: Request) {
  const ctx = await requireRecordsAdmin();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const admin = getSupabaseServerClient();
  const url = new URL(request.url);

  // Single-document download → mint a short-lived signed URL (audited).
  const downloadId = url.searchParams.get("download");
  if (downloadId) {
    const { data: doc } = await admin
      .from("employee_documents")
      .select("id, employee_id, file_path, file_name")
      .eq("company", ctx.company)
      .eq("id", downloadId)
      .maybeSingle();
    if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
    const { data: signed, error } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(doc.file_path, SIGNED_URL_TTL, { download: doc.file_name });
    if (error || !signed) return NextResponse.json({ error: "could not sign url" }, { status: 500 });
    await writeAudit({
      actorEmail: ctx.email, company: ctx.company, employeeId: doc.employee_id,
      action: "doc.download", detail: doc.file_name,
    });
    return NextResponse.json({ url: signed.signedUrl }, { headers: NO_STORE });
  }

  const employeeId = url.searchParams.get("employee_id");
  if (!employeeId) return NextResponse.json({ error: "employee_id is required" }, { status: 422 });
  const { data, error } = await admin
    .from("employee_documents")
    .select("id, employee_id, doc_type, file_name, content_type, size_bytes, period_label, created_at, uploaded_by")
    .eq("company", ctx.company)
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "query failed" }, { status: 500 });
  return NextResponse.json({ documents: data ?? [] }, { headers: NO_STORE });
}

export async function POST(request: Request) {
  const ctx = await requireRecordsAdmin();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: "expected multipart form" }, { status: 422 }); }
  const file = form.get("file");
  const employeeId = String(form.get("employee_id") ?? "");
  const docTypeRaw = String(form.get("doc_type") ?? "other");
  const periodLabel = form.get("period_label") ? String(form.get("period_label")) : null;
  const docType: EmployeeDocType = DOC_TYPES.includes(docTypeRaw as EmployeeDocType) ? (docTypeRaw as EmployeeDocType) : "other";

  if (!employeeId) return NextResponse.json({ error: "employee_id is required" }, { status: 422 });
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "a file is required" }, { status: 422 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "file exceeds 25 MB limit" }, { status: 413 });

  const admin = getSupabaseServerClient();
  const { data: emp } = await admin
    .from("employees").select("id").eq("id", employeeId).eq("company", ctx.company).maybeSingle();
  if (!emp) return NextResponse.json({ error: "unknown employee for this company" }, { status: 404 });

  const fileName = safeName(file.name);
  const path = `${ctx.company}/${employeeId}/${docType}/${Date.now()}-${fileName}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const contentType = file.type || "application/octet-stream";

  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: false });
  if (upErr) {
    const missing = /bucket|not found/i.test(upErr.message);
    return NextResponse.json(
      { error: missing ? "storage bucket 'employee-docs' is not set up — see config/EMPLOYEE_RECORDS_SETUP.md" : "upload failed" },
      { status: 500 },
    );
  }

  const { data: row, error: insErr } = await admin
    .from("employee_documents")
    .insert({
      company: ctx.company, employee_id: employeeId, doc_type: docType,
      file_path: path, file_name: fileName, content_type: contentType,
      size_bytes: file.size, period_label: periodLabel, uploaded_by: ctx.email,
    })
    .select("id, employee_id, doc_type, file_name, content_type, size_bytes, period_label, created_at, uploaded_by")
    .single();
  if (insErr || !row) {
    // Roll back the orphaned object so storage and metadata stay consistent.
    await admin.storage.from(BUCKET).remove([path]);
    return NextResponse.json({ error: "could not record document" }, { status: 500 });
  }

  await writeAudit({ actorEmail: ctx.email, company: ctx.company, employeeId, action: "doc.upload", detail: `${docType}:${fileName}` });
  return NextResponse.json({ document: row }, { status: 201, headers: NO_STORE });
}

export async function DELETE(request: Request) {
  const ctx = await requireRecordsAdmin();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 422 });

  const admin = getSupabaseServerClient();
  const { data: doc } = await admin
    .from("employee_documents")
    .select("id, employee_id, file_path, file_name")
    .eq("company", ctx.company)
    .eq("id", id)
    .maybeSingle();
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });

  await admin.storage.from(BUCKET).remove([doc.file_path]);
  const { error } = await admin.from("employee_documents").delete().eq("id", id).eq("company", ctx.company);
  if (error) return NextResponse.json({ error: "delete failed" }, { status: 500 });

  await writeAudit({ actorEmail: ctx.email, company: ctx.company, employeeId: doc.employee_id, action: "doc.delete", detail: doc.file_name });
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
