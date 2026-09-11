export async function GET() {
  return Response.json({ status: "stub", route: "GET /api/cases/[id]" }, { status: 501 });
}
