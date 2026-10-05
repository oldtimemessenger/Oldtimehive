import { icon } from "./icons.js";

const groups = [
  ["Smileys", "Faces and feelings", "😀 😃 😄 😁 😆 😅 😂 🤣 🥲 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥸 🤩 🥳 😏 😒 😞 😔 😟 😕 🙁 ☹️ 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🫣 🤭 🫢 🫡 🤫 🫠 🤥 😶 😶‍🌫️ 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😮‍💨 😵 😵‍💫 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕 🤑 🤠 😈 👿 👻 💀 ☠️ 👽 🤖 💩"],
  ["People", "People and gestures", "👋 🤚 🖐️ ✋ 🖖 🫶 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 🖕 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🙏 ✍️ 💅 🤳 💪 🦵 🦶 👂 👃 👶 👧 🧒 👦 👩 🧑 👨 👵 🧓 👴 🙍 🙎 🙅 🙆 💁 🙋 🧏 🙇 🤦 🤷 👮 👷 💂 🕵️ 👩‍⚕️ 👨‍⚕️ 👩‍🎓 👨‍🎓 👩‍💻 👨‍💻 👩‍🚀 👨‍🚀 🧕 👳 🧔 👱 🤰 🤱 👼 🎅 🤶 🧑‍🎄 🦸 🦹 🧙 🧚 🧛 🧜 🧝 🧞 🧟 💆 💇 🚶 🧍 🧎 🏃 💃 🕺 🧘 🏄 🏊 🚴 🏋️ 🤸 👩‍❤️‍👨 👩‍❤️‍👩 👨‍❤️‍👨 👨‍👩‍👧‍👦 👩‍👩‍👦 👨‍👨‍👧"],
  ["Nature", "Animals and nature", "🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐻‍❄️ 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐔 🐧 🐦 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🐛 🦋 🐌 🐞 🐜 🪲 🕷️ 🦂 🐢 🐍 🦎 🦖 🦕 🐙 🦑 🦐 🦞 🦀 🐠 🐟 🐬 🐳 🦈 🐊 🐘 🦒 🦓 🦍 🦧 🦣 🐪 🦙 🐑 🐐 🦌 🐕 🐈 🐓 🦃 🦚 🦜 🦢 🦩 🕊️ 🐇 🦝 🦨 🦡 🦦 🦥 🐁 🐿️ 🦔 🌵 🎄 🌲 🌳 🌴 🪴 🌱 🌿 ☘️ 🍀 🎍 🎋 🍃 🍂 🍁 🍄 🐚 🌾 💐 🌷 🌹 🥀 🌺 🌸 🌼 🌻 🌞 🌝 🌛 🌜 🌚 🌕 🌙 ⭐ 🌟 ✨ ⚡ ☄️ 💥 🔥 🌈 ☀️ 🌤️ ☁️ 🌧️ ⛈️ ❄️ ☃️ 💨 💧 🌊"],
  ["Food", "Food and drink", "🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🍆 🥑 🥦 🥬 🥒 🌶️ 🫑 🌽 🥕 🫒 🧄 🧅 🥔 🍠 🥐 🥯 🍞 🥖 🥨 🧀 🥚 🍳 🧈 🥞 🧇 🥓 🥩 🍗 🍖 🌭 🍔 🍟 🍕 🫓 🥪 🥙 🧆 🌮 🌯 🫔 🥗 🥘 🫕 🍝 🍜 🍲 🍛 🍣 🍱 🥟 🦪 🍤 🍙 🍚 🍘 🍥 🥠 🥮 🍢 🍡 🍧 🍨 🍦 🥧 🧁 🍰 🎂 🍮 🍭 🍬 🍫 🍿 🍩 🍪 🌰 🥜 🍯 🥛 🍼 ☕ 🍵 🧃 🥤 🧋 🍶 🍺 🍻 🥂 🍷 🥃 🍸 🍹 🍾 🧊"],
  ["Activities", "Sports and celebrations", "⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🥏 🎱 🏓 🏸 🏒 🏑 🥍 🏏 🥅 ⛳ 🪁 🏹 🎣 🤿 🥊 🥋 🎽 🛹 🛼 🛷 ⛸️ 🥌 🎿 ⛷️ 🏂 🪂 🏆 🥇 🥈 🥉 🏅 🎖️ 🎗️ 🎫 🎟️ 🎪 🤹 🎭 🩰 🎨 🎬 🎤 🎧 🎼 🎹 🥁 🎷 🎺 🎸 🪕 🎻 🎲 ♟️ 🎯 🎳 🎮 🎰 🧩 🎉 🎊 🎈 🎁 🎀 🪅 🪩"],
  ["Travel", "Travel and places", "🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚒 🚐 🛻 🚚 🚛 🚜 🛵 🏍️ 🛺 🚲 🛴 🚨 🚔 🚍 🚘 🚖 🚡 🚠 🚟 🚃 🚋 🚞 🚝 🚄 🚅 🚈 🚂 🚆 🚇 🚊 🚉 ✈️ 🛫 🛬 🛩️ 💺 🛰️ 🚀 🛸 🚁 🛶 ⛵ 🚤 🛥️ 🛳️ ⛴️ 🚢 ⚓ 🛟 🗺️ 🗿 🗽 🗼 🏰 🏯 🏟️ 🎡 🎢 🎠 ⛲ ⛱️ 🏖️ 🏝️ 🏜️ 🌋 ⛰️ 🏔️ 🗻 🏕️ 🛖 🏠 🏡 🏘️ 🏚️ 🏗️ 🏭 🏢 🏬 🏣 🏥 🏦 🏨 🏪 🏫 🏩 💒 🏛️ ⛪ 🕌 🕍 🛕 🕋 ⛩️ 🛤️ 🛣️ 🌅 🌄 🌠 🎇 🎆 🌇 🌆 🏙️ 🌃 🌌 🌉"],
  ["Objects", "Objects and tools", "⌚ 📱 💻 ⌨️ 🖥️ 🖨️ 🖱️ 💽 💾 💿 📀 📷 📸 📹 🎥 📞 ☎️ 📺 📻 🎙️ 🎚️ ⏱️ ⏰ ⌛ 🔋 🔌 💡 🔦 🕯️ 🧯 🛢️ 💸 💵 💴 💶 💷 🪙 💰 💳 💎 ⚖️ 🧰 🔧 🔨 ⚒️ 🛠️ ⛏️ 🪛 🔩 ⚙️ 🧱 ⛓️ 🧲 🪜 🧪 🧫 🧬 🔬 🔭 📡 💉 💊 🩹 🩺 🚪 🪞 🪟 🛏️ 🛋️ 🪑 🚽 🚿 🛁 🧴 🪥 🧹 🧺 🧻 🪣 🧼 🧽 🛍️ 🛒 🎒 👜 👛 👝 🧳 🌂 ☂️ 🧵 🪡 🧶 👓 🕶️ 🥽 🥼 🦺 👔 👕 👖 🧣 🧤 🧥 🧦 👗 👚 👙 👟 👞 👠 👡 👢 👑 💍 💄 📚 📖 📝 ✏️ 🖊️ 📌 📍 📎 ✂️ 🔒 🔓 🔑 🗝️ 📧 ✉️ 📦"],
  ["Symbols", "Hearts and symbols", "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 🩷 🩵 🩶 💔 ❤️‍🔥 ❤️‍🩹 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ☮️ ✝️ ☪️ 🕉️ ☸️ ✡️ 🔯 🕎 ☯️ ☦️ 🛐 ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ 🆔 ⚛️ 🈳 🈹 🈺 🈯 ✅ ☑️ ✔️ ❌ ❎ ➕ ➖ ➗ ✖️ ♾️ 💯 🔱 ⚜️ 🔔 🔕 📣 📢 💬 💭 🗯️ ♠️ ♣️ ♥️ ♦️ 🃏 🎴 🀄 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🟤 🔺 🔻 🔸 🔹 🔶 🔷 🔳 🔲 ▪️ ▫️ ◼️ ◻️ ⬛ ⬜ 🟧 🟨 🟩 🟦 🟪 🟥 🟫 🆘 🆕 🆗 🆒 🆓 🔝 🔜 🔙 🔚 🔛"],
];
const codes = "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW EU UN";
const names = typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
const entries = groups.flatMap(([category, label, list]) => list.split(" ").map(emoji => ({ emoji, category, name: `${label} ${emoji}` })));
entries.push(...codes.split(" ").map(code => ({ emoji: [...code].map(c => String.fromCodePoint(c.charCodeAt(0) + 127397)).join(""), category: "Flags", name: `${names?.of(code) || code} flag ${code}` })));
entries.push(...["🏳️", "🏴", "🏁", "🚩", "🏳️‍🌈", "🏳️‍⚧️", "🏴‍☠️"].map(emoji => ({ emoji, category: "Flags", name: `Special flag ${emoji}` })));
const tones = ["", "🏻", "🏼", "🏽", "🏾", "🏿"];
const toneable = new Set(groups[1][2].split(" ").filter(e => !e.includes("\u200d") && /\p{Emoji_Modifier_Base}/u.test(e)));
let closePicker = null;

