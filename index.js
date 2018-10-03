const connection = require("./connection");

const csv = require("fast-csv");
const fs = require('fs');
const linkedinConnection = connection.connect;

var contacts = [];

var stream = fs.createReadStream("test-to-populate.csv");

csv.fromStream(stream, { headers: true })
  .on("data", function (data) {
    contacts.push(data);
  })
  .on("end", function () {
    console.log(contacts.length, " contacts parsed \n Starting LinkedIn Search!");
    startSearch();
  });

let writeCsv = () => {
  var csvStream = csv.createWriteStream({ headers: true }),
    writableStream = fs.createWriteStream("test-to-populate-updated.csv");

  csvStream.pipe(writableStream);

  contacts.forEach((contact) => {
    csvStream.write(contact);
  });

  writableStream.on("finish", function () {
    console.log("DONE WRITING!");
    csvStream.end();
  });
}

let startSearch = async () => {
  let page = linkedinConnection();
  await asyncForEach(contacts, async (contact) => {
    console.log('first_name:  ', contact.first_name);
    // filter if empty name
    let filter = filterContact(contact);
    if (filter) {
      return false;
    }
    // get the profile link
    let link = '';
    try {
      link = await searchPersonAndGetLink(contact, page);
      if (link == '') {
        return false;
      }
      // Get person info
      await modifyPersonInfo(page, link, contact);
    } catch (error) {
      console.log('An error occurred while getting the link', error);
      return false;
    }
  });
  writeCsv();
}

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array)
  }
}

let filterContact = (contact) => {
  let filter = false;
  if (contact.first_name == '' || contact.last_name == '') {
    contact.log = 'Not Updated - empty name';
    filter = true;
  }
  return filter;
}

let searchPersonAndGetLink = (person, linkedinPage) => {
  return new Promise(resolve => {
    linkedinPage.then(async (page) => {
      let query = getQueryString(person);
      let searchUrl = 'https://www.linkedin.com/search/results/all/?keywords=' + query + '&origin=GLOBAL_SEARCH_HEADER';
      await page.goto(searchUrl);

      let personLinks = getPossiblePeople(page);

      personLinks.then((links) => {
        if (links && links.length > 0) {
          if (links.length > 1) {
            person.log = 'Not updated - More than one found';
            resolve('');
          }
          person.link = links[0];
          resolve(links[0]);
        } else {
          person.log = 'Not updated - Not found';
          resolve('');
        }
      });
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

function getQueryString(person) {
  let query = '';
  query += person.first_name ? person.first_name + ' ' : '';
  query += person.last_name ? person.last_name : '';
  query += person.job_title ? ', ' + person.job_title : '';
  query += person.company_name ? ', ' + person.company_name : '';

  return query;
}

async function modifyPersonInfo(linkedinPage, link, person) {
  linkedinPage.then(async (page) => {
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

    updatePersonInfo(jobInfo, profileInfo, person);
  });
}

function updatePersonInfo(jobInfo, profileInfo, person) {
  person.Title_update = jobInfo.title;
  person.Company_update = jobInfo.company;
  person.City_update = profileInfo.city;
  person.State_update = profileInfo.state;
  person.log = 'Successfully updated';
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
// function confirmPerson(jobInfo, person) {
//   let isThePerson = false;
//   jobInfo.forEach((info, index) => {
//     if (info === 'Company Name') {
//       if (jobInfo[index + 1].toLowerCase().trim().search(person.job_title.toLowerCase().trim()) !== -1) {
//         isThePerson = true;
//       }
//     }
//   });
//   return isThePerson;
// }

  // const fakePerson = {  
  //     first_name: 'Benito',  
  //     last_name: 'Camelas',
  //     Email: 'estevan.dufrin@rigzone.comm',
  //     job_title: '',
  //     company_name: 'Alert Logicas',
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
