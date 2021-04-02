const puppeteer = require('puppeteer');
const fs = require("fs");

let config = JSON.parse(fs.readFileSync('config.json'));
let userData = {};

auth = async (page, config) => {
    await page.goto(config.url.main + config.url.auth);
    await page.$eval('input[name=user]', (el, username) => el.value = username, config.username);
    await page.$eval('input[name=pass]', (el, password) => el.value = password, config.password);
    await page.click('[type="submit"]');
}

start = async (config) => {
    const browser = await puppeteer.launch({
        headless: false, // The browser is visible
        ignoreHTTPSErrors: true,
        defaultViewport: null,
        args: [`--window-size=${config.width},${config.height}`] // new option
    });
    const page = await browser.newPage();
    await page.goto(config.url.main);
    if (await page.$('.cookiebanner1') !== null) await page.click('[class="cookiebanner5"]');
    if (await page.$('#regBtn') !== null) await auth(page, config);
    await page.waitForSelector('.gold');
    let userInfo = await page.$eval('.gold',el =>
        el
            .textContent
            .trim()
            //.split('&nbsp;')
            .split('\n')
            .map(el => el.trim())
    );
    userData.gold = userInfo[0];
    userData.energy = userInfo[3];
    userData.hp = userInfo[4];
    userData.power = userInfo[5].split(' ').map(el => el.trim());
    userData.power = userData.power[userData.power.length - 1];

    // let nameLengths = names.map(function(name) {
    //     return name.length;
    // });
    // console.log(value[5].split(' ').map(el => el.trim()));
    console.log(userData);
};

start(config);