const puppeteer = require('puppeteer');
const CronJob = require('cron').CronJob;
const param = require('optimist').argv;
const fs = require("fs");

let config = JSON.parse(fs.readFileSync('config.json')),
    healingCount = null;

auth = async (browser, page, config) => {
    if (await page.url().split('?')[0] !== (config.url.main + config.url.auth))
        await page.goto(config.url.main + config.url.auth);
    await page.$eval('input[name=user]', (el, username) => el.value = username, config.username);
    await page.$eval('input[name=pass]', (el, password) => el.value = password, config.password);
    await page.click('[type="submit"]');
    try{
        await page.waitForSelector('#infobar');
        console.log(`[${logTime()}] Successful login by ${config.username}`);
    }catch (e) {
        browser.close();
        throw new Error('[' + logTime() + ']' + 'Failed login by ' + config.username);
    }
}

getUserInfo = async (page, config) => {
    await page.reload({ waitUntil: ["networkidle0", "domcontentloaded"] });
    let data = {};
    let currentUrl = await page.url().split('?')[0];
    let urls = [config.url.main + config.url.hunt,
                config.url.main + config.url.profile]

    if (!urls.includes(currentUrl)) await page.goto(config.url.main);
    try {
        await page.waitForSelector('.gold');
    }catch (e){
        console.log(e);
        await page.screenshot({ path: 'example.png' });
    }

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

hunting = async (page, config, userData) => {
    let currentUrl = await page.url().split('?')[0];
    if (currentUrl !== config.url.main + config.url.hunt) await page.goto(config.url.main + config.url.hunt);
    let enemyPower = Math.round(userData.power - userData.power * 0.04);

    await page.$eval('[name="lvlbis"]', (el, enemyPower) => el.value = enemyPower, enemyPower);
    await page.click('[name="levelsearch"]');
    await page.waitForSelector('.cost');
    await page.click('.cost');

    await page.waitForSelector('#fighter_details');
    await page.waitForSelector('#fighter_details_defender h3 a');
    let enemyName = await page.$eval('#fighter_details_defender h3 a',el => el.textContent);
    let enemyGold = await page.$('p.gold') !== null ? await page.$eval('p.gold',el => {
            let allNumbers = el
                .textContent
                .trim()
                .replace(/(\s\r\n|\n|\r|\s)/gm, "")
                .replace('.', '')
                .replace('+', '')
                .match(/\d+/g);
            return +allNumbers[0] + +allNumbers[1];
        }
    ) : 0;
    let winner = await page.$eval('.wrap-content > h3', el => el.textContent);
    console.log(`[${logTime()}] ${winner}. Attacked ${enemyName}. My HP at start: ${userData.hp}. Gold: ${enemyGold}`);

    return await getUserInfo(page, config);
}

logTime = () => {
    let currentdate = new Date();
    return currentdate.getDate() + '.'
        + (currentdate.getMonth() + 1)  + '.'
        + currentdate.getFullYear() + ' '
        + (currentdate.getHours() < 10 ? '0' + currentdate.getHours() : currentdate.getHours()) + ':'
        + (currentdate.getMinutes() < 10 ? '0' + currentdate.getMinutes() : currentdate.getMinutes()) + ':'
        + (currentdate.getSeconds() < 10 ? '0' + currentdate.getSeconds() : currentdate.getSeconds());
}

sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

getSleepTime = async page => {
    if (await page.url().split('?')[0] !== (config.url.main + config.url.profile))
        await page.goto(config.url.main + config.url.profile);
    healingCount = await page.$('span#healing_countdown') !== null ?
        await page.$eval('span#healing_countdown', el => el.textContent) : null;
    console.log('[' + logTime() + ']', 'Waiting for healing', healingCount);
    let splitTime = healingCount.split(':');

    return (+splitTime[0]) * 60 * 60 + (+splitTime[1]) * 60 + (+splitTime[2]);
}

botStart = async (config, upgrade = false) => {
    const browser = await puppeteer.launch({
        headless: true,
        ignoreHTTPSErrors: true,
        defaultViewport: null,
        args: [`--window-size=${config.width},${config.height}`]
    });
    const page = await browser.newPage();
    await page.goto(config.url.main);
    try {
        if (await page.$('.cookiebanner1') !== null) await page.click('[class="cookiebanner5"]');
    }catch(e){
        console.error('[' + logTime() + ']', e);
    }
    if (await page.$('#regBtn') !== null) await auth(browser, page, config);
    let userData = await getUserInfo(page, config);

    do {
        console.log(`[${logTime()}] I start hunting`);
        try {
            while (userData.hp > config.userHPmin) userData = await hunting(page, config, userData);
        } catch (e) {
            await page.screenshot({path: 'hunting_fail.png'})
            console.log(e);
        }
        console.log('[' + logTime() + ']', 'User data after the hunt', await getUserInfo(page, config));
        userData = await getUserInfo(page, config);

    } while (userData.hp > config.userHPmin);

    let seconds = await getSleepTime(page);
    await browser.close();
    return seconds;

};

switch(param.start) {
    case 'alone':  // if (x === 'value1')
        botStart(config);
        break;
    default:
        let job = new CronJob('0 */3 * * *', function() { //0 */3 * * *
            botStart(config);
        }, null, true, 'Europe/Moscow');
        job.start();
        break;
}
