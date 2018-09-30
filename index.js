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

// scrape().then((value) => {
//     console.log(value); // Success!   
// });

const puppeteer = require('puppeteer');
// var csv = require("fast-csv");
// const fs = require('fs'); 

// var stream = fs.createReadStream("name_titles.csv");

// var csvStream = csv.createWriteStream({headers: true}),
//     writableStream = fs.createWriteStream("name_titles_updated.csv");

// writableStream.on("finish", function(){
//   console.log("DONE!");
// });

// csvStream.pipe(writableStream);

// csv.fromStream(stream, { headers: true })
//     .validate(function (data) {
//         // empty name or last name
//         return (data.First_Name !== '' && data.Last_Name !== ''); 
//     })
//     .on("data-invalid", function (data) {
//         //do something with invalid row
//         console.log(data)
//     })
//     .on("data", function (data) {
//         // console.log(data);
//         data.First_Name = data.First_Name + ' Updated';
//         csvStream.write(data);

//     })
//     .on("end", function () {
//         console.log("done");
//         csvStream.end();

//     });

// return;

var CREDS = [];
CREDS['username'] = 'pablovv2016@gmail.com';
CREDS['password'] = 'Osito123$';

let scrap = async () => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    await page.setViewport({ width: 1200, height: 720 })

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
};

var linkedinPage = scrap();

let searchPerson = async (name) => {
    this.name = name;
    linkedinPage.then(async (page) => {
        let searchUrl = 'https://www.linkedin.com/search/results/all/?keywords=' + name + '&origin=GLOBAL_SEARCH_HEADER';
        await page.goto(searchUrl);
        let possiblePeople = getPossiblePeople(page);
        possiblePeople.then((links) => {
            console.log(links);
        })
    });
}

let getPossiblePeople = async (page) => {
    await page.waitFor(1000);

    await page.waitForSelector('a.search-result__result-link');
    const peopleLinks = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a.search-result__result-link'))
        return links.map(link => link.href);// .slice(0, 10)
    });

    return peopleLinks;
};

searchPerson('Pablo Velez');