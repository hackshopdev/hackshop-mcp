import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadCatalog } from "../site/lib/catalog";
import { boardPath } from "../site/lib/board-slugs";
import { SEED_IDEAS } from "../site/lib/ideas/seed";
import { PUBLIC_IDEA_COLUMNS } from "../site/lib/ideas/types";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20261005000000_ideas.sql"),
  "utf8",
);
// Comments stripped, whitespace collapsed, lower case: easier to match.
const flat = sql
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join(" ")
  .replace(/\s+/g, " ")
  .toLowerCase();

function functionBody(name: string): string {
  const start = flat.indexOf(`create or replace function public.${name}(`);
  expect(start, name).toBeGreaterThanOrEqual(0);
  const end = flat.indexOf("$$;", start);
  expect(end, name).toBeGreaterThan(start);
  return flat.slice(start, end + 3);
}

describe("ideas migration", () => {
  it("is balanced and creates the three tables", () => {
    expect((sql.match(/\$\$/g) ?? []).length % 2).toBe(0);
    expect((sql.match(/\(/g) ?? []).length).toBe((sql.match(/\)/g) ?? []).length);
    for (const table of ["ideas", "idea_votes", "idea_reports"]) {
      expect(flat).toContain(`create table if not exists public.${table} (`);
      expect(flat).toContain(`alter table public.${table} enable row level security;`);
      expect(flat).toContain(`revoke all on table public.${table} from anon, authenticated;`);
    }
  });

  it("defines the ideas columns and checks from the spec", () => {
    for (const fragment of [
      "display_name text not null default 'a builder' check (char_length(display_name) between 1 and 40)",
      "title text not null check (char_length(title) between 4 and 80)",
      "body text not null default '' check (char_length(body) <= 600)",
      "size text check (size in ('pocket', 'desk', 'wall', 'hidden'))",
      "interaction text check (interaction in ('voice', 'touch', 'light-button'))",
      "sensing text check (sensing in ('camera', 'air-quality', 'none'))",
      "budget text check (budget in ('25', '50', '100', 'none'))",
      "status text not null default 'published' check (status in ('published', 'hidden'))",
      "vote_count integer not null default 0",
      "report_count integer not null default 0",
      "moderation_token uuid not null default gen_random_uuid()",
      "idea_id uuid not null references public.ideas (id) on delete cascade",
      "primary key (idea_id, user_id)",
    ]) {
      expect(flat).toContain(fragment);
    }
  });

  it("grants only public columns of ideas to anon and authenticated", () => {
    const grant = flat.match(/grant select \(([^)]*)\) on table public\.ideas to anon, authenticated;/);
    expect(grant).not.toBeNull();
    const columns = (grant?.[1] ?? "").split(",").map((column) => column.trim());
    for (const secret of ["user_id", "moderation_token", "report_count"]) {
      expect(columns).not.toContain(secret);
    }
    for (const column of PUBLIC_IDEA_COLUMNS.split(",")) {
      expect(columns).toContain(column);
    }
    // No table-wide select and no client writes on ideas or reports.
    expect(flat).not.toMatch(/grant [^;]*\bselect\b(?! \()[^;]*on table public\.ideas to (anon|authenticated)/);
    expect(flat).not.toMatch(/grant [^;]*(insert|update|delete|all)[^;]*on table public\.ideas to (anon|authenticated)/);
    expect(flat).not.toMatch(/grant [^;]*on table public\.idea_reports to (anon|authenticated)/);
    expect(flat).toContain(
      "create policy \"ideas_select_published\" on public.ideas for select to anon, authenticated using (status = 'published');",
    );
    expect(flat).not.toMatch(/create policy [^;]* on public\.ideas for (insert|update|delete|all)/);
  });

  it("lets authenticated users manage only their own votes on published ideas", () => {
    expect(flat).toContain("grant select, delete on table public.idea_votes to authenticated;");
    expect(flat).toContain("grant insert (idea_id, user_id) on table public.idea_votes to authenticated;");
    expect(flat).not.toMatch(/on table public\.idea_votes to anon/);
    expect(flat).toMatch(/create policy "idea_votes_select_own" on public\.idea_votes for select to authenticated using \(\(select auth\.jwt\(\) ->> 'sub'\) = user_id\);/);
    expect(flat).toMatch(/create policy "idea_votes_insert_own" on public\.idea_votes for insert to authenticated with check \( \(select auth\.jwt\(\) ->> 'sub'\) = user_id and exists \( select 1 from public\.ideas i where i\.id = idea_votes\.idea_id and i\.status = 'published' \) \);/);
    expect(flat).toMatch(/create policy "idea_votes_delete_own" on public\.idea_votes for delete to authenticated using \(\(select auth\.jwt\(\) ->> 'sub'\) = user_id\);/);
  });

  it("uses security-definer functions with an empty search_path", () => {
    for (const name of ["ideas_sync_vote_count", "submit_idea", "report_idea", "hide_idea"]) {
      const body = functionBody(name);
      expect(body, name).toContain("security definer");
      expect(body, name).toContain("set search_path = ''");
    }
  });

  it("keeps vote_count in sync with a trigger on idea_votes", () => {
    const body = functionBody("ideas_sync_vote_count");
    expect(body).toContain("update public.ideas set vote_count = vote_count + 1 where id = new.idea_id;");
    expect(body).toContain("update public.ideas set vote_count = greatest(vote_count - 1, 0) where id = old.idea_id;");
    expect(flat).toContain(
      "create or replace trigger idea_votes_sync_count after insert or delete on public.idea_votes for each row execute function public.ideas_sync_vote_count();",
    );
    expect(flat).toContain(
      "revoke execute on function public.ideas_sync_vote_count() from public, anon, authenticated;",
    );
  });

  it("submit_idea takes the user from the JWT and caps 5 ideas per 24 hours", () => {
    const body = functionBody("submit_idea");
    expect(body).toContain(
      "public.submit_idea( p_title text, p_body text default '', p_display_name text default null, p_size text default null, p_interaction text default null, p_sensing text default null, p_budget text default null, p_suggested_device_id text default null )",
    );
    expect(body).toContain("returns table (id uuid, moderation_token uuid)");
    expect(body).toContain("v_user text := auth.jwt() ->> 'sub';");
    expect(body).toContain("i.created_at > now() - interval '24 hours'");
    expect(body).toContain("if v_recent >= 5 then raise exception 'daily_limit'");
    expect(body).toContain("pg_advisory_xact_lock");
    expect(body).not.toContain("p_user");
    const signature = "public.submit_idea(text, text, text, text, text, text, text, text)";
    expect(flat).toContain(`revoke execute on function ${signature} from public, anon;`);
    expect(flat).toContain(`grant execute on function ${signature} to authenticated;`);
  });

  it("report_idea records one report per user and hides at 3", () => {
    const body = functionBody("report_idea");
    expect(body).toContain("on conflict (idea_id, user_id) do nothing;");
    expect(body).toContain("when i.report_count + 1 >= 3 then 'hidden'");
    expect(flat).toContain("revoke execute on function public.report_idea(uuid) from public, anon;");
    expect(flat).toContain("grant execute on function public.report_idea(uuid) to authenticated;");
  });

  it("hide_idea needs the matching token and is callable by anon", () => {
    const body = functionBody("hide_idea");
    expect(body).toContain("where i.id = p_id and i.moderation_token = p_token;");
    expect(flat).toContain("revoke execute on function public.hide_idea(uuid, uuid) from public;");
    expect(flat).toContain("grant execute on function public.hide_idea(uuid, uuid) to anon, authenticated;");
  });

  it("seeds the same 12 ideas as seed.ts with zero votes and no fake votes", () => {
    const rows = [...sql.matchAll(/\('([0-9a-f-]{36})', 'hackshop', 'hackshop',\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)',\s*'([a-z]+)', '([a-z-]+)', '([a-z-]+)', null, '([a-z0-9-]+)',\s*0, '([0-9T:Z-]+)'\)/g)];
    expect(rows).toHaveLength(12);
    expect(SEED_IDEAS).toHaveLength(12);
    rows.forEach((row, index) => {
      const seed = SEED_IDEAS[index]!;
      expect(row[1]).toBe(seed.id);
      expect(row[2]?.replace(/''/g, "'")).toBe(seed.title);
      expect(row[3]?.replace(/''/g, "'")).toBe(seed.body);
      expect([row[4], row[5], row[6]]).toEqual([seed.size, seed.interaction, seed.sensing]);
      expect(row[7]).toBe(seed.suggested_device_id);
      expect(new Date(row[8]!).toISOString()).toBe(seed.created_at);
    });
    expect(flat).toContain("on conflict (id) do nothing;");
    expect(flat).not.toContain("insert into public.idea_votes");
  });

  it("seed ideas point at real catalog boards with board pages", () => {
    const catalogIds = new Set(loadCatalog().devices.map((device) => device.id));
    const ids = new Set<string>();
    for (const seed of SEED_IDEAS) {
      ids.add(seed.id);
      expect(seed.vote_count).toBe(0);
      expect(seed.display_name).toBe("hackshop");
      expect(catalogIds.has(seed.suggested_device_id ?? ""), seed.title).toBe(true);
      expect(boardPath(seed.suggested_device_id ?? ""), seed.title).not.toBeNull();
    }
    expect(ids.size).toBe(12);
  });
});
