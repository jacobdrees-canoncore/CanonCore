// PROTOTYPE, throwaway: fetches real TMDB data for the schema-structure prototype.
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
const token = readFileSync(`${homedir()}/.config/canoncore/tmdb-read-token`, 'utf8').trim();
const get = async (p) => { const r = await fetch(`https://api.themoviedb.org/3${p}`, { headers: { Authorization: `Bearer ${token}` } }); if (!r.ok) throw new Error(`${p} ${r.status}`); return r.json(); };
const img = (p, s = 'w185') => p ? `https://image.tmdb.org/t/p/${s}${p}` : null;
const show = async (id, seasons) => {
  const s = await get(`/tv/${id}`);
  const out = { id: `tmdb-tv-${id}`, name: s.name, year: (s.first_air_date || '').slice(0, 4), poster: img(s.poster_path), seasons: [] };
  for (const n of seasons) {
    const se = await get(`/tv/${id}/season/${n}`);
    out.seasons.push({ number: n, name: se.name, poster: img(se.poster_path), episodes: se.episodes.map(e => ({ id: `tmdb-ep-${e.id}`, n: e.episode_number, s: n, name: e.name, date: e.air_date, still: img(e.still_path, 'w300') })) });
  }
  return out;
};
const coll = await get('/collection/10');
const films = coll.parts.filter(p => p.release_date).sort((a, b) => a.release_date.localeCompare(b.release_date)).map(p => ({ id: `tmdb-movie-${p.id}`, name: p.title, date: p.release_date, poster: img(p.poster_path) }));
const data = {
  fetchedAt: new Date().toISOString(),
  friends: await show(1668, [1]),
  cloneWars: await show(4194, [1]),
  starWars: { id: 'tmdb-collection-10', name: coll.name, poster: img(coll.poster_path), films },
};
writeFileSync(new URL('./data.json', import.meta.url), JSON.stringify(data, null, 1));
console.log('friends eps', data.friends.seasons[0].episodes.length, 'clone wars eps', data.cloneWars.seasons[0].episodes.length, 'films', films.map(f => f.name).join(' | '));
