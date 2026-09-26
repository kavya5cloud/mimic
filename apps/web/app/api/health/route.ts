export const runtime = 'nodejs';
export async function GET() { return Response.json({ ok: true, service: 'mimic-web-api', phase: 1 }); }
