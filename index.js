import { extension_settings } from "../../../extensions.js";
// เปลี่ยนบรรทัด import เดิมให้เป็นแบบนี้ครับ
import { saveSettingsDebounced, eventSource, event_types, reloadCurrentChat } from "../../../../script.js";

const extensionName = "chat-simulator";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

// ชุดข้อมูลสีสำหรับแต่ละธีม
const themes = {
    default: {
        '--chatsim-bg-left': '#f0f2f5',
        '--chatsim-text-left': '#1c1e21',
        '--chatsim-bg-right': '#0084ff',
        '--chatsim-text-right': '#ffffff'
    },
    line: {
        '--chatsim-bg-left': '#ffffff',
        '--chatsim-text-left': '#000000',
        '--chatsim-bg-right': '#00c300',
        '--chatsim-text-right': '#ffffff'
    },
    dark: {
        '--chatsim-bg-left': '#3a3b3c',
        '--chatsim-text-left': '#e4e6eb',
        '--chatsim-bg-right': '#005cc8',
        '--chatsim-text-right': '#ffffff'
    },
    // --- ธีมใหม่ที่เพิ่มเข้ามา ---
    mocha: {
        '--chatsim-bg-left': '#f5f0ec',     /* สีครีมอ่อนๆ สำหรับฝั่งซ้าย */
        '--chatsim-text-left': '#4a3b32',   /* สีน้ำตาลเข้มสำหรับตัวหนังสือ */
        '--chatsim-bg-right': '#cdb4a0',    /* สีน้ำตาลที่คุณเลือก สำหรับฝั่งขวา */
        '--chatsim-text-right': '#4a3b32'   /* สีขาวสำหรับตัวหนังสือ */
    },
    monochrome: {
        '--chatsim-bg-left': '#f5f5f5',     /* สีเทาอ่อนมาก */
        '--chatsim-text-left': '#333333',   /* สีเทาเกือบดำ */
        '--chatsim-bg-right': '#d1d1d1',    /* สีเทากลางๆ */
        '--chatsim-text-right': '#333333'   /* สีขาว */
    },
    pastel: {
        '--chatsim-bg-left': '#fff0f5',     /* สีชมพูพาสเทลอ่อนๆ */
        '--chatsim-text-left': '#5c4d5a',   /* สีตัวหนังสือโทนตุ่นๆ */
        '--chatsim-bg-right': '#dbf1ff',    /* สีม่วง/ฟ้าพาสเทล */
        '--chatsim-text-right': '#5c4d5a'   /* ใช้ตัวหนังสือสีเข้มเพื่อให้เด่นบนพื้นพาสเทล */
    }
};

const defaultSettings = {
    enabled: true, // <-- เพิ่มตรงนี้
    stickers: [],
    showAvatars: true,
    theme: 'default'
};

function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    if (Object.keys(extension_settings[extensionName]).length === 0) {
        Object.assign(extension_settings[extensionName], defaultSettings);
    }
    // เช็คค่าเก่าเผื่อยังไม่มี
    if (extension_settings[extensionName].enabled === undefined) {
        extension_settings[extensionName].enabled = true;
    }
    if (!extension_settings[extensionName].stickers) {
        extension_settings[extensionName].stickers = [];
    }
    if (extension_settings[extensionName].showAvatars === undefined) {
        extension_settings[extensionName].showAvatars = true;
    }
    if (!extension_settings[extensionName].theme) {
        extension_settings[extensionName].theme = 'default';
    }

    // อัปเดต UI ให้ตรงกับค่าที่เซฟไว้
    $("#chat-simulator-enable").prop("checked", extension_settings[extensionName].enabled); // <-- เพิ่มตรงนี้
    $("#chat-simulator-show-avatars").prop("checked", extension_settings[extensionName].showAvatars);
    $("#chat-simulator-theme-select").val(extension_settings[extensionName].theme);

    applyTheme(extension_settings[extensionName].theme);
}

// --- NEW: ฟังก์ชันสำหรับเปลี่ยนตัวแปร CSS ---
function applyTheme(themeName) {
    const selectedTheme = themes[themeName] || themes.default;
    const root = document.documentElement; // เข้าถึง :root

    // วนลูปเปลี่ยนค่าตัวแปร CSS ตามชุดข้อมูลที่เลือก
    for (const [property, value] of Object.entries(selectedTheme)) {
        root.style.setProperty(property, value);
    }
}

