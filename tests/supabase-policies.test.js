const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { PGlite } = require("@electric-sql/pglite");
const OWNER = "11111111-1111-4111-8111-111111111111",
  OTHER = "22222222-2222-4222-8222-222222222222";
const OWNER_SESSION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  OTHER_SESSION = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
test("PostgreSQL policies restrict every cloud data path to the owner and active session", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`create role anon; create role authenticated; create schema auth;
 create table auth.users(id uuid primary key); create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id));
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
 grant usage on schema auth to anon,authenticated;
 insert into auth.users values('${OWNER}'),('${OTHER}');insert into auth.sessions values('${OWNER_SESSION}','${OWNER}'),('${OTHER_SESSION}','${OTHER}');`);
  const schema = await fs.readFile(
    path.join(__dirname, "../supabase/schema.sql"),
    "utf8",
  );
  await db.exec(schema);
  await db.query("insert into campus_private.owner values(true,$1)", [OWNER]);
  async function identity(id, session, run, role = "authenticated") {
    await db.exec("reset role");
    await db.exec("set role " + role);
    await db.query(
      "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
      [id || "", JSON.stringify(session ? { session_id: session } : {})],
    );
    try {
      return await run();
    } finally {
      await db.exec("reset role");
    }
  }
  const rpc = async (sql, args = []) =>
    (await db.query(sql, args)).rows[0]?.result;
  await t.test(
    "anonymous visitors cannot read tables or invoke private RPCs",
    () =>
      identity(
        "",
        null,
        async () => {
          for (const query of [
            "select * from public.campus_work",
            "select * from public.campus_profile",
            "select public.campus_bootstrap()",
          ])
            await assert.rejects(db.query(query), (e) => e.code === "42501");
        },
        "anon",
      ),
  );
  await t.test("the configured owner can initialize, read, and save work", () =>
    identity(OWNER, OWNER_SESSION, async () => {
      const initial = await rpc("select public.campus_bootstrap() as result");
      assert.equal(initial.state, null);
      assert.equal(initial.revision, 0);
      const saved = await rpc(
        "select public.campus_save_state($1,$2::jsonb) as result",
        [0, JSON.stringify({ notes: { 0: "Private owner reflection" } })],
      );
      assert.equal(saved.revision, 1);
      const result = await rpc("select public.campus_bootstrap() as result");
      assert.equal(result.state.notes[0], "Private owner reflection");
    }),
  );
  await t.test(
    "another signed-in user gets no rows and cannot invoke owner RPCs",
    () =>
      identity(OTHER, OTHER_SESSION, async () => {
        assert.equal(
          (await db.query("select * from public.campus_work")).rows.length,
          0,
        );
        assert.equal(
          (await db.query("select * from public.campus_profile")).rows.length,
          0,
        );
        for (const query of [
          "select public.campus_bootstrap()",
          "select * from campus_private.owner",
        ])
          await assert.rejects(db.query(query), (e) => e.code === "42501");
        await assert.rejects(
          db.query(
            "insert into public.campus_work(user_id,state) values($1,$2::jsonb)",
            [OTHER, "{}"],
          ),
          (e) => e.code === "42501",
        );
        await assert.rejects(
          db.query("select public.campus_save_state(1,$1::jsonb)", ["{}"]),
          (e) => e.code === "42501",
        );
      }),
  );
  await t.test(
    "profile updates are validated and stale writes are rejected",
    () =>
      identity(OWNER, OWNER_SESSION, async () => {
        const p = await rpc(
          "select public.campus_update_profile($1::jsonb) as result",
          [
            JSON.stringify({
              displayName: "Owner Artist",
              instrument: "Piano",
              goal: "Finish one song",
            }),
          ],
        );
        assert.equal(p.displayName, "Owner Artist");
        await assert.rejects(
          db.query("select public.campus_update_profile($1::jsonb)", ["{}"]),
          (e) => e.code === "22023",
        );
        await assert.rejects(
          db.query("select public.campus_save_state(0,$1::jsonb)", ["{}"]),
          (e) => e.code === "PT409",
        );
        const result = await rpc("select public.campus_bootstrap() as result");
        assert.equal(result.state.notes[0], "Private owner reflection");
      }),
  );
  await t.test("the owner cannot insert data under a different user ID", () =>
    identity(OWNER, OWNER_SESSION, async () => {
      await assert.rejects(
        db.query("insert into public.campus_profile(user_id) values($1)", [
          OTHER,
        ]),
        (e) => e.code === "42501",
      );
    }),
  );
  await t.test(
    "a revoked Auth session loses access even with a previously issued token",
    async () => {
      await db.query("delete from auth.sessions where id=$1", [OWNER_SESSION]);
      await identity(OWNER, OWNER_SESSION, async () => {
        assert.equal(
          (await db.query("select * from public.campus_work")).rows.length,
          0,
        );
        await assert.rejects(
          db.query("select public.campus_bootstrap()"),
          (e) => e.code === "42501",
        );
      });
    },
  );
});
