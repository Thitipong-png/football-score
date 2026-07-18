const fallbackPayload = {
  updatedAt: "2026-07-18T12:00:00.000Z",
  matches: [
    {
      id: 103, stage: "ชิงอันดับ 3 · Miami Stadium", status: "upcoming", statusText: "04:00 น. · 19 ก.ค.", featured: "แมตช์ถัดไป",
      home: { name: "FRANCE", th: "ฝรั่งเศส", code: "france", score: "–" },
      away: { name: "ENGLAND", th: "อังกฤษ", code: "england", score: "–" },
      note: "เวลาไทย", homeScorers: [], awayScorers: [], venue: "Miami Stadium, Miami", attendance: "แมตช์ที่ 103",
      source: "https://www.fifa.com/en/articles/france-v-england-live-stream-team-news-tickets-and-more"
    },
    {
      id: 102, stage: "รอบรองชนะเลิศ · Atlanta Stadium", status: "finished", statusText: "จบการแข่งขัน", featured: "ผลล่าสุด",
      home: { name: "ENGLAND", th: "อังกฤษ", code: "england", score: 1 },
      away: { name: "ARGENTINA", th: "อาร์เจนตินา", code: "argentina", score: 2 },
      note: "15 ก.ค. 2026 · เต็มเวลา", homeScorers: ["A. Gordon 55'"], awayScorers: ["E. Fernández 85'", "L. Martínez 90+2'"],
      venue: "Atlanta Stadium, Atlanta", attendance: "รอบรองชนะเลิศ", source: "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026"
    },
    {
      id: 104, stage: "รอบชิงชนะเลิศ · New York New Jersey Stadium", status: "upcoming", statusText: "02:00 น. · 20 ก.ค.",
      home: { name: "SPAIN", th: "สเปน", code: "spain", score: "–" },
      away: { name: "ARGENTINA", th: "อาร์เจนตินา", code: "argentina", score: "–" },
      note: "เวลาไทย", homeScorers: [], awayScorers: [], venue: "New York New Jersey Stadium", attendance: "รอบชิงชนะเลิศ · แมตช์ที่ 104",
      source: "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/final-live-watch-teams-tickets"
    },
    {
      id: 101, stage: "รอบรองชนะเลิศ · Dallas Stadium", status: "finished", statusText: "จบการแข่งขัน",
      home: { name: "FRANCE", th: "ฝรั่งเศส", code: "france", score: 0 },
      away: { name: "SPAIN", th: "สเปน", code: "spain", score: 2 },
      note: "14 ก.ค. 2026 · เต็มเวลา", homeScorers: [], awayScorers: ["M. Oyarzabal 22'", "P. Porro 58'"],
      venue: "Dallas Stadium, Arlington", attendance: "รอบรองชนะเลิศ", source: "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026"
    }
  ]
};

const grid = document.querySelector("#matchGrid");
const template = document.querySelector("#matchTemplate");
const modal = document.querySelector("#matchModal");
let matches = [];

const teamAsset = team => team.logo || `assets/${team.code || "world-cup"}.svg`;

function scorerMarkup(names) {
  return names.length ? names.map(name => `<p>${name} <span class="ball">⚽</span></p>`).join("") : "<p>—</p>";
}

function updateCounts() {
  document.querySelectorAll(".filter").forEach(button => {
    const filter = button.dataset.filter;
    const count = filter === "all" ? matches.length : matches.filter(match => match.status === filter).length;
    button.querySelector("span").textContent = count;
  });
}