function renderStickerList() {
    const container = $("#chat-simulator-sticker-list");
    container.empty();
    const stickers = extension_settings[extensionName].stickers;

    if (stickers.length === 0) {
        container.append("<p><small>ยังไม่มีสติกเกอร์ เพิ่มเลย!</small></p>");
        return;
    }

    stickers.forEach((sticker, index) => {
        const itemHtml = `
            <div class="sticker-item" style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px; padding: 5px; background: rgba(0,0,0,0.1); border-radius: 5px;">
                <img src="${sticker.url}" alt="${sticker.name}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 5px;" onerror="this.src=''">
                <div style="flex-grow: 1;">
                    <b>::${sticker.name}::</b>
                </div>
                <div class="menu_button red sticker-delete-btn" data-index="${index}">
                    <i class="fa-solid fa-trash"></i>
                </div>
            </div>
        `;
        container.append(itemHtml);
    });

    $(".sticker-delete-btn").on("click", function () {
        const idx = $(this).data("index");
        extension_settings[extensionName].stickers.splice(idx, 1);
        saveSettingsDebounced();
        renderStickerList();
        processStickersInDOM(); // อัปเดตแชททันทีเมื่อลบ
    });
}

function onAddStickerClick() {
    const nameInput = $("#chat-simulator-sticker-name").val().trim();
    const urlInput = $("#chat-simulator-sticker-url").val().trim();

    if (!nameInput || !urlInput) {
        toastr.warning("กรุณากรอกชื่อและลิงก์รูปภาพให้ครบถ้วน", "Chat Simulator");
        return;
    }

    const isDuplicate = extension_settings[extensionName].stickers.some(s => s.name === nameInput);
    if (isDuplicate) {
        toastr.warning(`ชื่อสติกเกอร์ ::${nameInput}:: มีอยู่แล้ว`, "Chat Simulator");
        return;
    }

    // Escape regex characters just in case (ป้องกันอักขระพิเศษทำระบบพัง)
    const safeName = nameInput.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    extension_settings[extensionName].stickers.push({ name: safeName, url: urlInput });
    saveSettingsDebounced();

    $("#chat-simulator-sticker-name").val("");
    $("#chat-simulator-sticker-url").val("");

    renderStickerList();
    processStickersInDOM(); // อัปเดตแชททันทีเมื่อเพิ่ม
    toastr.success("เพิ่มสติกเกอร์แล้ว", "Chat Simulator");
}