export function closeEmojiPicker() { closePicker?.(); }

export function openEmojiPicker(target, onChange = () => {}) {
  closeEmojiPicker();
  let recent = [];
  try { recent = JSON.parse(localStorage.getItem("oldtime-emojis") || "[]").filter(e => typeof e === "string").slice(0, 32); } catch { /* storage unavailable */ }
  const layer = document.createElement("div");
  layer.className = "emoji-overlay";
  layer.innerHTML = `<section class="emoji-panel" role="dialog" aria-modal="true" aria-label="Emoji picker">
    <div class="row"><b>Emoji</b><button class="icon emoji-close" aria-label="Close emoji picker">${icon("close")}</button></div>
    <input class="field emoji-search" type="search" aria-label="Search emoji" placeholder="Search categories, country names, or emoji" />
    <div class="emoji-categories" role="tablist" aria-label="Emoji categories"></div>
    <label class="emoji-tone">Skin tone <select aria-label="Skin tone">${tones.map((tone, i) => `<option value="${i}">${tone || "Default"}</option>`).join("")}</select></label>
    <div class="emoji-grid" aria-live="polite"></div>
  </section>`;
  document.body.appendChild(layer);
  const previous = document.activeElement;
  const start = target.selectionStart ?? target.value.length;
  const end = target.selectionEnd ?? start;
  let cursor = start;
  let replaceEnd = end;
  let category = recent.length ? "Recent" : "Smileys";
  const search = layer.querySelector("input");
  const grid = layer.querySelector(".emoji-grid");
  const tabs = layer.querySelector(".emoji-categories");
  const tone = layer.querySelector("select");
  const close = () => { layer.remove(); document.removeEventListener("keydown", keydown); closePicker = null; if (target.isConnected) { target.focus(); target.setSelectionRange(cursor, cursor); } else previous?.focus(); };
  const keydown = e => {
    if (e.key === "Escape") { e.preventDefault(); close(); }
    if (e.key === "Tab") {
      const focusable = [...layer.querySelectorAll("button, input, select")];
      const first = focusable[0], last = focusable.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  closePicker = close;
  const draw = () => {
    tabs.replaceChildren();
    ["Recent", ...groups.map(g => g[0]), "Flags"].forEach(label => {
      const button = document.createElement("button");
      button.textContent = label;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", String(label === category));
      button.onclick = () => { category = label; search.value = ""; draw(); };
      tabs.appendChild(button);
    });
    const q = search.value.trim().toLowerCase();
    const source = q ? entries.filter(e => e.name.toLowerCase().includes(q) || e.category.toLowerCase().includes(q)) : category === "Recent" ? recent.map(emoji => ({ emoji, name: emoji })) : entries.filter(e => e.category === category);
    grid.replaceChildren();
    source.forEach(entry => {
      const selectedTone = tones[Number(tone.value)];
      const emoji = selectedTone && toneable.has(entry.emoji) ? entry.emoji.replace("\ufe0f", "") + selectedTone : entry.emoji;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "emoji";
      button.textContent = emoji;
      button.title = entry.name;
      button.setAttribute("aria-label", entry.name);
      button.onclick = () => {
        target.setRangeText(emoji, cursor, replaceEnd, "end");
        cursor = target.selectionEnd;
        replaceEnd = cursor;
        target.dispatchEvent(new Event("input", { bubbles: true }));
        onChange(target.value);
        recent = [emoji, ...recent.filter(e => e !== emoji)].slice(0, 32);
        try { localStorage.setItem("oldtime-emojis", JSON.stringify(recent)); } catch { /* storage unavailable */ }
      };
      grid.appendChild(button);
    });
    if (!source.length) grid.textContent = category === "Recent" && !q ? "Your recently used emoji will appear here." : "No emoji found.";
  };
  search.oninput = draw;
  tone.onchange = draw;
  layer.querySelector(".emoji-close").onclick = close;
  layer.onclick = e => { if (e.target === layer) close(); };
  document.addEventListener("keydown", keydown);
  draw();
  search.focus();
}
