import { NextResponse, type NextRequest } from "next/server";
import { checkVin } from "@/engine/vin";
import { decodeVin } from "@/lib/nhtsa";
import { createClient } from "@/lib/supabase/server";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/vin/[vin]">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { vin } = await ctx.params;
  const check = checkVin(vin);
  if (!check || check.vin.length !== 17) return NextResponse.json({ error: "VIN must be 17 characters." }, { status: 400 });
  try {
    const decoded = await decodeVin(check.vin);
    return NextResponse.json({ check, decoded }, { headers: { "cache-control": "private, max-age=86400" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Decode failed." }, { status: 502 });
  }
}