// --- อัปเดต: ฟังก์ชันรวมมิตร (Chat UI + Media + Stickers) เวอร์ชันจัดระเบียบขั้นสุด ---
function processChatUIInDOM() {
    const showAvatars = extension_settings[extensionName].showAvatars;
    const stickers = extension_settings[extensionName].stickers || [];

    $(".mes").each(function() {
        const isUser = $(this).attr('is_user') === 'true';
        const mesTextContainer = $(this).find('.mes_text');

        let avatarUrl = $(this).find('.avatar img, .mes_avatar img').attr('src');
        if (!avatarUrl) {
            const avatarAttr = $(this).attr('avatar');
            if (avatarAttr) avatarUrl = `/characters/${avatarAttr}`;
        }
        if (!avatarUrl && isUser) avatarUrl = '/User Avatars/user.png';

        const fallbackAvatar = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>";

        const getAvatarHtml = () => {
            if (!showAvatars) return '';
            return `<img src="${avatarUrl}" class="chat-sim-bubble-avatar" onerror="this.onerror=null; this.src='${fallbackAvatar}'; this.style.backgroundColor='#cccccc';">`;
        };

        let html = mesTextContainer.html();
        if (!html) return;

        let modified = false;
        const senderName = isUser ? 'คุณ' : ($(this).attr('ch_name') || 'ตัวละคร');

        // [ขั้นที่ 1] ติดป้าย 'chat-sim-raw-media' ให้กับของเล่นทุกชิ้น

        // Stickers
        stickers.forEach(sticker => {
            const regex = new RegExp(`::${sticker.name}::`, 'g');
            if (regex.test(html)) {
                const imgHtml = `<img src="${sticker.url}" class="chat-sim-sticker chat-sim-raw-media" alt="${sticker.name}" title="${sticker.name}">`;
                html = html.replace(regex, imgHtml);
                modified = true;
            }
        });

        // [IMG]
        const imgRegex = /\[IMG\](.*?)\[\/IMG\]/g;
        if (imgRegex.test(html)) {
            html = html.replace(imgRegex, `<img src="$1" class="chat-sim-media chat-sim-raw-media" alt="image" onerror="this.style.display='none'">`);
            modified = true;
        }

        // [GIFT]
        const giftRegex = /\[GIFT:(open|closed)\](.*?)\[\/GIFT\]/g;
        if (giftRegex.test(html)) {
            html = html.replace(giftRegex, (match, status, amount) => {
                const isOpen = status === 'open';
                const openedHtml = `<div class="chat-sim-new-gift-opened" ${!isOpen ? 'style="display: none;"' : ''}><div class="gift-open-strip"></div><div class="gift-open-content"><div class="gift-open-icon">🧧</div><span style="font-size: 12px; color: #795548; margin-top: 5px;">คุณได้รับอั่งเปาแล้ว</span><div style="font-size: 20px; font-weight: 700; color: #d32f2f;">${amount}</div><span style="font-size: 10px; color: #9e9e9e;">โอนเข้าธนาคารเรียบร้อย</span></div></div>`;
                const closedHtml = `<div class="chat-sim-new-gift-closed" onclick="$(this).hide(); $(this).siblings('.chat-sim-new-gift-opened').fadeIn(300);"><div class="gift-decor"></div><div class="gift-content"><div class="gift-icon">🧧</div><div style="display: flex; flex-direction: column;"><span style="font-size: 15px; font-weight: 600; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.1);">อั่งเปาของขวัญ</span><span style="font-size: 12px; color: #ffecb3;">กดเพื่อเปิดซองของขวัญ</span></div></div><div class="gift-footer"><span>${senderName} ส่งของขวัญให้คุณ</span><span style="color: #fff;">>></span></div></div>`;
                return `<div class="angpao-wrapper chat-sim-raw-media">${isOpen ? openedHtml : closedHtml + openedHtml}</div>`;
            });
            modified = true;
        }

        // [SLIP]
        const slipRegex = /\[SLIP:(.*?)\](.*?)\[\/SLIP\]/g;
        if (slipRegex.test(html)) {
            html = html.replace(slipRegex, (match, name, amount) => {
                return `<div class="chat-sim-new-slip chat-sim-raw-media"><div class="slip-header"><div class="slip-icon"><i class="fa-solid fa-building-columns"></i></div><p style="margin: 0; font-size: 14px; color: #555;">โอนเงินสำเร็จ</p><p style="margin: 5px 0 0; font-size: 24px; font-weight: 600;">฿${amount}</p></div><div class="slip-details"><div class="slip-row"><span style="color: #888;">จาก</span><span style="font-weight: 500;">${senderName}</span></div><div class="slip-row"><span style="color: #888;">ไปยัง</span><span style="font-weight: 500;">${name}</span></div></div></div>`;
            });
            modified = true;
        }

        // [LOC]
        const locRegex = /\[LOC:(.*?)\](.*?)\[\/LOC\]/g;
        if (locRegex.test(html)) {
            html = html.replace(locRegex, (match, name, desc) => {
                return `<div class="chat-sim-new-loc chat-sim-raw-media"><div class="loc-map"><div class="loc-grid"></div><div class="loc-pin"><div class="loc-pin-dot"></div></div></div><div style="padding: 12px;"><p style="margin: 0; font-size: 14px; font-weight: 600;">${name}</p><p style="margin: 4px 0 0; font-size: 11px; color: #777; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${desc}</p></div></div>`;
            });
            modified = true;
        }

        // [MUSIC]
        const musicRegex = /\[MUSIC:(.*?)\](.*?)\[\/MUSIC\]/g;
        if (musicRegex.test(html)) {
            html = html.replace(musicRegex, (match, title, artist) => {
                return `<div class="chat-sim-new-music chat-sim-raw-media"><div class="music-art"><i class="fa-solid fa-music"></i></div><div style="display: flex; flex-direction: column; justify-content: center; flex-grow: 1;"><p style="margin: 0; font-size: 13px; font-weight: 600;">${title}</p><p style="margin: 2px 0 0; font-size: 11px; color: #888;">${artist}</p></div><div class="music-play">▶</div></div>`;
            });
            modified = true;
        }

        // [VOICE]
        const voiceRegex = /\[VOICE\]([\s\S]*?)\[\/VOICE\]/g;
        if (voiceRegex.test(html)) {
            html = html.replace(voiceRegex, (match, text) => {
                const voiceId = 'voice_' + Math.random().toString(36).substr(2, 9);
                return `<div class="chat-sim-voice-container chat-sim-raw-media"><div class="chat-sim-new-voice" id="box_${voiceId}"><div class="voice-play-btn" data-target="${voiceId}"><div class="voice-play-icon"></div></div><div class="voice-waveform"><div class="wave-bar wb-1"></div><div class="wave-bar wb-2"></div><div class="wave-bar wb-3"></div><div class="wave-bar wb-4"></div><div class="wave-bar wb-5"></div><div class="wave-bar wb-6"></div><div class="wave-bar wb-7"></div><div class="wave-bar wb-1"></div></div><span style="font-size: 12px; color: #555; font-weight: 500;">00:15</span></div><div class="chat-sim-voice-text" id="text_${voiceId}" style="display: none;">" ${text.trim()} "</div></div>`;
            });
            modified = true;
        }

        // [CALL] (ยังคงเหมือนเดิม เพราะ Call มีโครงสร้างของตัวเองอยู่แล้ว)
        const callRegex = /\[CALL:(.*?)\]([\s\S]*?)\[\/CALL\]/g;
        if (callRegex.test(html)) {
            html = html.replace(callRegex, (match, name, content) => {
                let callAvatarHtml = `<div class="chat-sim-call-avatar"><i class="fa-solid fa-user"></i></div>`;
                if (showAvatars) {
                    callAvatarHtml = `<img src="${avatarUrl}" class="chat-sim-call-avatar-img" onerror="this.onerror=null; this.src='${fallbackAvatar}'; this.style.backgroundColor='#cccccc';">`;
                }
                return `<div class="chat-sim-call-container"><div class="chat-sim-call-header">${callAvatarHtml}<div class="chat-sim-call-info"><div class="chat-sim-call-name">${name}</div><div class="chat-sim-call-status">00:14 (กำลังอยู่ในสาย)</div></div><div class="chat-sim-call-icon"><i class="fa-solid fa-phone-volume"></i></div></div><div class="chat-sim-call-content">${content.trim()}</div><div class="chat-sim-call-footer"><div class="call-btn end-call"><i class="fa-solid fa-phone-slash"></i></div></div></div>`;
            });
            modified = true;
        }

        // [ขั้นที่ 2] จัดการ [CHAT] และฉีกป้าย raw ทิ้งถ้ามันถูกครอบแล้ว
        const chatRegex = /\[CHAT(?:|(:(L|R)))\]([\s\S]*?)\[\/CHAT\]/g;
        if (chatRegex.test(html)) {
            html = html.replace(chatRegex, (match, ignore, direction, content) => {
                let sideClass = '';
                if (direction === 'L') sideClass = 'chat-sim-left';
                else if (direction === 'R') sideClass = 'chat-sim-right';
                else sideClass = isUser ? 'chat-sim-right' : 'chat-sim-left';

                // เอาคลาส raw ออก เพราะมันมีบ้านอยู่แล้ว (อยู่ใน [CHAT])
                content = content.replace(/chat-sim-raw-media/g, '');

                if (sideClass === 'chat-sim-right') {
                    return `<div class="chat-sim-container ${sideClass}"><div class="chat-sim-bubble">${content.trim()}</div>${getAvatarHtml()}</div>`;
                } else {
                    return `<div class="chat-sim-container ${sideClass}">${getAvatarHtml()}<div class="chat-sim-bubble">${content.trim()}</div></div>`;
                }
            });
            modified = true;
        }

        // นำ HTML ที่แปลงเบื้องต้นแล้ว ยัดกลับลงไปในหน้าจอ
        if (modified) {
            mesTextContainer.html(html);
        }

        // [ขั้นที่ 3] ฮีโร่มาแล้ว! จับของลอยๆ ที่เหลือมาใส่ตะกร้า (Container)
        const sideClass = isUser ? 'chat-sim-right' : 'chat-sim-left';

        mesTextContainer.find('.chat-sim-raw-media').each(function() {
            // เช็คกันเหนียวว่ามันยังไม่มี Container ครอบอยู่จริงๆ
            if ($(this).parent().hasClass('chat-sim-container')) return;

            // เอาป้าย raw ออก
            $(this).removeClass('chat-sim-raw-media');

            // เอาโครงสร้างบ้านมาครอบ และใส่รูปโปรไฟล์
            if (sideClass === 'chat-sim-right') {
                $(this).wrap(`<div class="chat-sim-container ${sideClass}"></div>`);
                $(this).parent().append(getAvatarHtml());
            } else {
                $(this).wrap(`<div class="chat-sim-container ${sideClass}"></div>`);
                $(this).parent().prepend(getAvatarHtml());
            }
        });
    });
}

