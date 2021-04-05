const puppeteer = require('puppeteer');
const fs = require("fs");

let config = JSON.parse(fs.readFileSync('config.json'));

auth = async (page, config) => {
    if (await page.url().split('?')[0] !== (config.url.main + config.url.auth))
        await page.goto(config.url.main + config.url.auth);
    await page.$eval('input[name=user]', (el, username) => el.value = username, config.username);
    await page.$eval('input[name=pass]', (el, password) => el.value = password, config.password);
    await page.click('[type="submit"]');
}

getUserInfo = async (page, config) => {
    let data = {};
    let currentUrl = await page.url().split('?')[0];

    if (currentUrl !== (config.url.main + config.url.profile)) await page.goto(config.url.main);
    await page.waitForSelector('.gold');

    let userInfo = await page.$eval('.gold',el =>
        el
            .textContent
            .trim()
            .split('\n')
            .map(el => el.trim())
    );
    data.gold = userInfo[0].replace('.','');
    data.energy = userInfo[3].match(/^\d+/)[0];
    data.hp = userInfo[4].replace('.','').trim().match(/^\d+/)[0];
    data.power = userInfo[5].split(' ').map(el => el.trim());
    data.power = data.power[data.power.length - 1];

    return data;
}

start = async (config) => {
    const browser = await puppeteer.launch({
        headless: false,
        ignoreHTTPSErrors: true,
        defaultViewport: null,
        args: [`--window-size=${config.width},${config.height}`]
    });
    const page = await browser.newPage();
    await page.goto(config.url.main);
    if (await page.$('.cookiebanner1') !== null) await page.click('[class="cookiebanner5"]');
    if (await page.$('#regBtn') !== null) await auth(page, config);
    let userData = await getUserInfo(page, config);

    console.log(userData);
};

start(config);