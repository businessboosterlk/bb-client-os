import { staffHubs, staffToken } from '../../../../../lib/staff.js';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  const { action } = await params;
  if (action === 'hubs') return staffHubs(req);
  return new Response(null, { status: 404 });
}

export async function POST(req, { params }) {
  const { action } = await params;
  if (action === 'token') return staffToken(req);
  return new Response(null, { status: 404 });
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