let updateTimeout = null;

function debouncedProcessAll() {
    if (updateTimeout) {
        clearTimeout(updateTimeout);
    }
    updateTimeout = setTimeout(() => {
        // --- NEW: ถ้าสวิตช์หลักปิดอยู่ ให้หยุดทำงานทันที ไม่ต้องสร้างกรอบแชท ---
        if (!extension_settings[extensionName].enabled) return;

        processChatUIInDOM();
    }, 800);
}

jQuery(async () => {
    console.log(`[${extensionName}] Loading...`);

    // --- อัปเดต: ผูก Event แบบ Delegation เพื่อให้ชัวร์ว่าปุ่มทำงานเสมอ ---
    $(document).on("change", "#chat-simulator-show-avatars", async function () {
        const isChecked = $(this).prop("checked");
        extension_settings[extensionName].showAvatars = isChecked;
        saveSettingsDebounced();

        console.log(`[${extensionName}] Avatar toggle changed to: ${isChecked}. Reloading chat...`);

        // สั่งให้ SillyTavern รีโหลดแชทปัจจุบันใหม่ทั้งหมด
        await reloadCurrentChat();
    });

    // --- NEW: ผูก Event ให้ Toggle เปิด/ปิด แถบ Quick Input ---
    $(document).on("change", "#chat-simulator-show-quickbar", function () {
        const isChecked = $(this).prop("checked");
        if (isChecked) {
            $("#chat-sim-quick-bar").slideDown(200);
        } else {
            $("#chat-sim-quick-bar").slideUp(200);
        }
    });

        // --- อัปเดต: ผูก Event ให้ปุ่ม Play ของข้อความเสียง ---
        $("#chat").on("click", ".voice-play-btn", function() {
            const targetId = $(this).data("target");
            const textElement = $(`#text_${targetId}`);

            // สลับการแสดงผลข้อความ
            textElement.slideToggle(200);

            // สลับคลาส playing เพื่อเปลี่ยนไอคอน Play/Pause ด้วย CSS
            $(this).toggleClass("playing");
        });

    // --- NEW: ผูก Event ให้ Dropdown เลือกธีม ---
    $(document).on("change", "#chat-simulator-theme-select", function () {
        const selected = $(this).val();
        extension_settings[extensionName].theme = selected;
        saveSettingsDebounced();

        console.log(`[${extensionName}] Theme changed to: ${selected}`);

        // เปลี่ยนสีทันทีโดยไม่ต้องรีโหลดแชท
        applyTheme(selected);
    });

    // --- NEW: ผูก Event ให้ Master Toggle ---
    $(document).on("change", "#chat-simulator-enable", async function () {
        const isChecked = $(this).prop("checked");
        extension_settings[extensionName].enabled = isChecked;
        saveSettingsDebounced();

        console.log(`[${extensionName}] Extension enabled: ${isChecked}. Reloading chat...`);

        // รีโหลดแชทเพื่อให้ ST ล้าง UI เก่าออก
        await reloadCurrentChat();

        // ซ่อนหรือแสดงแถบ Quick Input ตามสถานะหลัก
        if (isChecked && $("#chat-simulator-show-quickbar").prop("checked")) {
            $("#chat-sim-quick-bar").show();
        } else {
            $("#chat-sim-quick-bar").hide();
        }
    });

    // --- NEW: สร้างแถบ Quick Input Bar แทรกเหนือช่องแชทหลัก ---
    const quickInputHtml = `
            <div id="chat-sim-quick-bar" style="display: flex; gap: 8px; padding: 8px; background: var(--SmartThemeBlurTintColor); border-radius: 10px 10px 0 0; border-bottom: 1px solid var(--SmartThemeBorderColor); margin-bottom: -5px; z-index: 10;">
                <div style="display: flex; align-items: center; justify-content: center; width: 30px; color: var(--SmartThemeBodyColor); opacity: 0.7;">
                    <i class="fa-solid fa-mobile-screen"></i>
                </div>
                <input type="text" id="chat-sim-quick-input" class="text_pole" placeholder="พิมพ์ข้อความแชทจำลองที่นี่... (กด Enter เพื่อส่ง)" style="flex-grow: 1; border-radius: 20px; padding: 5px 15px;">
                <div id="chat-sim-quick-send-btn" class="menu_button" style="border-radius: 50%; width: 35px; height: 35px; display: flex; align-items: center; justify-content: center; padding: 0;">
                    <i class="fa-solid fa-paper-plane"></i>
                </div>
            </div>
        `;

    // ก่อนจะ prepend แถบ Quick Input ให้เช็คสวิตช์หลักก่อน
    if (extension_settings[extensionName].enabled) {
        $("#chat_form").prepend(quickInputHtml);

        // เช็ค Toggle ย่อยของ Quick Bar ด้วย
        if (!$("#chat-simulator-show-quickbar").prop("checked")) {
            $("#chat-sim-quick-bar").hide();
        }
    } else {
        // ถ้าปิด Extension ไว้ ก็สร้างแถบเตรียมไว้แต่ซ่อนมันไปเลย
        $("#chat_form").prepend(quickInputHtml);
        $("#chat-sim-quick-bar").hide();
    }

    // แทรกแถบเครื่องมือนี้ไว้ก่อนช่องพิมพ์ข้อความหลักของ ST
    $("#chat_form").prepend(quickInputHtml);

    // ฟังก์ชันสำหรับส่งข้อความ
    function sendQuickChat() {
        const inputField = $("#chat-sim-quick-input");
        const text = inputField.val().trim();

        if (!text) return; // ถ้าไม่ได้พิมพ์อะไรเลย ให้ข้ามไป

        // นำข้อความมาครอบด้วย [CHAT]
        const formattedText = `[CHAT]${text}[/CHAT]`;

        // เอาข้อความที่จัดรูปแบบแล้ว ไปใส่ในช่องพิมพ์หลักของ ST
        const mainTextarea = $("#send_textarea");
        const currentMainText = mainTextarea.val();

        // ถ้าช่องหลักมีข้อความอยู่แล้ว ให้ขึ้นบรรทัดใหม่ก่อน
        if (currentMainText.trim() !== "") {
            mainTextarea.val(currentMainText + '\n' + formattedText);
        } else {
            mainTextarea.val(formattedText);
        }

        // จำลองการกดปุ่มส่งข้อความหลักของ ST
        $("#send_but").trigger("click");

        // เคลียร์ช่อง Quick Input
        inputField.val("");
    }

    // ผูก Event ให้ปุ่มส่ง
    $("#chat-sim-quick-send-btn").on("click", sendQuickChat);

    // ผูก Event ให้กด Enter ในช่อง Quick Input แล้วส่งได้เลย
    $("#chat-sim-quick-input").on("keypress", function (e) {
        if (e.which === 13) { // 13 คือรหัสปุ่ม Enter
            e.preventDefault();
            sendQuickChat();
        }
    });

    try {
        const settingsHtml = await $.get(`${extensionFolderPath}/example.html`);
        $("#extensions_settings2").append(settingsHtml);

        loadSettings();
        $("#chat-simulator-add-sticker-btn").on("click", onAddStickerClick);
        renderStickerList();

        // --- อัปเดต: เปลี่ยนชื่อฟังก์ชันที่เรียกใช้ ---
        eventSource.on(event_types.CHAT_CHANGED, debouncedProcessAll);
        eventSource.on(event_types.MESSAGE_RECEIVED, debouncedProcessAll);
        eventSource.on(event_types.MESSAGE_UPDATED, debouncedProcessAll);
        eventSource.on(event_types.MESSAGE_SWIPED, debouncedProcessAll);
        eventSource.on(event_types.STREAMING_MESSAGE_DONE, debouncedProcessAll);

        // ดักจับเพิ่มเติมเผื่อกรณีที่ AI กำลังพิมพ์ (Streaming)
        eventSource.on(event_types.STREAMING_MESSAGE_DONE, debouncedProcessAll);

        // เรียกใช้งานครั้งแรกหลังจากโหลดเสร็จ
        setTimeout(debouncedProcessAll, 1000);

        console.log(`[${extensionName}] ✅ Loaded successfully`);
    } catch (error) {
        console.error(`[${extensionName}] ❌ Failed to load:`, error);
    }
});
