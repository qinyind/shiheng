import pg from "pg";
import { hashToken } from "./security.mjs";

const schemaSQL = `
CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO app_users (id, display_name)
VALUES ('00000000-0000-4000-8000-000000000001', '个人用户')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS device_tokens (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  device_name text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS user_states (
  user_id uuid PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  version bigint NOT NULL DEFAULT 0,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO user_states (user_id)
VALUES ('00000000-0000-4000-8000-000000000001')
ON CONFLICT (user_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS food_analyses (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  input_hash text NOT NULL,
  estimate jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, input_hash)
);
`;

export const personalUserID = "00000000-0000-4000-8000-000000000001";

export class PostgresRepository {
  constructor(databaseURL) {
    this.pool = new pg.Pool({ connectionString: databaseURL, max: 10 });
  }

  async initialize() {
    await this.pool.query(schemaSQL);
  }

  async close() {
    await this.pool.end();
  }

  async createDevice({ id, userID, deviceName, token }) {
    await this.pool.query(
      "INSERT INTO device_tokens (id, user_id, device_name, token_hash) VALUES ($1, $2, $3, $4)",
      [id, userID, deviceName, hashToken(token)],
    );
  }

  async authenticate(token) {
    const result = await this.pool.query(
      `UPDATE device_tokens SET last_used_at = now()
       WHERE token_hash = $1 AND revoked_at IS NULL
       RETURNING user_id AS "userID", id AS "deviceID", device_name AS "deviceName"`,
      [hashToken(token)],
    );
    return result.rows[0] || null;
  }

  async getState(userID) {
    const result = await this.pool.query(
      `SELECT version::text, state, updated_at AS "updatedAt" FROM user_states WHERE user_id = $1`,
      [userID],
    );
    const row = result.rows[0];
    return { version: Number(row.version), state: row.state, updatedAt: row.updatedAt };
  }

  async putState(userID, baseVersion, state) {
    const result = await this.pool.query(
      `UPDATE user_states SET state = $3::jsonb, version = version + 1, updated_at = now()
       WHERE user_id = $1 AND version = $2
       RETURNING version::text, state, updated_at AS "updatedAt"`,
      [userID, baseVersion, JSON.stringify(state)],
    );
    if (result.rows[0]) {
      const row = result.rows[0];
      return { ok: true, value: { version: Number(row.version), state: row.state, updatedAt: row.updatedAt } };
    }
    return { ok: false, value: await this.getState(userID) };
  }

  async getAnalysis(userID, inputHash) {
    const result = await this.pool.query(
      "SELECT estimate FROM food_analyses WHERE user_id = $1 AND input_hash = $2",
      [userID, inputHash],
    );
    return result.rows[0]?.estimate || null;
  }

  async saveAnalysis(userID, inputHash, estimate) {
    await this.pool.query(
      `INSERT INTO food_analyses (user_id, input_hash, estimate) VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (user_id, input_hash) DO UPDATE SET estimate = EXCLUDED.estimate`,
      [userID, inputHash, JSON.stringify(estimate)],
    );
  }
}
