// PROTOTYPE, throwaway. Pulls REAL data for the library-model prototype:
//   TMDB: Doctor Who (1963) tv/121, Doctor Who (2005) tv/57243, Doctor Who (2023) tv/239770 — every season
//   Tardis Fandom: several real Theory:Timeline pages, plus the infobox of every TV story they mention
// Writes data.json beside this file. Run: node PROTOTYPE-fetch-data.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const token = readFileSync(join(homedir(), ".config/canoncore/tmdb-read-token"), "utf8").trim();
const UA = "CanonCorePrototype/0.1 (Owner's own project; permission granted by Tardis Fandom)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tmdb(path) {
  const r = await fetch(`https://api.themoviedb.org/3${path}`, { headers: { Authorization: `Bearer ${token}`, accept: "application/json" } });
  if (!r.ok) throw new Error(`TMDB ${path} ${r.status}`);
  await sleep(60);
  return r.json();
}
async function fandom(params) {
  const u = new URL("https://tardis.fandom.com/api.php");
  for (const [k, v] of Object.entries({ format: "json", formatversion: "2", ...params })) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`Fandom ${u} ${r.status}`);
  await sleep(400);
  return r.json();
}
const norm = (s) => s.toLowerCase().replace(/\(.*?\)/g, "").replace(/\b(part|episode)\s+(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b/g, "")
  .replace(/[^a-z0-9]+/g, " ").trim();
const strip = (h) => String(h ?? "").replace(/<br\s*\/?>/gi, ", ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").replace(/\s*,\s*(,\s*)+/g, ", ").trim();

// ---- TMDB: three shows, every season. Classic episodes are grouped into stories by title.
const SHOWS = [ { id: 121, label: "Doctor Who (1963–1989)", era: "Classic" }, { id: 57243, label: "Doctor Who (2005–2022)", era: "Revived" }, { id: 239770, label: "Doctor Who (2023–)", era: "Disney+ era" } ];
const shows = [];
for (const S of SHOWS) {
  const show = await tmdb(`/tv/${S.id}`);
  const seasons = [];
  if (S.id === 121) {
    const groups = (await tmdb(`/tv/121/episode_groups`)).results;
    const so = groups.find((g) => /story order/i.test(g.name)) ?? groups.find((g) => g.type === 5);
    const det = await tmdb(`/tv/episode_group/${so.id}`);
    const bySeason = new Map();
    det.groups.forEach((g, gi) => { const e0 = g.episodes[0]; if (!e0) return;
      const sn = e0.season_number; if (!bySeason.has(sn)) bySeason.set(sn, []);
      bySeason.get(sn).push({ key: norm(g.name), id: `tmdb-121-${e0.id}`, title: g.name.replace(/^\d+[.:]?\s*/, ""), air: e0.air_date,
        runtime: g.episodes.reduce((a, e) => a + (e.runtime ?? 0), 0), overview: e0.overview, still: e0.still_path, parts: g.episodes.length,
        pos: `S${sn} · story ${bySeason.get(sn).length + 1}` }); });
    for (const [sn, stories] of [...bySeason].sort((a, b) => a[0] - b[0]))
      seasons.push({ name: sn === 0 ? "Specials" : `Season ${sn}`, number: sn, year: (stories[0].air ?? "").slice(0, 4), stories });
    shows.push({ tmdb: S.id, label: S.label, era: S.era, name: show.name, overview: show.overview, poster: show.poster_path, backdrop: show.backdrop_path, seasons,
      grouping: `TMDB episode group "${so.name}"` });
    continue;
  }
  for (const s of show.seasons.filter((x) => x.season_number > 0 || S.id === 57243)) {
    const d = await tmdb(`/tv/${S.id}/season/${s.season_number}`);
    const stories = [];
    for (const e of d.episodes.filter((e) => s.season_number > 0 || ((e.runtime ?? 0) >= 30 && !/best of|proms|rewind|video diary|in america|confidential|at the proms|behind|special:/i.test(e.name)))) {
      const base = norm(e.name);
      const last = stories[stories.length - 1];
      if (S.id === 121 && last && last.key === base) { last.parts++; last.runtime = (last.runtime ?? 0) + (e.runtime ?? 0); continue; }
      stories.push({ key: base, id: `tmdb-${S.id}-${e.id}`, title: e.name.replace(/\s*\((\d+|part \w+)\)\s*$/i, ""), air: e.air_date, runtime: e.runtime, overview: e.overview,
        still: e.still_path, parts: 1, pos: `S${s.season_number} · ${S.id === 121 ? "story " + (stories.length + 1) : "E" + e.episode_number}` });
    }
    if (stories.length) seasons.push({ name: s.season_number === 0 ? "Specials" : s.name, number: s.season_number, year: (s.air_date ?? "").slice(0, 4), stories });
  }
  shows.push({ tmdb: S.id, label: S.label, era: S.era, name: show.name, overview: show.overview, poster: show.poster_path, backdrop: show.backdrop_path, seasons });
}
const allStories = shows.flatMap((sh) => sh.seasons.flatMap((se) => se.stories.map((st) => ({ ...st, show: sh.label, season: se.name }))));
const byKey = new Map(); for (const st of allStories) if (!byKey.has(st.key)) byKey.set(st.key, st);

// ---- Fandom: real timelines
const TIMELINES = ["Eleventh Doctor", "Amy Pond", "River Song", "Tenth Doctor", "Rose Tyler", "First Doctor", "Clara Oswald", "Fifteenth Doctor"];
const timelines = [];
const tvPages = new Set();
for (const who of TIMELINES) {
  const page = `Theory:Timeline - ${who}`;
  let wt;
  try { wt = (await fandom({ action: "parse", page, prop: "wikitext" })).parse.wikitext; } catch (e) { console.log("skip", page, e.message); continue; }
  const sections = []; let cur = null;
  for (const line of wt.split("\n")) {
    const h = line.match(/^(={2,4})\s*(.*?)\s*\1\s*$/);
    if (h) { cur = { title: h[2].replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1").replace(/'''?/g, ""), entries: [] }; sections.push(cur); continue; }
    const m = line.match(/^\*+\s*\[\[([A-Z]+)\]\]\s*:\s*(?:\{\{cs\|([^}|]+)|''\[\[([^\]|]+))/);
    if (m) m[2] = (m[2] ?? m[3]).trim();
    if (m && cur) { cur.entries.push({ medium: m[1], page: m[2].trim() }); if (m[1] === "TV") tvPages.add(m[2].trim()); }
  }
  timelines.push({ who, page, sections: sections.filter((s) => s.entries.length) });
}

// ---- Fandom infoboxes for every TV story mentioned
const infobox = {};
const pages = [...tvPages];
for (let i = 0; i < pages.length; i += 25) {
  const res = await fandom({ action: "query", prop: "pageprops", titles: pages.slice(i, i + 25).join("|"), redirects: "1" });
  const redirect = Object.fromEntries((res.query.redirects ?? []).map((r) => [r.to, r.from]));
  for (const p of res.query.pages ?? []) {
    const raw = p.pageprops?.infoboxes; if (!raw) continue;
    const fields = {};
    const walk = (node) => { if (!node) return; if (Array.isArray(node)) return node.forEach(walk);
      if (node.type === "data" && node.data?.source) fields[node.data.source] = strip(node.data.value);
      if (node.type === "group" && Array.isArray(node.data?.value)) walk(node.data.value);
      if (!node.type && Array.isArray(node.data)) walk(node.data); };
    try { walk(JSON.parse(raw)); } catch {}
    infobox[redirect[p.title] ?? p.title] = { doctor: fields.doctor, companions: fields.companions, featuring: fields.featuring, enemy: fields.enemy,
      setting: fields.setting, writer: fields.writer, director: fields.director, story: fields["story number"], code: fields["production code"],
      prev: fields.prev, next: fields.next };
  }
}

// ---- join timeline TV entries to TMDB stories by title
const clean = (p) => p.replace(/\s*\((TV story|audio story|novel|novelisation|comic story|short story|webcast|home video|video game)\)\s*$/i, "");
const tl = timelines.map((t) => ({ who: t.who, page: t.page, sections: t.sections.map((s) => ({ title: s.title, entries: s.entries.map((e) => {
  const title = clean(e.page); const st = e.medium === "TV" ? byKey.get(norm(title)) : undefined;
  return { medium: e.medium, title, fandomPage: e.page, tmdb: st?.id ?? null };
}) })) }));
const fandomByTmdb = {};
for (const t of tl) for (const s of t.sections) for (const e of s.entries) if (e.tmdb && infobox[e.fandomPage]) fandomByTmdb[e.tmdb] = infobox[e.fandomPage];

const out = { fetchedAt: new Date().toISOString(),
  sources: { tmdb: SHOWS.map((s) => `tv/${s.id}`).join(", "), fandom: TIMELINES.map((w) => `Theory:Timeline - ${w}`).join("; ") },
  shows, timelines: tl, fandomByTmdb };
writeFileSync(join(here, "data.json"), JSON.stringify(out));
for (const t of tl) { const all = t.sections.flatMap((s) => s.entries), tv = all.filter((e) => e.medium === "TV");
  console.log(`${t.who}: ${t.sections.length} eras, ${all.length} entries, ${tv.length} TV, ${tv.filter((e) => e.tmdb).length} matched to TMDB`); }
console.log(`TMDB: ${shows.map((s) => `${s.label} ${s.seasons.length} seasons`).join("; ")}; ${allStories.length} stories. Infoboxes: ${Object.keys(infobox).length}.`);
