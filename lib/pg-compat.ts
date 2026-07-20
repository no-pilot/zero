import "server-only";
import sql from "@/lib/db";

/**
 * Minimal supabase-js-compatible query builder over plain Postgres (postgres.js),
 * so nozero's existing `.from(...).select()/.eq()/.rpc()` call sites keep working
 * after retiring Supabase. Server-only. Identifiers come from code literals (trusted);
 * values are always parameterized ($1,$2,...). Schema is selectable (nozero | madrigal).
 */
type Row = Record<string, unknown>;
type Result<T = unknown> = { data: T; error: { message: string } | null };

const ident = (s: string) => '"' + s.replace(/"/g, '""') + '"';

interface Filter { col: string; op: string; val: unknown; }

class QueryBuilder<T = Row> implements PromiseLike<Result<T>> {
  private _select = "*";
  private _returning = "*";
  private filters: Filter[] = [];
  private _order: { col: string; asc: boolean }[] = [];
  private _limit?: number;
  private _range?: [number, number];
  private mode: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private payload: Row | Row[] | null = null;
  private onConflict?: string;
  private single: false | "one" | "maybe" = false;

  constructor(private table: string, private schema: string) {}
  private qtable() { return `${ident(this.schema)}.${ident(this.table)}`; }

  select(cols = "*") {
    if (this.mode === "select") this._select = cols || "*";
    else this._returning = cols || "*";
    return this;
  }
  insert(rows: Row | Row[]) { this.mode = "insert"; this.payload = rows; return this; }
  update(patch: Row) { this.mode = "update"; this.payload = patch; return this; }
  upsert(rows: Row | Row[], opts?: { onConflict?: string }) {
    this.mode = "upsert"; this.payload = rows; this.onConflict = opts?.onConflict; return this;
  }
  delete() { this.mode = "delete"; return this; }

  eq(col: string, val: unknown) { this.filters.push({ col, op: "=", val }); return this; }
  neq(col: string, val: unknown) { this.filters.push({ col, op: "<>", val }); return this; }
  gt(col: string, val: unknown) { this.filters.push({ col, op: ">", val }); return this; }
  gte(col: string, val: unknown) { this.filters.push({ col, op: ">=", val }); return this; }
  lt(col: string, val: unknown) { this.filters.push({ col, op: "<", val }); return this; }
  lte(col: string, val: unknown) { this.filters.push({ col, op: "<=", val }); return this; }
  is(col: string, val: unknown) { this.filters.push({ col, op: "is", val }); return this; }
  in(col: string, vals: unknown[]) { this.filters.push({ col, op: "in", val: vals }); return this; }
  ilike(col: string, val: unknown) { this.filters.push({ col, op: "ilike", val }); return this; }
  like(col: string, val: unknown) { this.filters.push({ col, op: "like", val }); return this; }
  contains(col: string, val: unknown) { this.filters.push({ col, op: "@>", val }); return this; }
  match(obj: Row) { for (const k in obj) this.filters.push({ col: k, op: "=", val: obj[k] }); return this; }
  filter(col: string, op: string, val: unknown) {
    const map: Record<string, string> = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=", like: "like", ilike: "ilike", is: "is", in: "in", cs: "@>" };
    this.filters.push({ col, op: map[op] ?? "=", val });
    return this;
  }
  or(expr: string) { this.filters.push({ col: "__or__", op: "or", val: expr }); return this; }
  order(col: string, opts?: { ascending?: boolean }) { this._order.push({ col, asc: opts?.ascending !== false }); return this; }
  limit(n: number) { this._limit = n; return this; }
  range(a: number, b: number) { this._range = [a, b]; return this; }
  maybeSingle() { this.single = "maybe"; return this; }
  single() { this.single = "one"; return this; }

  private buildWhere(params: unknown[]): string {
    if (!this.filters.length) return "";
    const parts: string[] = [];
    for (const f of this.filters) {
      if (f.op === "or") {
        const ors = String(f.val).split(",").map((clause) => {
          const [c, op, ...rest] = clause.split(".");
          const v = rest.join(".");
          const sqlop = ({ eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=", is: "is", ilike: "ilike", like: "like" } as Record<string, string>)[op] ?? "=";
          params.push(v); return `${ident(c)} ${sqlop} $${params.length}`;
        });
        parts.push("(" + ors.join(" OR ") + ")");
      } else if (f.op === "is") {
        parts.push(`${ident(f.col)} is ${f.val === null ? "null" : f.val === true ? "true" : f.val === false ? "false" : "null"}`);
      } else if (f.op === "in") {
        const arr = (f.val as unknown[]) ?? [];
        if (!arr.length) { parts.push("false"); continue; }
        const ph = arr.map((v) => { params.push(v); return `$${params.length}`; });
        parts.push(`${ident(f.col)} in (${ph.join(",")})`);
      } else {
        params.push(f.val); parts.push(`${ident(f.col)} ${f.op} $${params.length}`);
      }
    }
    return " where " + parts.join(" and ");
  }

  private build(): { text: string; params: unknown[] } {
    const params: unknown[] = [];
    if (this.mode === "select") {
      let text = `select ${this._select} from ${this.qtable()}`;
      text += this.buildWhere(params);
      if (this._order.length) text += " order by " + this._order.map((o) => `${ident(o.col)} ${o.asc ? "asc" : "desc"}`).join(", ");
      if (this._limit != null) text += ` limit ${Number(this._limit)}`;
      if (this._range) { const [a, b] = this._range; text += ` limit ${b - a + 1} offset ${a}`; }
      return { text, params };
    }
    if (this.mode === "delete") {
      return { text: `delete from ${this.qtable()}${this.buildWhere(params)} returning ${this._returning}`, params };
    }
    if (this.mode === "update") {
      const patch = this.payload as Row;
      const sets = Object.keys(patch).map((k) => { params.push(patch[k]); return `${ident(k)} = $${params.length}`; });
      return { text: `update ${this.qtable()} set ${sets.join(", ")}${this.buildWhere(params)} returning ${this._returning}`, params };
    }
    const rows = (Array.isArray(this.payload) ? this.payload : [this.payload]) as Row[];
    const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
    const values = rows.map((r) => "(" + cols.map((c) => { params.push(r[c] ?? null); return `$${params.length}`; }).join(",") + ")").join(",");
    let text = `insert into ${this.qtable()} (${cols.map(ident).join(",")}) values ${values}`;
    if (this.mode === "upsert") {
      const keys = (this.onConflict ?? "id").split(",").map((x) => x.trim());
      const conflict = keys.map(ident).join(",");
      const upd = cols.filter((c) => !keys.includes(c)).map((c) => `${ident(c)} = excluded.${ident(c)}`);
      text += ` on conflict (${conflict}) do update set ${upd.join(", ")}`;
    }
    text += ` returning ${this._returning}`;
    return { text, params };
  }

  async run(): Promise<Result<T>> {
    try {
      const { text, params } = this.build();
      const rows = (await sql.unsafe(text, params as never[])) as unknown as Row[];
      if (this.single) {
        if (rows.length === 0) return { data: null as T, error: this.single === "one" ? { message: "no rows" } : null };
        return { data: rows[0] as T, error: null };
      }
      return { data: rows as T, error: null };
    } catch (e) {
      return { data: (this.single ? null : []) as T, error: { message: (e as Error).message } };
    }
  }

  then<R1 = Result<T>, R2 = never>(onOk?: ((v: Result<T>) => R1 | PromiseLike<R1>) | null, onErr?: ((r: unknown) => R2 | PromiseLike<R2>) | null): PromiseLike<R1 | R2> {
    return this.run().then(onOk, onErr);
  }
}

class PgClient {
  constructor(private schema: string = "nozero") {}
  from<T = Row>(table: string) { return new QueryBuilder<T>(table, this.schema); }
  async rpc(fn: string, args: Record<string, unknown> = {}) {
    try {
      const keys = Object.keys(args);
      const params = keys.map((k) => args[k]);
      const argList = keys.map((k, i) => `${ident(k)} => $${i + 1}`).join(", ");
      const rows = (await sql.unsafe(`select * from ${ident(this.schema)}.${ident(fn)}(${argList})`, params as never[])) as unknown as Row[];
      const data = rows.length === 1 && Object.keys(rows[0]).length === 1 ? Object.values(rows[0])[0] : rows;
      return { data, error: null };
    } catch (e) {
      return { data: null, error: { message: (e as Error).message } };
    }
  }
}

export function createPgClient(schema = "nozero") { return new PgClient(schema); }
export type { PgClient };
