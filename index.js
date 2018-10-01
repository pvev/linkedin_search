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
var csv = require("fast-csv");
const fs = require('fs');

var stream = fs.createReadStream("name_titles.1.csv");

var csvStream = csv.createWriteStream({ headers: true }),
    writableStream = fs.createWriteStream("name_titles_updated2.csv");

writableStream.on("finish", function () {
    console.log("DONE!");
});

csvStream.pipe(writableStream);

var parser = csv.fromStream(stream, { headers: true })
    // .validate(function (data) {
    //     // empty name or last name
    //     // return (data.First_Name !== '' && data.Last_Name !== ''); 
    // })
    // .on("data-invalid", function (data) {
    //     //do something with invalid row
    //     console.log(data) 
    // })
    .on("data", function (data) {
        parser.pause();
        searchPerson(data, () => {
            parser.resume();
            csvStream.write(data);
        });

    })
    .on("end", function () {
        console.log("done");
        csvStream.end();

    });

// return;

var CREDS = [];
CREDS['username'] = 'pablovv2016@gmail.com';
CREDS['password'] = 'Osito123$';

let scrap = async () => {
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
};

var linkedinPage = scrap();

let searchPerson = async (person, callback) => {
    linkedinPage.then(async (page) => {
        let query = getQueryString(person);
        let searchUrl = 'https://www.linkedin.com/search/results/all/?keywords=' + query + '&origin=GLOBAL_SEARCH_HEADER';
        await page.goto(searchUrl);
        let possiblePeople = getPossiblePeople(page);
        makeMatch(page, possiblePeople, person, callback);
    });
};

let getPossiblePeople = async (page) => {
    await page.waitFor(1000);

    await page.waitForSelector('div.search-result__info a.search-result__result-link');
    const peopleLinks = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('div.search-result__info a.search-result__result-link'))
        return links.map(link => link.href);// .slice(0, 10) 
    });

    return peopleLinks;
};

let makeMatch = async (page, possiblePeople, person, callback) => {
    possiblePeople.then((links) => {
        links.forEach(link => {
            matchPerson(page, link, person, callback)
        });
    });
}

function getQueryString(person) {
    let query = '';
    query += person.First_Name ? person.First_Name + ' ' : '';
    query += person.Last_Name ? person.Last_Name : '';
    query += person.Job_title ? ', ' + person.Job_title : '';
    query += person.Company_Name ? ', ' + person.Company_Name : '';

    return query;
}

async function matchPerson(page, link, person, callback) {
    await page.goto(link);
    await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
    });
    /* get job information */
    await page.waitForSelector('#experience-section');
    const experience = await page.$eval('#experience-section', el => el.innerText);
    let jobInfo = experience.split(/\r?\n/);
    jobInfo = getCompanyAndTitle(jobInfo);
    // console.log(jobInfo);
    /* get the state */
    person.Title_update = jobInfo.title;
    person.Company_update = jobInfo.company;
    callback();

}

function getCompanyAndTitle(jobInfo) {
    let companyAndTitle = {};
    if (jobInfo[1] === 'Company Name') {
        companyAndTitle.company = jobInfo[2];
        let titleIndex = jobInfo.indexOf('Title');
        companyAndTitle.title = jobInfo[titleIndex + 1];

    } else {
        companyAndTitle.title = jobInfo[1];
        companyAndTitle.company = jobInfo[3];
    }

    return companyAndTitle;
}

//TODO confirm if is the person (loop over all companies and compare with company)
function confirmPerson(jobInfo, person) {
    let isThePerson = false;
    jobInfo.forEach((info, index) => {
        if (info === 'Company Name') {
            if (jobInfo[index + 1].toLowerCase().trim().search(person.Job_title.toLowerCase().trim()) !== -1) {
                isThePerson = true;
            }
        }
    });
    return isThePerson;
}

const fakePerson = {
    First_Name: 'Angelica',
    Last_Name: 'Cuellar',
    Email: 'estevan.dufrin@rigzone.comm',
    Job_title: '',
    Company_Name: 'Inbani',
    Company_update: '',
    Title_update: '',
    City: '',
    State_Region: '',
    City_update: '',
    State_update: '',
    Industry: '',
    Employees: '',
    Phone_Number: ''

}

// searchPerson(fakePerson);