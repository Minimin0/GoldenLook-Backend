export async function GET() {
  return Response.json({ status: "stub", route: "GET /api/flyer/[shareId]" }, { status: 501 });
}
