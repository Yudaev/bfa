const puppeteer = require('puppeteer');

let config = {
    url: 'https://s17-ru.bitefight.gameforge.com/user/login',
    width: 1920,
    height: 1080,
    username: 'Allarion'
}

start = async (config) => {
    const browser = await puppeteer.launch({
        headless: false, // The browser is visible
        ignoreHTTPSErrors: true,
        defaultViewport: null,
        args: [`--window-size=${config.width},${config.height}`] // new option
    });
    const page = await browser.newPage();
    await page.goto(config.url);
    await page.$eval('input[name=user]', (el, username) => el.value = username, config.username);
};

start(config);