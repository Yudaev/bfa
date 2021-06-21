const puppeteer = require('puppeteer');
const CronJob = require('cron').CronJob;
const param = require('optimist').argv;
const fs = require("fs");

let config = JSON.parse(fs.readFileSync('config.json')),
    healingCount = null,
    ratio = 19;

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
    let enemyPower = Math.round(userData.power - userData.power * (ratio/100));

    if (await page.$('[name="lvlbis"]') !== null) await page.$eval('[name="lvlbis"]', (el, enemyPower) => el.value = enemyPower, enemyPower);
    else return await getUserInfo(page, config);
    await page.click('[name="levelsearch"]');

    await page.waitForSelector('.gold');
    if((await page.$x(`//div[@class="tdi"]/strong`)).length !== 0){
        ratio -= 1;
        console.log(`[${logTime()}] Ratio changed on ${ratio/100}`)
        return await getUserInfo(page, config);
    }
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

getRandomInt = max => Math.floor(Math.random() * max);

getSleepTime = async page => {
    if (await page.url().split('?')[0] !== (config.url.main + config.url.profile))
        await page.goto(config.url.main + config.url.profile);
    healingCount = await page.$('span#healing_countdown') !== null ?
        await page.$eval('span#healing_countdown', el => el.textContent) : null;
    console.log('[' + logTime() + ']', 'Waiting for healing', healingCount);
    let splitTime = healingCount.split(':');

    return (+splitTime[0]) * 60 * 60 + (+splitTime[1]) * 60 + (+splitTime[2]);
}

churchActivate = async (page, config) => {
    await page.goto(config.url.main + config.url.city);
    await page.waitForSelector('.table-wrap');
    await page.goto(config.url.main + config.url.church);
    await page.waitForSelector('.table-wrap p');
    await page.waitForSelector('.gold');
    console.log(`[${logTime()}] Church opened`)

    let OD = await page.$eval('.table-wrap p',el =>
        el
            .textContent
            .replace(/(\s\r\n|\n|\r|\s)/gm, "")
            .match(/\d+/g)[1]);
    console.log(`[${logTime()}] Needed ${OD} for activate church`)
    if (OD <= config.churchODActivate) {
        await page.click('input[name="heal"]');
        await page.waitForSelector('.gold');
        console.log(`[${logTime()}] Church is activated`)
    }
}

botStart = async (config, lag = false) => {
    if(lag) {
        let sleepValue = getRandomInt(45 * 60);
        console.log(`[${logTime()}] Started lag in ${(sleepValue - sleepValue % 60)/60} minutes and ${sleepValue % 60} seconds`);
        await sleep(sleepValue * 1000);
    }
    const browser = await puppeteer.launch({
        headless: true,
        ignoreHTTPSErrors: true,
        defaultViewport: null,
        args: [`--no-sandbox`,`--window-size=${config.width},${config.height}`]
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
            while (userData.hp > config.userHPmin && userData.energy !== 0) userData = await hunting(page, config, userData);
        } catch (e) {
            await page.screenshot({path: 'hunting_fail.png'})
            console.log(e);
        }
        console.log('[' + logTime() + ']', 'User data after the hunt', await getUserInfo(page, config));

        if (userData.hp < config.userHPmin && userData.energy >= 40 && ratio !== 0) await churchActivate(page, config);
        userData = await getUserInfo(page, config);

    } while (userData.hp > config.userHPmin && userData.energy !== 0 && ratio !== 0);

    let seconds = await getSleepTime(page);
    await browser.close();
    ratio = 19;
    return seconds;
};

switch(param.start) {
    case 'alone':  // if (x === 'value1')
        botStart(config);
        break;
    default:
        let job = new CronJob('0 */3 * * *', function() { //0 */3 * * *
            if(new Date().getHours() === 0 || new Date().getHours() >= 8) {
                botStart(config, true);
            } else {
                console.log('[' + logTime() + ']', 'Sleeping time');
            }
        }, null, true, 'Europe/Moscow');
        job.start();
        break;
}
