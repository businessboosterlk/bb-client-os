/* THE TEAM'S DOOR (Stage 2, 25 Oct 2026). BB runs every client's Hub from its own systems (Thulaib, 25 Oct: "anything that we
   need to manage, upload or anything like that, we do it from our current systems"). The system's own sign in is checked here,
   the person must be on the active team, and the answer is a Hub token for one client on Business Booster's side. */
import { mode, supa } from './store.js';
import { issue, topicFor } from './auth.js';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

async function staffFrom(req) {
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  if (mode === 'memory') {
    if (process.env.HUB_STAFF_TEST_TOKEN && process.env.HUB_STAFF_TEST_TOKEN === bearer) {
      return { name: 'Tiana', role: 'SMM' };
    }
    return null;
  }

  const { data: user, error } = await (await supa()).auth.getUser(bearer);
  if (error || !user?.user) return null;

  const name = user.user_metadata.name || user.user_metadata.full_name || '';
  const role = user.user_metadata.role || '';

  // The person must be an active team member, case does not matter.
  const { data: member } = await (await supa())
    .from('team_members')
    .select('name')
    .eq('active', true)
    .ilike('name', name)
    .limit(1);
  if (!member || member.length === 0) return null;

  return { name, role };
}

const ROLE_WORDS = { SMM: 'Social media manager', COO: 'Operations', CEO: 'Business Booster', Graphic: 'Design', Video: 'Video', Dev: 'Web' };
export function roleWords(role) {
  return ROLE_WORDS[role] || 'Business Booster';
}

async function clientsWithApp() {
  if (mode === 'memory') {
    const dir = path.resolve(process.env.HUB_CASTS_DIR);
    const files = await readdir(dir);
    const clients = [];
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const config = JSON.parse(await readFile(path.join(dir, file), 'utf8'));
      if (config.bb && config.bb.client_id) {
        clients.push({ clientId: String(config.bb.client_id), slug: config.slug, name: config.name });
      }
    }
    return clients;
  }

  const { data } = await (await supa())
    .from('os_clients')
    .select('slug,name,config')
    .eq('active', true)
    .limit(500);
  return (data || [])
    .filter((c) => c.config?.bb?.client_id)
    .map((c) => ({ clientId: String(c.config.bb.client_id), slug: c.slug, name: c.name }));
}

export async function staffHubs(req) {
  const who = await staffFrom(req);
  if (!who) {
    return Response.json({ error: 'Sign in to the team first.' }, { status: 401 });
  }
  return Response.json(await clientsWithApp());
}

export async function staffToken(req) {
  const who = await staffFrom(req);
  if (!who) {
    return Response.json({ error: 'Sign in to the team first.' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const clientId = String(body.clientId || '');
  const hub = (await clientsWithApp()).find((c) => c.clientId === clientId);
  if (!hub) {
    return Response.json({ error: 'This client has no app yet.' }, { status: 404 });
  }

  const first = who.name.split(' ')[0];
  const person = { id: null, name: first, role: roleWords(who.role), side: 'bb' };
  const live = process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY
    ? { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_ANON_KEY, topic: topicFor(hub.slug) }
    : null;

  return Response.json({
    token: issue(hub.slug, person),
    slug: hub.slug,
    name: hub.name,
    me: { name: person.name, role: person.role, side: 'bb' },
    live
  });
}
