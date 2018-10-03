const puppeteer = require('puppeteer');
const CREDS = [];
CREDS['username'] = 'pvelez@cafetosoftware.com';
CREDS['password'] = 'Osito123$';

module.exports = {
  connect: async function () {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    await page.setViewport({ width: 1200, height: 1200 })

    await page.goto('https://www.linkedin.com/uas/login?session_redirect=%2Fvoyager%2FloginRedirect%2Ehtml&fromSignIn=true&trk=uno-reg-join-sign-in');

    await page.type('#session_key-login', CREDS.username);
    await page.type('#session_password-login', CREDS.password);
    // click and wait for navigation
    await Promise.all([
      page.click('#btn-primary'),
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
    ]);

    await page.goto('https://www.linkedin.com');

    return page;
  }
}