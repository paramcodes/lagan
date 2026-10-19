import pg from "pg";

export const DATABASE_URL =
  process.env.DATABASE_URL || "postgres://lagan:lagan@localhost:5432/lagan";

export async function seedE2EData() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await client.query(`
      INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
      VALUES ('author_evelyn', 'Dr. Evelyn Reed', 'evelyn@example.com', true, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email;

      INSERT INTO "courses" (id, tenant_id, author_id, title, description, price_cents, discount_percent, is_free, status, published_at)
      VALUES 
        ('course_distributed', 'default', 'author_evelyn', 'Distributed Systems in Practice', 'Build robust, fault-tolerant distributed services with consensus and replication algorithms.', 4999, 10, false, 'published', NOW() - INTERVAL '3 days'),
        ('course_typescript', 'default', 'author_evelyn', 'Type-Driven Architecture with TypeScript', 'Master type-level programming, brand types, template literals, and domain modeling.', 2999, 0, false, 'published', NOW() - INTERVAL '2 days'),
        ('course_database', 'default', 'author_evelyn', 'Database Internals: Storage & Retrieval', 'Learn B-trees, LSM trees, WAL, write amplification, and page buffer management from scratch.', 0, 0, true, 'published', NOW() - INTERVAL '1 day')
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        status = EXCLUDED.status,
        is_free = EXCLUDED.is_free,
        price_cents = EXCLUDED.price_cents,
        published_at = EXCLUDED.published_at;

      INSERT INTO "modules" (id, course_id, title, position)
      VALUES 
        ('mod_1', 'course_distributed', 'Foundations & System Models', 0),
        ('mod_db_1', 'course_database', 'Storage Engine Fundamentals', 0)
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO "lessons" (id, module_id, type, title, position, status, mux_playback_id, content_json)
      VALUES 
        ('les_1', 'mod_1', 'video', 'Welcome & Course Orientation', 0, 'published', 'demo_playback_id', NULL),
        ('les_2', 'mod_1', 'text', 'Synchronous vs. Asynchronous Models', 1, 'published', NULL, '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"System models"}]}]}'::jsonb),
        ('les_db_1', 'mod_db_1', 'text', 'B-Trees vs LSM Trees', 0, 'published', NULL, '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Storage engine comparison"}]}]}'::jsonb),
        ('les_db_2', 'mod_db_1', 'text', 'Write-Ahead Logging Protocols', 1, 'published', NULL, '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Crash recovery principles"}]}]}'::jsonb)
      ON CONFLICT (id) DO NOTHING;
    `);
  } finally {
    await client.end();
  }
}

export async function createTestNotification(userId: string, title: string, description: string) {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const res = await client.query(
      `
      INSERT INTO "notifications" (id, tenant_id, user_id, type, payload, created_at)
      VALUES (
        $1,
        'default',
        $2,
        'course_published',
        $3::jsonb,
        NOW()
      )
      RETURNING id;
    `,
      [
        `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        userId,
        JSON.stringify({
          title,
          courseId: "course_database",
          courseTitle: title,
          message: description,
          summary: description,
        }),
      ],
    );
    return res.rows[0]?.id as string;
  } finally {
    await client.end();
  }
}

export async function getUserIdByEmail(email: string): Promise<string | null> {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const res = await client.query(`SELECT id FROM "user" WHERE email = $1 LIMIT 1;`, [email]);
    return (res.rows[0]?.id as string) ?? null;
  } finally {
    await client.end();
  }
}

export async function cleanupTestData(userEmails: string[], courseIds: string[] = []) {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    if (courseIds.length > 0) {
      await client.query(`DELETE FROM "courses" WHERE id = ANY($1);`, [courseIds]);
    }
    if (userEmails.length > 0) {
      await client.query(`DELETE FROM "user" WHERE email = ANY($1);`, [userEmails]);
    }
  } finally {
    await client.end();
  }
}
