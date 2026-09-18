// ==UserScript==
// @name         orb!monkey
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Find random beatmaps with an option to copy only the mapset ID to clipboard
// @author       chicoyeah
// @match        https://osu.ppy.sh/*
// @connect      osu.ppy.sh
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_setClipboard
// @grant        unsafeWindow
// ==/UserScript==

(function () {
    'use strict';

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

        const hasSavedCreds = GM_getValue('osu_client_id', '') && GM_getValue('osu_client_secret', '');

        const savedOsu = GM_getValue('rf_mode_osu', true);
        const savedTaiko = GM_getValue('rf_mode_taiko', true);
        const savedFruits = GM_getValue('rf_mode_fruits', true);
        const savedMania = GM_getValue('rf_mode_mania', true);
        const savedAnyStatus = GM_getValue('rf_any_status', false);
        const savedAutoCopy = GM_getValue('rf_auto_copy', false);
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
                <div>
                    <button id="rf-toggle-creds" title="OAuth Settings" style="background: none; border: none; color: #5c6370; cursor: pointer; font-size: 14px; padding: 0 2px;">⚙️</button>
                    <button id="rf-close-ui" title="Close" style="background: none; border: none; color: #5c6370; cursor: pointer; font-size: 14px; padding: 0 2px; margin-left: 4px;">✕</button>
                </div>
            </div>

            <div id="rf-creds-box" style="display: ${hasSavedCreds ? 'none' : 'block'}; margin-bottom: 10px; background: #21252b; padding: 8px; border-radius: 6px; border: 1px solid #3e4451;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span style="font-size: 11px; color: #e5c07b;">OAuth2 API Credentials</span>
                    <a href="https://osu.ppy.sh/home/account/edit#oauth" target="_blank" rel="noopener noreferrer" style="color: ${mainColor}; text-decoration: underline; font-size: 10px; font-weight: 600;">🔗 Get Keys</a>
                </div>
                <input type="password" id="rf-client-id" placeholder="Client ID" style="width: 100%; padding: 4px 6px; margin-bottom: 4px; border-radius: 4px; border: 1px solid #3e4451; background: #282c34; color: #fff; font-size: 11px;" value="${GM_getValue('osu_client_id', '')}">
                <input type="password" id="rf-client-secret" placeholder="Client Secret" style="width: 100%; padding: 4px 6px; margin-bottom: 6px; border-radius: 4px; border: 1px solid #3e4451; background: #282c34; color: #fff; font-size: 11px;" value="${GM_getValue('osu_client_secret', '')}">
                <button id="rf-save-creds" style="width: 100%; padding: 4px; background: #98c379; color: #1e1e1e; border: none; border-radius: 4px; font-weight: 600; cursor: pointer; font-size: 11px;">Save & Hide</button>
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
                background-color: ${mainColor};
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

        if (osuCb) osuCb.onchange = (e) => GM_setValue('rf_mode_osu', e.target.checked);
        if (taikoCb) taikoCb.onchange = (e) => GM_setValue('rf_mode_taiko', e.target.checked);
        if (fruitsCb) fruitsCb.onchange = (e) => GM_setValue('rf_mode_fruits', e.target.checked);
        if (maniaCb) maniaCb.onchange = (e) => GM_setValue('rf_mode_mania', e.target.checked);
        if (anyCb) anyCb.onchange = (e) => GM_setValue('rf_any_status', e.target.checked);
        if (autoCopyCb) autoCopyCb.onchange = (e) => GM_setValue('rf_auto_copy', e.target.checked);

        const credsBtn = document.getElementById('rf-toggle-creds');
        if (credsBtn) {
            credsBtn.onclick = () => {
                const box = document.getElementById('rf-creds-box');
                if (box) box.style.display = box.style.display === 'none' ? 'block' : 'none';
            };
        }

        const saveCredsBtn = document.getElementById('rf-save-creds');
        if (saveCredsBtn) {
            saveCredsBtn.onclick = () => {
                const cid = document.getElementById('rf-client-id').value.trim();
                const sec = document.getElementById('rf-client-secret').value.trim();
                GM_setValue('osu_client_id', cid);
                GM_setValue('osu_client_secret', sec);
                document.getElementById('rf-creds-box').style.display = 'none';
                document.getElementById('rf-status').innerText = "Credentials saved!";
                setTimeout(() => document.getElementById('rf-status').innerText = "", 1500);
            };
        }

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

    function getApiToken(clientId, clientSecret) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: "POST",
                url: "https://osu.ppy.sh/oauth/token",
                headers: { "Content-Type": "application/json" },
                data: JSON.stringify({
                    client_id: parseInt(clientId),
                    client_secret: clientSecret,
                    grant_type: "client_credentials",
                    scope: "public"
                }),
                onload: function (res) {
                    if (res.status === 200) {
                        try {
                            const data = JSON.parse(res.responseText);
                            resolve(data.access_token);
                        } catch (e) { resolve(null); }
                    } else {
                        resolve(null);
                    }
                },
                onerror: () => resolve(null)
            });
        });
    }

    function fetchMapById(randomId, token) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: `https://osu.ppy.sh/api/v2/beatmapsets/${randomId}`,
                headers: { "Authorization": `Bearer ${token}` },
                onload: function (response) {
                    if (response.status !== 200) return resolve(null);
                    try {
                        const data = JSON.parse(response.responseText);
                        const acceptAnyStatus = document.getElementById('rf-any-status').checked;

                        if (!acceptAnyStatus && !['ranked', 'loved', 'qualified', 'approved'].includes(data.status)) {
                            return resolve(null);
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

                        if (validBeatmaps.length === 0) return resolve(null);

                        resolve({
                            id: data.id.toString(),
                            url: `https://osu.ppy.sh/beatmapsets/${data.id}`
                        });
                    } catch (e) {
                        resolve(null);
                    }
                },
                onerror: () => resolve(null)
            });
        });
    }

    async function startSearch() {
        const statusEl = document.getElementById('rf-status');
        const searchBtn = document.getElementById('rf-search-btn');

        const clientId = GM_getValue('osu_client_id', '');
        const clientSecret = GM_getValue('osu_client_secret', '');

        if (!clientId || !clientSecret) {
            document.getElementById('rf-creds-box').style.display = 'block';
            statusEl.innerText = "Enter Client ID and Secret!";
            return;
        }

        searchBtn.innerText = "Searching...";
        searchBtn.disabled = true;
        statusEl.innerText = "Authenticating...";

        const token = await getApiToken(clientId, clientSecret);
        if (!token) {
            document.getElementById('rf-creds-box').style.display = 'block';
            statusEl.innerText = "Invalid credentials!";
            searchBtn.innerText = "Search & Open Beatmap";
            searchBtn.disabled = false;
            return;
        }

        statusEl.innerText = "Fast search in progress...";

        let foundMap = null;
        let batchCount = 0;
        const maxBatches = 10;
        const batchSize = 15;

        while (!foundMap && batchCount < maxBatches) {
            batchCount++;
            statusEl.innerText = `Checking maps (Batch ${batchCount}/${maxBatches})...`;

            const promises = Array.from({ length: batchSize }, () => {
                const randomId = Math.floor(Math.random() * 2200000) + 1;
                return fetchMapById(randomId, token);
            });

            const results = await Promise.all(promises);
            foundMap = results.find(res => res !== null);
        }

        searchBtn.innerText = "Search & Open Beatmap";
        searchBtn.disabled = false;

        if (foundMap) {
            const autoCopy = document.getElementById('rf-auto-copy').checked;
            if (autoCopy) {
                if (typeof GM_setClipboard === 'function') {
                    GM_setClipboard(foundMap.id);
                } else if (navigator.clipboard) {
                    navigator.clipboard.writeText(foundMap.id);
                }
            }
            statusEl.innerText = autoCopy ? `ID (${foundMap.id}) copied! Redirecting...` : "Map found! Redirecting...";
            window.location.href = foundMap.url;
        } else {
            statusEl.innerText = "No map found in 150 attempts. Try again!";
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