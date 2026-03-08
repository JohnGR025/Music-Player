const audio = document.getElementById("audio");
const openBtn = document.getElementById("openBtn");
const playBtn = document.getElementById("playBtn");
const pauseBtn = document.getElementById("pauseBtn");
const seek = document.getElementById("seek");
const vol = document.getElementById("vol");
const title = document.getElementById("title");
const timeEl = document.getElementById("time");

function pad2(n) { return String(n).padStart(2, "0"); }
function fmtTime(sec) {
  if (!Number.isFinite(sec)) return "0:00";
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${pad2(s)}`;
}

openBtn.addEventListener("click", async () => {
  const filePath = await window.api.openAudioFile();
  if (!filePath) return; //Error

  const fileUrl = `file:///${filePath.replace(/\\/g, "/")}`;
  audio.src = fileUrl;

  title.textContent = filePath.split("\\").pop();
  await audio.play();
});

playBtn.addEventListener("click", () => audio.play());
pauseBtn.addEventListener("click", () => audio.pause());

vol.addEventListener("input", () => {
  audio.volume = parseFloat(vol.value);
});

audio.addEventListener("timeupdate", () => {
  if (!Number.isFinite(audio.duration) || audio.duration === 0) return;
  seek.value = String((audio.currentTime / audio.duration) * 100);
  timeEl.textContent = `${fmtTime(audio.currentTime)} / ${fmtTime(audio.duration)}`;
});

seek.addEventListener("input", () => {
  if (!Number.isFinite(audio.duration) || audio.duration === 0) return;
  audio.currentTime = (parseFloat(seek.value) / 100) * audio.duration;
});