function renderMatches() {
  grid.innerHTML = "";
  if (!matches.length) {
    grid.innerHTML = '<p class="data-message">ยังไม่มีข้อมูลการแข่งขันในขณะนี้</p>';
    return;
  }

  matches.forEach(match => {
    const card = template.content.firstElementChild.cloneNode(true);
    card.dataset.status = match.status;
    if (match.featured) {
      card.classList.add("featured");
      card.dataset.featuredLabel = match.featured;
    }
    card.querySelector(".stage").textContent = match.stage;
    const status = card.querySelector(".match-status");
    status.textContent = match.statusText;
    if (match.status === "live") status.classList.add("live");

    const home = card.querySelector(".home-team");
    home.querySelector(".crest img").src = teamAsset(match.home);
    home.querySelector(".crest img").alt = `ตราทีมชาติ${match.home.th}`;
    home.querySelector("h3").textContent = match.home.name;
    home.querySelector("small").textContent = match.home.th;
    const away = card.querySelector(".away-team");
    away.querySelector(".crest img").src = teamAsset(match.away);
    away.querySelector(".crest img").alt = `ตราทีมชาติ${match.away.th}`;
    away.querySelector("h3").textContent = match.away.name;
    away.querySelector("small").textContent = match.away.th;

    const scores = card.querySelectorAll(".score b");
    scores[0].textContent = match.home.score;
    scores[1].textContent = match.away.score;
    card.querySelector(".score-note").textContent = match.note;
    card.querySelector(".scorers").innerHTML = `<div>${scorerMarkup(match.homeScorers)}</div><div>${scorerMarkup(match.awayScorers)}</div>`;
    card.querySelector(".details-btn").addEventListener("click", () => openModal(match));
    grid.appendChild(card);
  });
  updateCounts();
}

function openModal(match) {
  const events = [
    ...match.homeScorers.map(item => ({ item, team: match.home.th })),
    ...match.awayScorers.map(item => ({ item, team: match.away.th }))
  ];
  document.querySelector("#modalContent").innerHTML = `
    <div class="modal-hero">
      <div class="stage">${match.stage}</div>
      <div class="modal-teams">
        <div><div class="crest"><img src="${teamAsset(match.home)}" alt="ตราทีมชาติ${match.home.th}"></div><h3>${match.home.name}</h3></div>
        <div><div class="modal-score">${match.home.score} – ${match.away.score}</div><small>${match.statusText}</small></div>
        <div><div class="crest"><img src="${teamAsset(match.away)}" alt="ตราทีมชาติ${match.away.th}"></div><h3>${match.away.name}</h3></div>
      </div>
    </div>
    <div class="modal-body">
      <h4 id="modalTitle">เหตุการณ์สำคัญ</h4>
      ${events.length ? events.map(event => {
        const minute = event.item.match(/(\d+(?:\+\d+)?')/)?.[0] || "—";
        const player = event.item.replace(minute, "").trim();
        return `<div class="event"><time>${minute}</time><div>⚽ <b>${player}</b><br><small>${event.team}</small></div></div>`;
      }).join("") : '<div class="event"><time>—</time><div>ยังไม่มีเหตุการณ์สำคัญ</div></div>'}
      <div class="venue"><span>📍 ${match.venue}</span><span>${match.attendance}</span></div>
      <a class="source-link" href="${match.source}" target="_blank" rel="noopener">ตรวจสอบข้อมูลจาก FIFA ↗</a>
    </div>`;
  modal.hidden = false;
  document.body.classList.add("modal-open");
  modal.querySelector(".modal-close").focus();
}

function closeModal() {
  modal.hidden = true;
  document.body.classList.remove("modal-open");
}

document.querySelectorAll(".filter").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelector(".filter.active").classList.remove("active");
    button.classList.add("active");
    const filter = button.dataset.filter;
    document.querySelectorAll(".match-card").forEach(card => {
      card.hidden = filter !== "all" && card.dataset.status !== filter;
    });
  });
});

modal.addEventListener("click", event => {
  if (event.target.matches("[data-close-modal]")) closeModal();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !modal.hidden) closeModal();
});

async function loadMatches() {
  let payload = fallbackPayload;
  if (location.protocol !== "file:") {
    try {
      const response = await fetch(`data/world-cup.json?t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      payload = await response.json();
    } catch (error) {
      console.warn("ใช้ข้อมูลสำรอง เนื่องจากโหลดข้อมูลล่าสุดไม่ได้", error);
    }
  }
  matches = payload.matches || [];
  const updated = new Date(payload.updatedAt);
  document.querySelector("#updatedTime").textContent = Number.isNaN(updated.getTime())
    ? "รอการอัปเดต"
    : updated.toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" }) + " น.";
  renderMatches();
}

loadMatches();
