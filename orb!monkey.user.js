// ==UserScript==
// @name         orb!monkey
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Find random beatmaps using your osu! login (no API keys needed)
// @author       chicoyeah
// @match        https://osu.ppy.sh/*
// @connect      osu.ppy.sh
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_setClipboard
// @grant        unsafeWindow
// ==/UserScript==

(function () {
    'use strict';

    let maxBeatmapId = null;
    let statusClearTimeout = null;

    function getRandomColor() {
        const hue = Math.floor(Math.random() * 360);
        return `hsl(${hue}, 80%, 65%)`;
    }

    const mainColor = getRandomColor();

    function initScript() {
        if (!document.body) return;

        if (document.getElementById('rf-toggle-btn') && document.getElementById('osu-random-finder')) {
            bindEvents();
            return;
        }

        const oldBtn = document.getElementById('rf-toggle-btn');
        const oldContainer = document.getElementById('osu-random-finder');
        if (oldBtn) oldBtn.remove();
        if (oldContainer) oldContainer.remove();

        const savedOsu = GM_getValue('rf_mode_osu', true);
        const savedTaiko = GM_getValue('rf_mode_taiko', true);
        const savedFruits = GM_getValue('rf_mode_fruits', true);
        const savedMania = GM_getValue('rf_mode_mania', true);
        const savedAnyStatus = GM_getValue('rf_any_status', false);
        const savedAutoCopy = GM_getValue('rf_auto_copy', false);
        const savedAutoOpen = GM_getValue('rf_auto_open', false);
        const savedMinStars = GM_getValue('rf_min_stars', '0');
        const savedMaxStars = GM_getValue('rf_max_stars', '10');

        // Toggle button
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'rf-toggle-btn';
        toggleBtn.innerHTML = '🎲';
        toggleBtn.title = 'orb!monkey';
        toggleBtn.style.cssText = `
            position: fixed;
            bottom: 15px;
            right: 15px;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: ${mainColor};
            color: #1c1e24;
            border: none;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            cursor: pointer;
            z-index: 999999;
            font-size: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        `;

        toggleBtn.onmouseover = () => toggleBtn.style.transform = 'scale(1.1)';
        toggleBtn.onmouseout = () => toggleBtn.style.transform = 'scale(1)';

        // UI Container
        const container = document.createElement('div');
        container.id = 'osu-random-finder';
        container.style.cssText = `
            position: fixed;
            bottom: 65px;
            right: 15px;
            width: 280px;
            background: #1c1e24;
            color: #abb2bf;
            border-radius: 8px;
            padding: 10px 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.6);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            z-index: 999999;
            font-size: 12px;
            border: 1px solid #2c313a;
            opacity: 0;
            transform: scale(0.9) translateY(10px);
            transform-origin: bottom right;
            pointer-events: none;
            transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.1, 0.9, 0.2, 1);
        `;

        container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-weight: 600; color: ${mainColor}; font-size: 13px;">orb!monkey</span>
                <button id="rf-close-ui" title="Close" style="background: none; border: none; color: #5c6370; cursor: pointer; font-size: 14px; padding: 0 2px;">✕</button>
            </div>

            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 11px;">
                <label><input type="checkbox" id="rf-osu" ${savedOsu ? 'checked' : ''}> osu!</label>
                <label><input type="checkbox" id="rf-taiko" ${savedTaiko ? 'checked' : ''}> Taiko</label>
                <label><input type="checkbox" id="rf-fruits" ${savedFruits ? 'checked' : ''}> Catch</label>
                <label><input type="checkbox" id="rf-mania" ${savedMania ? 'checked' : ''}> Mania</label>
            </div>

            <div style="margin-bottom: 4px; font-size: 11px;">
                <label style="cursor: pointer;"><input type="checkbox" id="rf-any-status" ${savedAnyStatus ? 'checked' : ''}> Allow any status (Graveyard...)</label>
            </div>

            <div style="margin-bottom: 6px; font-size: 11px;">
                <label style="cursor: pointer;"><input type="checkbox" id="rf-auto-copy" ${savedAutoCopy ? 'checked' : ''}> Copy Mapset ID to clipboard</label>
            </div>

            <div style="margin-bottom: 6px; font-size: 11px;">
                <label style="cursor: pointer;"><input type="checkbox" id="rf-auto-open" ${savedAutoOpen ? 'checked' : ''}> Open map in osu!</label>
            </div>

            <div style="margin-bottom: 8px; background: #21252b; padding: 8px; border-radius: 6px; border: 1px solid #2c313a;">
                <div style="margin-bottom: 6px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                        <span>Min Stars:</span>
                        <b id="rf-min-val" style="color:${mainColor};">${parseFloat(savedMinStars).toFixed(1)}★</b>
                    </div>
                    <input type="range" id="rf-min-stars" min="0" max="10" step="0.1" value="${savedMinStars}" style="width: 100%; accent-color: ${mainColor}; display: block;">
                </div>

                <div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                        <span>Max Stars:</span>
                        <b id="rf-max-val" style="color:${mainColor};">${parseFloat(savedMaxStars).toFixed(1)}★</b>
                    </div>
                    <input type="range" id="rf-max-stars" min="1" max="10" step="0.1" value="${savedMaxStars}" style="width: 100%; accent-color: ${mainColor}; display: block;">
                </div>
            </div>

            <button id="rf-search-btn" style="
                width: 100%;
                padding: 6px;
                background: ${mainColor};
                color: #1c1e24;
                border: none;
                border-radius: 4px;
                font-weight: 600;
                cursor: pointer;
            ">Search & Open Beatmap</button>

            <div id="rf-status" style="margin-top: 6px; color: #e5c07b; text-align: center; font-size: 11px;"></div>
        `;

        document.body.appendChild(toggleBtn);
        document.body.appendChild(container);

        bindEvents();
    }

    function openUI() {
        const container = document.getElementById('osu-random-finder');
        if (!container) return;
        container.style.pointerEvents = 'auto';
        container.style.opacity = '1';
        container.style.transform = 'scale(1) translateY(0)';
    }

    function closeUI() {
        const container = document.getElementById('osu-random-finder');
        if (!container) return;
        container.style.pointerEvents = 'none';
        container.style.opacity = '0';
        container.style.transform = 'scale(0.9) translateY(10px)';
    }

    function bindEvents() {
        const toggleBtn = document.getElementById('rf-toggle-btn');
        const container = document.getElementById('osu-random-finder');
        const closeBtn = document.getElementById('rf-close-ui');

        if (!toggleBtn || !container) return;

        toggleBtn.onclick = () => {
            const isVisible = container.style.opacity === '1';
            if (isVisible) closeUI();
            else openUI();
        };

        if (closeBtn) closeBtn.onclick = closeUI;

        const osuCb = document.getElementById('rf-osu');
        const taikoCb = document.getElementById('rf-taiko');
        const fruitsCb = document.getElementById('rf-fruits');
        const maniaCb = document.getElementById('rf-mania');
        const anyCb = document.getElementById('rf-any-status');
        const autoCopyCb = document.getElementById('rf-auto-copy');
        const autoOpenCb = document.getElementById('rf-auto-open');

        if (osuCb) osuCb.onchange = (e) => GM_setValue('rf_mode_osu', e.target.checked);
        if (taikoCb) taikoCb.onchange = (e) => GM_setValue('rf_mode_taiko', e.target.checked);
        if (fruitsCb) fruitsCb.onchange = (e) => GM_setValue('rf_mode_fruits', e.target.checked);
        if (maniaCb) maniaCb.onchange = (e) => GM_setValue('rf_mode_mania', e.target.checked);
        if (anyCb) anyCb.onchange = (e) => GM_setValue('rf_any_status', e.target.checked);
        if (autoCopyCb) autoCopyCb.onchange = (e) => GM_setValue('rf_auto_copy', e.target.checked);
        if (autoOpenCb) autoOpenCb.onchange = (e) => GM_setValue('rf_auto_open', e.target.checked);

        const minSlider = document.getElementById('rf-min-stars');
        const maxSlider = document.getElementById('rf-max-stars');

        if (minSlider && maxSlider) {
            minSlider.oninput = (e) => {
                if (parseFloat(minSlider.value) > parseFloat(maxSlider.value)) {
                    maxSlider.value = minSlider.value;
                    document.getElementById('rf-max-val').innerText = parseFloat(maxSlider.value).toFixed(1) + "★";
                    GM_setValue('rf_max_stars', maxSlider.value);
                }
                document.getElementById('rf-min-val').innerText = parseFloat(e.target.value).toFixed(1) + "★";
                GM_setValue('rf_min_stars', e.target.value);
            };

            maxSlider.oninput = (e) => {
                if (parseFloat(maxSlider.value) < parseFloat(minSlider.value)) {
                    minSlider.value = maxSlider.value;
                    document.getElementById('rf-min-val').innerText = parseFloat(minSlider.value).toFixed(1) + "★";
                    GM_setValue('rf_min_stars', minSlider.value);
                }
                document.getElementById('rf-max-val').innerText = parseFloat(e.target.value).toFixed(1) + "★";
                GM_setValue('rf_max_stars', e.target.value);
            };
        }

        const searchBtn = document.getElementById('rf-search-btn');
        if (searchBtn) searchBtn.onclick = startSearch;
    }

    const modeMap = { 0: 'osu', 1: 'taiko', 2: 'fruits', 3: 'mania' };

    // Uses the logged-in osu! website session (cookie + CSRF token), so no API keys are needed
    function isLoggedIn() {
        const u = unsafeWindow.currentUser;
        return !!(u && u.id);
    }

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    let backoffUntil = 0;

    // Fetch with retry/backoff on rate limiting (429). Returns the Response, or null on persistent failure.
    async function fetchWithBackoff(url, options, statusEl) {
        for (let attempt = 0; attempt < 5; attempt++) {
            const wait = backoffUntil - Date.now();
            if (wait > 0) await sleep(wait);
            try {
                const res = await fetch(url, options);
                if (res.status !== 429 && res.status < 500) return res;
                const retryAfter = parseInt(res.headers.get('Retry-After') || '0', 10);
                const delay = Math.max(retryAfter * 1000, 2000 * Math.pow(2, attempt));
                backoffUntil = Math.max(backoffUntil, Date.now() + delay);
                if (statusEl) statusEl.innerText = `Rate limited, waiting ${Math.ceil(delay / 1000)}s...`;
            } catch (e) {
                await sleep(1000);
            }
        }
        return null;
    }

    async function fetchLatestWipMapId(statusEl) {
        const cached = GM_getValue('rf_max_id_cache', null);
        if (cached && Date.now() - cached.time < 10 * 60 * 1000) return cached.id;

        const csrf = document.querySelector('meta[name="csrf-token"]');
        const res = await fetchWithBackoff('https://osu.ppy.sh/beatmapsets/search?s=wip&sort=id_desc', {
            credentials: 'include',
            headers: {
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'X-Requested-With': 'XMLHttpRequest',
                ...(csrf ? { 'X-CSRF-Token': csrf.content } : {})
            }
        }, statusEl);

        let id = null;
        if (res && res.ok) {
            try {
                const data = await res.json();
                if (data.beatmapsets && data.beatmapsets.length > 0) id = data.beatmapsets[0].id;
            } catch (e) {}
        }
        if (id) {
            GM_setValue('rf_max_id_cache', { id, time: Date.now() });
            return id;
        }
        return cached ? cached.id : null;
    }

    async function fetchMapById(randomId, statusEl) {
        let data = null;
        try {
            const res = await fetchWithBackoff(`https://osu.ppy.sh/beatmapsets/${randomId}`, { credentials: 'include' }, statusEl);
            if (!res || !res.ok) return null;
            const html = await res.text();
            const m = html.match(/<script id="json-beatmapset" type="application\/json">([\s\S]*?)<\/script>/);
            if (!m) return null;
            data = JSON.parse(m[1]);
        } catch (e) {
            return null;
        }
        return matchSet(data);
    }

    // Approx. ranked sets per year (measured). Years after the table reuse the latest full-year rate.
    const RANKED_PER_YEAR = {
        2007: 200, 2008: 500, 2009: 900, 2010: 1500, 2011: 1200, 2012: 1400, 2013: 1450,
        2014: 1350, 2015: 1500, 2016: 1800, 2017: 1900, 2018: 3000, 2019: 3700, 2020: 3300,
        2021: 4300, 2022: 4600, 2023: 4500, 2024: 7500, 2025: 8300
    };
    const LAST_TABLE_YEAR = 2025;

    function randomRankedDate() {
        const now = Date.now();
        const currentYear = new Date(now).getUTCFullYear();
        const weights = [];
        for (let y = 2007; y <= currentYear; y++) {
            const yearStart = Date.UTC(y, 0, 1);
            const yearEnd = Math.min(Date.UTC(y + 1, 0, 1), now);
            const fraction = (yearEnd - yearStart) / (Date.UTC(y + 1, 0, 1) - yearStart);
            const perYear = RANKED_PER_YEAR[y] ?? RANKED_PER_YEAR[LAST_TABLE_YEAR];
            weights.push({ year: y, start: yearStart, end: yearEnd, weight: perYear * fraction });
        }

        let pick = Math.random() * weights.reduce((s, w) => s + w.weight, 0);
        let chosen = weights[weights.length - 1];
        for (const w of weights) {
            pick -= w.weight;
            if (pick < 0) { chosen = w; break; }
        }
        return Math.floor(chosen.start + Math.random() * (chosen.end - chosen.start));
    }

    // One request returns up to 50 sets from a random point in ranked history
    async function fetchRandomPage(statusEl) {
        const date = randomRankedDate();
        const params = new URLSearchParams({ s: 'any', sort: 'ranked_desc' });
        params.set('cursor[approved_date]', date);
        params.set('cursor[id]', 0);

        const csrf = document.querySelector('meta[name="csrf-token"]');
        const res = await fetchWithBackoff(`https://osu.ppy.sh/beatmapsets/search?${params}`, {
            credentials: 'include',
            headers: {
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'X-Requested-With': 'XMLHttpRequest',
                ...(csrf ? { 'X-CSRF-Token': csrf.content } : {})
            }
        }, statusEl);
        if (!res || !res.ok) return null;

        try {
            const data = await res.json();
            const matches = (data.beatmapsets || []).map(matchSet).filter(Boolean);
            return matches.length ? matches[Math.floor(Math.random() * matches.length)] : null;
        } catch (e) {
            return null;
        }
    }

    function matchSet(data) {
        const acceptAnyStatus = document.getElementById('rf-any-status').checked;

        if (!acceptAnyStatus && !['ranked', 'loved', 'qualified', 'approved'].includes(data.status)) {
            return null;
        }

        const minStars = parseFloat(document.getElementById('rf-min-stars').value);
        const maxStars = parseFloat(document.getElementById('rf-max-stars').value);

        const activeModes = {
            osu: document.getElementById('rf-osu').checked,
            taiko: document.getElementById('rf-taiko').checked,
            fruits: document.getElementById('rf-fruits').checked,
            mania: document.getElementById('rf-mania').checked
        };

        const validBeatmaps = (data.beatmaps || []).filter(b => {
            const modeStr = modeMap[b.mode_int];
            const rating = b.difficulty_rating || 0;
            return activeModes[modeStr] && rating >= minStars && rating <= maxStars;
        });

        if (validBeatmaps.length === 0) return null;

        const beatmap = validBeatmaps[Math.floor(Math.random() * validBeatmaps.length)];
        return {
            id: data.id.toString(),
            beatmapId: beatmap.id.toString(),
            url: `https://osu.ppy.sh/beatmapsets/${data.id}`
        };
    }

    async function startSearch() {
        const statusEl = document.getElementById('rf-status');
        const searchBtn = document.getElementById('rf-search-btn');

        clearTimeout(statusClearTimeout);
        statusClearTimeout = null;

        if (!isLoggedIn()) {
            statusEl.innerText = "Please log in to osu! first!";
            return;
        }

        searchBtn.innerText = "Searching...";
        searchBtn.disabled = true;

        let foundMap = null;
        let attempts = 0;
        const anyStatus = document.getElementById('rf-any-status').checked;

        if (!anyStatus) {
            const maxAttempts = 20;
            while (!foundMap && attempts < maxAttempts) {
                attempts++;
                statusEl.innerText = `Searching (${attempts}/${maxAttempts})...`;
                foundMap = await fetchRandomPage(statusEl);
                if (!foundMap) await sleep(700);
            }
        } else {
            // Unranked maps aren't in the ranked history, so probe random IDs one at a time
            statusEl.innerText = "Fetching Max ID...";
            maxBeatmapId = await fetchLatestWipMapId(statusEl);

            if (!maxBeatmapId) {
                statusEl.innerText = "Error: Failed to fetch Max ID! Wait a minute and retry.";
                searchBtn.innerText = "Search & Open Beatmap";
                searchBtn.disabled = false;
                return;
            }

            const maxAttempts = 60;
            while (!foundMap && attempts < maxAttempts) {
                attempts++;
                statusEl.innerText = `Checking ${attempts}/${maxAttempts} [Max: ${maxBeatmapId}]...`;
                foundMap = await fetchMapById(Math.floor(Math.random() * maxBeatmapId) + 1, statusEl);
                if (!foundMap) await sleep(600);
            }
        }

        searchBtn.innerText = "Search & Open Beatmap";
        searchBtn.disabled = false;

        if (foundMap) {
            const autoCopy = document.getElementById('rf-auto-copy').checked;
            const autoOpen = document.getElementById('rf-auto-open').checked;
            if (autoCopy) {
                if (typeof GM_setClipboard === 'function') {
                    GM_setClipboard(foundMap.id);
                } else if (navigator.clipboard) {
                    navigator.clipboard.writeText(foundMap.id);
                }
            }
            const successMessage = autoCopy ? `ID (${foundMap.id}) copied! Opening...` : "Map found! Opening...";
            statusEl.innerText = successMessage;
            const timeout = setTimeout(() => {
                if (statusClearTimeout === timeout) {
                    statusEl.innerText = '';
                    statusClearTimeout = null;
                }
            }, 4000);
            statusClearTimeout = timeout;
            window.location.href = autoOpen ? `osu://s/${foundMap.id}` : foundMap.url;
        } else {
            statusEl.innerText = "No map found. Try again or widen the filters!";
        }
    }

    initScript();

    window.addEventListener('pageshow', () => {
        initScript();
    });

    setInterval(() => {
        initScript();
    }, 800);

    window.addEventListener('popstate', initScript);

    const fireOnHistoryChange = (type) => {
        const orig = history[type];
        return function () {
            const rv = orig.apply(this, arguments);
            initScript();
            return rv;
        };
    };

    history.pushState = fireOnHistoryChange('pushState');
    history.replaceState = fireOnHistoryChange('replaceState');
})();
