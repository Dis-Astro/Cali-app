// Disposable real PostgreSQL, bound to loopback. Never reads production credentials.
// Install tools separately: npm install --prefix build/server-tests embedded-postgres@18.4.0-beta.17 pg@8.16.3
// Run: node scripts/test-course-database.mjs
import assert from 'node:assert/strict';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import EmbeddedPostgres from '../build/server-tests/node_modules/embedded-postgres/dist/index.js';

const directory = await mkdtemp(join(tmpdir(), 'spg-course-tests-'));
const server = new EmbeddedPostgres({ databaseDir: directory, port: 55439, user: 'postgres', password: randomUUID(),
  persistent: true, postgresFlags: ['-h', '127.0.0.1', '-c', 'unix_socket_directories=', '-c', 'wal_level=logical'],
  onLog: () => {}, onError: () => {} });
const clients = [];
let passed = 0;
async function connect() {
  const client = server.getPgClient('postgres', '127.0.0.1');
  await client.connect(); clients.push(client);
  await client.query("SET statement_timeout = '5s'");
  return client;
}
async function test(name, run) { await run(); passed++; console.log(`PASS ${name}`); }
try {
  await server.initialise(); await server.start();
  const db = await connect();
  await db.query(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE public.profiles(user_id uuid PRIMARY KEY REFERENCES auth.users, role text NOT NULL);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE FUNCTION public.is_staff(id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM profiles WHERE user_id=id AND role IN ('admin','coach','segretaria')) $$;
    CREATE PUBLICATION supabase_realtime;`);
  const initial = await readFile(new URL('../supabase/migrations/20260130143628_3fb784e5-6ce6-4e8b-8e47-a4683c0493c1.sql', import.meta.url), 'utf8');
  for (const table of ['courses', 'course_participants', 'course_sessions']) {
    const sql = initial.match(new RegExp(`CREATE TABLE public\\.${table} \\([\\s\\S]*?\\n\\);`))?.[0];
    assert.ok(sql, `Original schema missing: ${table}`); await db.query(sql);
  }
  for (const name of ['20260903100000_course_booking_engine.sql', '20260904150000_course_confirmation_deadline.sql', '20260911090000_course_capacity_guards.sql']) {
    await db.query(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8'));
  }
  await db.query('GRANT USAGE ON SCHEMA public, auth TO authenticated, anon; GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;');
  const users = Array.from({length: 12}, () => randomUUID());
  for (const [i,id] of users.entries()) {
    await db.query('INSERT INTO auth.users VALUES ($1)', [id]);
    await db.query('INSERT INTO profiles VALUES ($1,$2)', [id, i === 0 ? 'admin' : 'cliente_corso']);
  }
  const course = randomUUID();
  await db.query("INSERT INTO courses(id,name,max_participants) VALUES ($1,'Synthetic course',4)", [course]);
  for (const id of users) await db.query('INSERT INTO course_participants(course_id,user_id) VALUES ($1,$2)', [course,id]);
  async function session({ total=1, fixed=0, floating=1, offset=0 } = {}) {
    const id = randomUUID();
    await db.query(`INSERT INTO course_sessions(id,course_id,start_time,end_time,max_participants,fixed_places,floating_places)
      VALUES ($1,$2,(date_trunc('week',now() AT TIME ZONE 'Europe/Rome') + interval '14 days 18 hours' + $6 * interval '1 day') AT TIME ZONE 'Europe/Rome',
      (date_trunc('week',now() AT TIME ZONE 'Europe/Rome') + interval '14 days 19 hours' + $6 * interval '1 day') AT TIME ZONE 'Europe/Rome',$3,$4,$5)`, [id,course,total,fixed,floating,offset]);
    return id;
  }
  const a = await connect(), b = await connect();
  async function staff(client) { await client.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[users[0]]); await client.query('SET ROLE authenticated'); }
  await staff(a); await staff(b);
  const book = (client,s,user,kind='floating') => client.query("INSERT INTO course_bookings(course_session_id,user_id,booking_type,status) VALUES ($1,$2,$3,'confirmed')",[s,user,kind]);
  async function race(first, second, expectedMessage) {
    await a.query('BEGIN');
    try {
      await first();
      const pending = second().then(() => ({ok:true}), error => ({error}));
      let blocked = false;
      for (let i=0;i<100;i++) {
        const state = await db.query("SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1",[b.processID]);
        if (state.rows[0]?.wait_event_type === 'Lock') { blocked = true; break; }
        await new Promise(resolve => setTimeout(resolve,10));
      }
      assert.ok(blocked, 'Second connection must actually wait on the first transaction');
      await a.query('COMMIT');
      const outcome = await pending;
      assert.match(outcome.error?.message ?? 'unexpected success', expectedMessage);
    } finally { await a.query('ROLLBACK'); }
  }
  await test('two staff compete for one remaining seat', async () => {
    const s=await session();
    await race(() => book(a,s,users[1]), () => book(b,s,users[2]), /Turno completo/);
    assert.equal((await db.query('SELECT count(*)::int n FROM course_bookings WHERE course_session_id=$1',[s])).rows[0].n,1);
  });
  await test('staff and client RPC share the same seat lock', async () => {
    const s=await session({offset:2});
    await b.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[users[4]]);
    await race(() => book(a,s,users[3]), () => b.query("SELECT manage_course_booking($1,'confirm')",[s]), /Turno completo/);
    await staff(b);
  });
  await test('same athlete cannot book concurrent sessions in one day group', async () => {
    const s1=await session({offset:4}),s2=await session({offset:4});
    await race(() => book(a,s1,users[5]), () => book(b,s2,users[5]), /già una presenza/);
  });
  await test('fixed assignments serialize and cannot exceed the slot capacity', async () => {
    await session({total:2,fixed:1,floating:1,offset:5});
    const assign = (client,user) => client.query("INSERT INTO course_fixed_assignments(course_id,user_id,day_of_week,start_time) VALUES ($1,$2,6,'18:00')",[course,user]);
    await race(() => assign(a,users[6]), () => assign(b,users[7]), /posti fissi.*esauriti/);
  });
  await test('category limits, fixed eligibility, membership and identity are enforced', async () => {
    const s=await session({total:2,fixed:1,floating:1,offset:6});
    await book(a,s,users[8]);
    await assert.rejects(book(b,s,users[9]), /Posti occasionali esauriti/);
    await assert.rejects(book(b,s,users[9],'fixed'), /Nessun posto fisso/);
    await assert.rejects(a.query('UPDATE course_bookings SET user_id=$1 WHERE course_session_id=$2',[users[9],s]), /trasferita/);
    await db.query('DELETE FROM course_participants WHERE user_id=$1',[users[10]]);
    await assert.rejects(book(b,s,users[10]), /non iscritto/);
  });
  await test('session capacity changes wait for concurrent fixed assignments', async () => {
    const s=await session({total:2,fixed:1,floating:1,offset:9});
    await db.query("UPDATE course_sessions SET start_time=start_time+interval '1 hour',end_time=end_time+interval '1 hour' WHERE id=$1",[s]);
    await race(() => a.query("INSERT INTO course_fixed_assignments(course_id,user_id,day_of_week,start_time) VALUES ($1,$2,3,'19:00')",[course,users[6]]),
      () => b.query('UPDATE course_sessions SET fixed_places=0 WHERE id=$1',[s]), /meno posti fissi/);
  });
  await test('inherited course capacity reduction waits for pending bookings', async () => {
    const s=await session({total:null,floating:null,offset:10});
    await book(a,s,users[1]);
    await race(() => book(a,s,users[2]), () => b.query('UPDATE courses SET max_participants=1 WHERE id=$1',[course]), /inferiore ai posti/);
  });
  await test('capacity reduction refuses occupied seats but allows attendance corrections and cancellation', async () => {
    const s=await session({total:2,floating:2,offset:7});
    await book(a,s,users[8]); await book(b,s,users[9]);
    await assert.rejects(a.query('UPDATE course_sessions SET max_participants=1,floating_places=1 WHERE id=$1',[s]), /inferiore ai posti/);
    await a.query("UPDATE course_bookings SET status='present' WHERE course_session_id=$1 AND user_id=$2",[s,users[8]]);
    await a.query("UPDATE course_bookings SET status='cancelled' WHERE course_session_id=$1 AND user_id=$2",[s,users[9]]);
    await a.query('UPDATE course_sessions SET max_participants=1,floating_places=1 WHERE id=$1',[s]);
  });
  await test('clients cannot bypass RPC through direct writes; deadline is authoritative', async () => {
    await b.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[users[11]]);
    const s=await session({offset:8});
    await assert.rejects(book(b,s,users[11]), /row-level security/);
    await db.query("UPDATE course_sessions SET start_time=now()+interval '2 hours',end_time=now()+interval '3 hours' WHERE id=$1",[s]);
    await assert.rejects(b.query("SELECT manage_course_booking($1,'confirm')",[s]), /conferme chiudono/);
    await assert.rejects(b.query('SELECT guard_course_booking_capacity()'), /permission denied/);
  });
  // Separate database: execute the existing security regressions on the real
  // application DDL/RLS. Storage infrastructure and unrelated later migrations
  // are deliberately out of scope; this is not a restored production clone.
  await server.createDatabase('security_regressions');
  const security = server.getPgClient('security_regressions', '127.0.0.1');
  await security.connect(); clients.push(security);
  await security.query(`CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role' $$;
    SET statement_timeout = '5s';`);
  const storageBoundary = initial.indexOf('-- STORAGE BUCKET PER VIDEO E DOCUMENTI');
  assert.ok(storageBoundary > 0);
  await security.query(initial.slice(0, storageBoundary));
  for (const name of ['20260131120809_247aa022-b96b-41c5-89f0-6ba58f0412ac.sql', '20260218171443_b944dcf3-9a8e-4972-bf41-901d2d04a3ad.sql',
    '20260225154420_0b925c4c-a3b8-43b8-9e5d-a17481a9d94d.sql', '20260415080551_390f2e91-e48c-41b5-8817-5163b4457d14.sql',
    '20260722120000_add_segretaria_role.sql', '20260905090000_protect_profile_identity.sql', '20260908090000_workout_completion_ownership.sql']) {
    await security.query(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url),'utf8'));
  }
  await security.query('GRANT USAGE ON SCHEMA public,auth TO authenticated,anon; GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;');
  for (const name of ['profile_identity.sql','workout_completion_ownership.sql']) {
    await test(`security regression ${name}`, async () => security.query(await readFile(new URL(`../supabase/tests/${name}`,import.meta.url),'utf8')));
  }
  console.log(`${passed} database scenarios passed; real PostgreSQL, synthetic fixtures only.`);
} finally {
  await Promise.all(clients.map(c=>c.end()));
  await server.stop();
  console.log(`Stopped local test database; synthetic files retained at ${directory}`);
}
