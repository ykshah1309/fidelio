/**
 * GET /api/gold?file=gold-report-401k — serves fallback gold reports.
 *
 * Used when the sample PDFs aren't available or live analysis fails.
 * Reads from the samples/ directory at build time.
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const fileName = request.nextUrl.searchParams.get("file");

  if (!fileName || !/^gold-report-(401k|paystub)$/.test(fileName)) {
    return NextResponse.json(
      { error: "Invalid file parameter. Use 'gold-report-401k' or 'gold-report-paystub'." },
      { status: 400 },
    );
  }

  const filePath = path.join(process.cwd(), "samples", `${fileName}.json`);

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return NextResponse.json(JSON.parse(content));
  } catch {
    return NextResponse.json(
      { error: "Gold report file not found." },
      { status: 404 },
    );
  }
}
