const puppeteer = require('puppeteer');
const fs = require("fs");

let config = JSON.parse(fs.readFileSync('config.json'));

auth = async (browser, page, config) => {
    if (await page.url().split('?')[0] !== (config.url.main + config.url.auth))
        await page.goto(config.url.main + config.url.auth);
    await page.$eval('input[name=user]', (el, username) => el.value = username, config.username);
    await page.$eval('input[name=pass]', (el, password) => el.value = password, config.password);
    await page.click('[type="submit"]');
    try{
        await page.waitForSelector('#infobar');
        console.log('Successful login by', config.username);
    }catch (e) {
        browser.close();
        throw new Error('Failed login by ' + config.username);
    }
}

getUserInfo = async (page, config) => {
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

hunting = async (page, config) => {
    console.log('I start hunting');
    let userData;

    do {
        let currentUrl = await page.url().split('?')[0];
        if (currentUrl !== config.url.main + config.url.hunt) await page.goto(config.url.main + config.url.hunt);
        userData = await getUserInfo(page, config);

        let enemyPower = Math.round(userData.power - userData.power * 0.02);

        await page.$eval('[name="lvlbis"]', (el, enemyPower) => el.value = enemyPower, enemyPower);
        await page.click('[name="levelsearch"]');
        await page.waitForSelector('.cost');
        await page.click('.cost');

        await page.waitForSelector('#fighter_details')
        let enemyName = await page.$eval('#fighter_details_defender h3 a',el => el.textContent);
        let enemyGold = await page.$eval('p.gold',el => {
                let allNumbers = el
                    .textContent
                    .trim()
                    .replace(/(\s\r\n|\n|\r|\s)/gm, "")
                    .replace('.', '')
                    .replace('+', '')
                    .match(/\d+/g);
                return +allNumbers[0] + +allNumbers[1];
            }
        );
        let winner = await page.$eval('.wrap-content > h3', el => el.textContent);
        console.log(winner, '. Attacked', enemyName, '. My HP:', userData.hp, '. Gold:', enemyGold)
    } while (userData.hp > config.userHPmin);

    console.log('User data after the hunt', await getUserInfo(page, config))
}

start = async (config) => {
    const browser = await puppeteer.launch({
        headless: true,
        ignoreHTTPSErrors: true,
        defaultViewport: null,
        args: [`--window-size=${config.width},${config.height}`]
    });
    const page = await browser.newPage();
    await page.goto(config.url.main);
    if (await page.$('.cookiebanner1') !== null) await page.click('[class="cookiebanner5"]');
    if (await page.$('#regBtn') !== null) await auth(browser, page, config);
    await hunting(page, config);

    await browser.close();
};

start(config);