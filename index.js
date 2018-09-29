// const puppeteer = require('puppeteer');

// async function getPic() {
//   const browser = await puppeteer.launch({headless: false});
//   const page = await browser.newPage();
//   await page.goto('https://google.com');
//   await page.screenshot({path: 'google.png'});

//   await browser.close();
// }

// getPic();

// const puppeteer = require('puppeteer');

// let scrape = async () => {
//     const browser = await puppeteer.launch({headless: false});
//     const page = await browser.newPage();

//     await page.goto('http://books.toscrape.com/');
//     await page.click('#default > div > div > div > div > section > div:nth-child(2) > ol > li:nth-child(1) > article > div.image_container > a > img');
//     await page.waitFor(1000);

//     const result = await page.evaluate(() => {
//         let title = document.querySelector('h1').innerText;
//         let price = document.querySelector('.price_color').innerText;

//         return {
//             title,
//             price
//         }

//     });

//     browser.close();
//     return result;
// };

// scrape().then((value) => {
//     console.log(value); // Success!
// });

const puppeteer = require('puppeteer');
var csv = require("fast-csv");

// csv.fromPath("name_titles.csv")
//     .on("data", function (data) {
//         console.log(data);
//     })
//     .on("end", function () {
//         console.log("done");
//     });

var CREDS = [];
CREDS['username'] = 'pablovv2016@gmail.com';
CREDS['password'] = 'Osito123$';


let login = async () => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    // let expire = new Date();
    // expire.setDate(expire.getDate() + 1);

    // const cookies = [
    //     {
    //       name: 'JSESSIONID',
    //       value: '"ajax:1023276565147052080"',
    //       domain: '.www.linkedin.com',
    //       path: '/',
    //       expires: expire.getTime(),
    //       size: 36,
    //       httpOnly: false,
    //       secure: true,
    //       session: true,
    //     },
    //     {
    //       name: 'UserMatchHistory',
    //       value: 'AQJKPuZWkZjVXgAAAWYhMjHch0cm1CzrF7SNdISAKhvWEgVQw_fftschnSm2DvQQ-6q8HOxS_AJBsQFJ2k5et1_juEBBtAuXaIb74zMsjK4xOHmhui9F8Orrmd4_qTCu8zDpK5LS-MvPhyY-ZcLoYeEV8qn9o9IRMA',
    //       domain: '.ads.linkedin.com',
    //       path: '/',
    //       expires: expire,
    //       size: 178,
    //       httpOnly: false,
    //       secure: true,
    //       session: true,
    //     },
    //   ];
    //   await page.setCookie(...cookies);

    await page.goto('https://www.linkedin.com/uas/login?session_redirect=%2Fvoyager%2FloginRedirect%2Ehtml&fromSignIn=true&trk=uno-reg-join-sign-in');

    // await page.goto('https://www.linkedin.com/');

    await page.type('#session_key-login', CREDS.username);
    await page.type('#session_password-login', CREDS.password);
    // click and wait for navigation
    await Promise.all([
        page.click('#btn-primary'),
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
    ]);

    await page.goto('https://www.linkedin.com');


    // for (var element of elements) { // Loop through each proudct
    //     let title = element.childNodes[5].innerText; // Select the title
    //     let price = element.childNodes[7].children[0].innerText; // Select the price

    //     data.push({ title, price }); // Push an object with the data onto our array
    // }

    // return data; // Return our data array

    //browser.close();
    // return result; // Return the data

    await page.type('#extended-nav-search input', 'Jueputa que rico');

    return page;
};

// scrape().then((value) => {
//     console.log(value); // Success!
// });

login();

