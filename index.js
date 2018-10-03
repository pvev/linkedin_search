( function searchLinkedin() {
const puppeteer = require('puppeteer');
var csv = require("fast-csv");
const fs = require('fs');

var stream = fs.createReadStream("name_titles.1.csv");

var CREDS = [];
CREDS['username'] = 'pablovv2016@gmail.com';
CREDS['password'] = 'Osito123$';

var csvStream = csv.createWriteStream({ headers: true }),
    writableStream = fs.createWriteStream("name_titles_updated2.csv");

writableStream.on("finish", function () {
    console.log("DONE!");
});

csvStream.pipe(writableStream);

var parser = csv.fromStream(stream, { headers: true })
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
        possiblePeople.then((links) => { 
            if (links && links.length > 0) {
                if (links.length > 1) {
                    person.more_that_one = 'More than one found';
                    callback();
                }
                makeMatch(page, links, person, callback);
            } else {
                person.found = 'Not found';
                callback();
            }
        });

    });
};

let getPossiblePeople = async (page) => {
    let peopleLinks = void 0;
    try {
        await page.waitForSelector('div.search-result__info a.search-result__result-link', { timeout: 1000 });
        peopleLinks = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('div.search-result__info a.search-result__result-link'))
            return links.map(link => link.href).slice(0, 10);
        });
    } catch (error) {
        console.log('Error, Person Not Found');
    }
    return peopleLinks;
};

let makeMatch = async (page, links, person, callback) => {
    links.forEach(link => {
        matchPerson(page, link, person, callback)
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
    await page.waitForSelector('section.pv-profile-section');
    const profile = await page.$eval('section.pv-profile-section h3.pv-top-card-section__location', el => el.innerText);
    let profileInfo = profile.split(/\r?\n/);
    profileInfo = getCityAndState(profileInfo);

    person.Title_update = jobInfo.title;
    person.Company_update = jobInfo.company;
    person.City_update = profileInfo.city;
    person.State_update = profileInfo.state;
    person.found = '';
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

function getCityAndState(info) {
    let cityAndState = {};
    let profileInfo = info[0].split(',');

    if (profileInfo[0]) {
        cityAndState.city = profileInfo[0];
    } else {
        cityAndState.city = 'No city in the profile'
    }
    if (profileInfo[1]) {
        cityAndState.state = profileInfo[1];
    } else {
        cityAndState.state = 'No state in the profile'
    }
    return cityAndState;
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

// const fakePerson = {  
//     First_Name: 'Benito',  
//     Last_Name: 'Camelas',
//     Email: 'estevan.dufrin@rigzone.comm',
//     Job_title: '',
//     Company_Name: 'Alert Logicas',
//     Company_update: '',
//     Title_update: '',
//     City: '',
//     State_Region: '',
//     City_update: '',
//     State_update: '',
//     Industry: '',
//     Employees: '',
//     Phone_Number: ''

// }

// searchPerson(fakePerson);
})();
