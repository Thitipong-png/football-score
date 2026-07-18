import { mkdir, writeFile } from "node:fs/promises";

const API_ROOT = "https://api.football-data.org/v4";
const COMPETITION = "WC";
const SEASON = 2026;
const STOP_DATE_BANGKOK = "2026-07-22";
const DATA_SOURCE = "https://www.football-data.org/coverage";

const thaiNames = new Map([
  ["Argentina", "อาร์เจนตินา"], ["England", "อังกฤษ"], ["France", "ฝรั่งเศส"], ["Spain", "สเปน"],
  ["Brazil", "บราซิล"], ["Portugal", "โปรตุเกส"], ["Germany", "เยอรมนี"], ["United States", "สหรัฐอเมริกา"],
  ["USA", "สหรัฐอเมริกา"]
]);
const localCodes = new Map([
  ["Argentina", "argentina"], ["England", "england"], ["France", "france"], ["Spain", "spain"],
  ["Brazil", "brazil"], ["Portugal", "portugal"], ["Germany", "germany"], ["United States", "usa"], ["USA", "usa"]
]);
const liveStatuses = new Set(["IN_PLAY", "PAUSED"]);
const finishedStatuses = new Set(["FINISHED", "AWARDED"]);
const stageNames = new Map([
  ["FINAL", "รอบชิงชนะเลิศ"], ["THIRD_PLACE", "ชิงอันดับ 3"], ["SEMI_FINALS", "รอบรองชนะเลิศ"],
  ["QUARTER_FINALS", "รอบ 8 ทีมสุดท้าย"], ["LAST_16", "รอบ 16 ทีมสุดท้าย"], ["LAST_32", "รอบ 32 ทีมสุดท้าย"],
  ["GROUP_STAGE", "รอบแบ่งกลุ่ม"]
]);

function bangkokDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function thaiDateTime(value) {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).format(new Date(value)).replace(",", " ·");
}

async function fetchMatches() {
  const url = `${API_ROOT}/competitions/${COMPETITION}/matches?season=${SEASON}&dateFrom=2026-07-14&dateTo=2026-07-22`;
  const response = await fetch(url, { headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_TOKEN } });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`football-data.org ตอบกลับ HTTP ${response.status}: ${detail.slice(0, 300)}`);
  }
  const payload = await response.json();
  return payload.matches || [];
}

function matchStatus(item) {
  if (liveStatuses.has(item.status)) return "live";
  if (finishedStatuses.has(item.status)) return "finished";
  return "upcoming";
}

function statusText(item, status) {
  if (status === "live") return `LIVE · ${item.minute || 0}'`;
  if (status === "finished") return "จบการแข่งขัน";
  if (["POSTPONED", "CANCELLED", "SUSPENDED"].includes(item.status)) return item.status;
  return `${thaiDateTime(item.utcDate)} น.`;
}

function team(teamData, score) {
  const originalName = teamData.shortName || teamData.name;
  return {
    name: (teamData.tla || originalName).toUpperCase(),
    th: thaiNames.get(originalName) || thaiNames.get(teamData.name) || originalName,
    code: localCodes.get(originalName) || localCodes.get(teamData.name) || "world-cup",
    logo: teamData.crest || "",
    score: score ?? "–"
  };
}

function normalize(item) {
  const status = matchStatus(item);
  const venue = item.venue || "รอยืนยันสนาม";
  const stage = stageNames.get(item.stage) || item.stage?.replaceAll("_", " ") || "FIFA World Cup 2026";
  return {
    id: item.id,
    kickoff: item.utcDate,
    stage: `${stage} · ${venue}`,
    status,
    statusText: statusText(item, status),
    home: team(item.homeTeam, item.score?.fullTime?.home),
    away: team(item.awayTeam, item.score?.fullTime?.away),
    note: status === "finished" ? `${thaiDateTime(item.utcDate)} น. · เต็มเวลา` : status === "live" ? "กำลังแข่งขัน" : "เวลาไทย",
    homeScorers: [],
    awayScorers: [],
    venue,
    attendance: stage,
    source: DATA_SOURCE
  };
}

function prioritize(items) {
  const live = items.filter(item => item.status === "live").sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff));
  const upcoming = items.filter(item => item.status === "upcoming").sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff));
  const finished = items.filter(item => item.status === "finished").sort((a, b) => Date.parse(b.kickoff) - Date.parse(a.kickoff));
  const other = items.filter(item => !["live", "upcoming", "finished"].includes(item.status));
  const next = upcoming[0];
  const latest = finished[0];
  live.forEach(item => { item.featured = "กำลังแข่งขัน"; });
  if (next) next.featured = "แมตช์ถัดไป";
  if (latest) latest.featured = "ผลล่าสุด";
  return [...live, ...finished, ...upcoming, ...other];
}

async function main() {
  const today = bangkokDate();
  if (today >= STOP_DATE_BANGKOK) {
    console.log(`หยุดเรียก API แล้ว: วันที่ไทย ${today} ถึงกำหนด ${STOP_DATE_BANGKOK}`);
    return;
  }
  if (!process.env.FOOTBALL_DATA_TOKEN) throw new Error("ไม่พบ GitHub Secret: FOOTBALL_DATA_TOKEN");

  const rawMatches = await fetchMatches();
  if (!rawMatches.length) throw new Error("API ไม่ส่งข้อมูลการแข่งขันช่วงท้ายฟุตบอลโลกกลับมา");
  const matches = prioritize(rawMatches.map(normalize));

  await mkdir("data", { recursive: true });
  await writeFile("data/world-cup.json", JSON.stringify({
    updatedAt: new Date().toISOString(), source: "football-data.org free tier", stopDateBangkok: STOP_DATE_BANGKOK, matches
  }, null, 2) + "\n", "utf8");
  console.log(`อัปเดต ${matches.length} แมตช์สำเร็จ โดยใช้ API ฟรี 1 request`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
