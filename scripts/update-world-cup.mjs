import { mkdir, writeFile } from "node:fs/promises";

const API_ROOT = "https://v3.football.api-sports.io";
const LEAGUE_ID = 1;
const SEASON = 2026;
const STOP_DATE_BANGKOK = "2026-07-22";
const FIFA_SOURCE = "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026";

const thaiNames = new Map([
  ["Argentina", "อาร์เจนตินา"], ["England", "อังกฤษ"], ["France", "ฝรั่งเศส"], ["Spain", "สเปน"],
  ["Brazil", "บราซิล"], ["Portugal", "โปรตุเกส"], ["Germany", "เยอรมนี"], ["USA", "สหรัฐอเมริกา"]
]);
const localCodes = new Map([
  ["Argentina", "argentina"], ["England", "england"], ["France", "france"], ["Spain", "spain"],
  ["Brazil", "brazil"], ["Portugal", "portugal"], ["Germany", "germany"], ["USA", "usa"]
]);
const liveCodes = new Set(["1H", "HT", "2H", "ET", "BT", "P", "INT", "LIVE"]);
const finishedCodes = new Set(["FT", "AET", "PEN"]);

function bangkokDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function thaiDateTime(value) {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).format(new Date(value)).replace(",", " ·");
}

async function api(path) {
  const response = await fetch(`${API_ROOT}${path}`, { headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY } });
  if (!response.ok) throw new Error(`API-Football ตอบกลับ HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.errors && Object.keys(payload.errors).length) throw new Error(`API-Football error: ${JSON.stringify(payload.errors)}`);
  return payload.response || [];
}

function matchStatus(item) {
  const code = item.fixture.status.short;
  if (liveCodes.has(code)) return "live";
  if (finishedCodes.has(code)) return "finished";
  return "upcoming";
}

function statusText(item, status) {
  if (status === "live") return `LIVE · ${item.fixture.status.elapsed || 0}'`;
  if (status === "finished") return "จบการแข่งขัน";
  if (["PST", "CANC", "SUSP"].includes(item.fixture.status.short)) return item.fixture.status.long;
  return `${thaiDateTime(item.fixture.date)} น.`;
}

function team(teamData, score) {
  return {
    name: teamData.name.toUpperCase(), th: thaiNames.get(teamData.name) || teamData.name,
    code: localCodes.get(teamData.name) || "world-cup", logo: teamData.logo || "", score: score ?? "–"
  };
}

function goalText(event) {
  const minute = `${event.time.elapsed}${event.time.extra ? `+${event.time.extra}` : ""}'`;
  return `${event.player?.name || "ไม่ระบุชื่อ"} ${minute}`;
}

function normalize(item) {
  const status = matchStatus(item);
  const goals = (item.events || []).filter(event => event.type === "Goal" && event.detail !== "Missed Penalty");
  const homeGoals = goals.filter(event => event.team?.id === item.teams.home.id).map(goalText);
  const awayGoals = goals.filter(event => event.team?.id === item.teams.away.id).map(goalText);
  const venue = [item.fixture.venue?.name, item.fixture.venue?.city].filter(Boolean).join(", ") || "รอยืนยันสนาม";
  return {
    id: item.fixture.id,
    kickoff: item.fixture.date,
    stage: `${item.league.round || "FIFA World Cup 2026"} · ${item.fixture.venue?.name || "Venue TBC"}`,
    status,
    statusText: statusText(item, status),
    home: team(item.teams.home, item.goals.home),
    away: team(item.teams.away, item.goals.away),
    note: status === "finished" ? `${thaiDateTime(item.fixture.date)} น. · เต็มเวลา` : status === "live" ? item.fixture.status.long : "เวลาไทย",
    homeScorers: homeGoals,
    awayScorers: awayGoals,
    venue,
    attendance: item.league.round || "FIFA World Cup 2026",
    source: FIFA_SOURCE
  };
}

function prioritize(items) {
  const now = Date.now();
  const live = items.filter(item => item.status === "live").sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff));
  const upcoming = items.filter(item => item.status === "upcoming").sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff));
  const finished = items.filter(item => item.status === "finished").sort((a, b) => Date.parse(b.kickoff) - Date.parse(a.kickoff));
  const next = upcoming.find(item => Date.parse(item.kickoff) >= now) || upcoming[0];
  const latest = finished[0];
  if (live[0]) live[0].featured = "กำลังแข่งขัน";
  else if (next) next.featured = "แมตช์ถัดไป";
  if (latest) latest.featured = "ผลล่าสุด";
  const pinned = [live[0] || next, latest].filter(Boolean);
  return [...pinned, ...items.filter(item => !pinned.includes(item)).sort((a, b) => Date.parse(b.kickoff) - Date.parse(a.kickoff))];
}

async function main() {
  const today = bangkokDate();
  if (today >= STOP_DATE_BANGKOK) {
    console.log(`หยุดเรียก API แล้ว: วันที่ไทย ${today} ถึงกำหนด ${STOP_DATE_BANGKOK}`);
    return;
  }
  if (!process.env.API_FOOTBALL_KEY) throw new Error("ไม่พบ GitHub Secret: API_FOOTBALL_KEY");

  const list = await api(`/fixtures?league=${LEAGUE_ID}&season=${SEASON}&from=2026-07-14&to=2026-07-21&timezone=Asia%2FBangkok`);
  if (!list.length) throw new Error("API ไม่ส่งข้อมูลการแข่งขันช่วงท้ายฟุตบอลโลกกลับมา");
  const ids = list.map(item => item.fixture.id).slice(0, 20).join("-");
  const details = await api(`/fixtures?ids=${ids}&timezone=Asia%2FBangkok`);
  const matches = prioritize(details.map(normalize));

  await mkdir("data", { recursive: true });
  await writeFile("data/world-cup.json", JSON.stringify({
    updatedAt: new Date().toISOString(), source: "API-Football league 1 season 2026", stopDateBangkok: STOP_DATE_BANGKOK, matches
  }, null, 2) + "\n", "utf8");
  console.log(`อัปเดต ${matches.length} แมตช์สำเร็จ โดยใช้ API 2 requests`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
