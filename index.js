const connection = require("./connection");

const csv = require("fast-csv");
const fs = require('fs');
const linkedinConnection = connection.connect;

var contacts = [], contactsStart = 1200, contactsEnd = 1400, maxTries = 3, queryTries = 0, reRun = false;

var stream = fs.createReadStream("contacts-to-populate.csv");

csv.fromStream(stream, { headers: true })
  .on("data", function (data) {
    contacts.push(data);
  })
  .on("end", function () {
    console.log(contacts.length, " contacts parsed \n Starting LinkedIn Search!");
    startSearch();
  });

let fecha = new Date();
fecha = fecha.getFullYear() + "-" + (fecha.getMonth() + 1) + "-" + fecha.getDay() + "-" + fecha.getHours() + "-" + fecha.getMinutes() + "-" + fecha.getSeconds();

var csvStream = csv.createWriteStream({ headers: true }),
  writableStream = fs.createWriteStream("contacts-to-populate-" + contactsStart + "-" + contactsEnd + "-" + fecha + ".csv");

csvStream.pipe(writableStream);

writableStream.on("finish", function () {
  console.log("DONE WRITING!");
  csvStream.end();
});

let startSearch = async () => {
  let page = linkedinConnection();
  let counter = 0;
  await asyncForEach(contacts, async (contact) => {
    counter++;
    // filter if empty name
    let filter = filterContact(contact);
    if (filter) {
      return false;
    }
    // get the profile link 
    let links = '';
    let link = '';
    try {
      queryTries = 0;

      do {
        let query = getQueryString(contact);
        links = await searchPersonAndGetLink(contact, page, query);
      } while (links == '' && queryTries < maxTries);

      if (links == '') {
        // any link found
        link = '';
      } else if (links.length > 1) {
        // several links were found
        // let counter = 0;
        // do {
        //   let isTheOne = await lookForMatch(page, links[counter], contact);
        //   if (isTheOne) {
        //     console.log(links[counter]);
        //     link = links[counter];
        //   }
        //   counter ++;
        // } while (counter < links.length && link == ''); 
        link = '';
      } else {
        // Just one link was found
        link = links[0];
      }
      contact.link = link;
      // Get person info
      if (link != '') {
        let updated = await modifyPersonInfo(page, link, contact);
        console.log(updated);
      }
      console.log(counter, ' contacts updated');
      csvStream.write(contact);
    } catch (error) {
      console.log('An error occurred while getting the link', error);
      return false;
    }
  });
  console.log('Process end, bye!')
  process.exit();
}

async function asyncForEach(array, callback) {
  for (let index = contactsStart; index < contactsEnd; index++) {
    await callback(array[index], index, array)
  }
}

let filterContact = (contact) => {
  let filter = false;
  if (contact.first_name == '' || contact.last_name == '') {
    contact.log = 'Not Updated - empty name';
    filter = true;
  }
  // else if(reRun && contact.log !== 'Not updated - Not found') {
  //   filter = true;
  // }
  return filter;
}

let searchPersonAndGetLink = (person, linkedinPage, query) => {
  queryTries++;
  return new Promise(resolve => {
    linkedinPage.then(async (page) => {
      try {
        let searchUrl = 'https://www.linkedin.com/search/results/all/?keywords=' + query + '&origin=GLOBAL_SEARCH_HEADER';
        await page.goto(searchUrl);

        let personLinks = getPossiblePeople(page);

        personLinks.then((links) => {
          if (links && links.length > 0) {
            if (links.length > 1) {
              person.log = 'Not updated - More than one found';
              resolve(links);
            } else {
              resolve(links);
            }
          } else {
            person.log = 'Not updated - Not found';
            resolve('');
          }
        });
      } catch (error) {
        console.log('Error searching the person')
        resolve('');
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

function getQueryString(person) {
  let query = '';
  query += person.first_name ? person.first_name + ' ' : '';
  query += person.last_name ? person.last_name : '';
  if (queryTries < 1) {
    query += person.job_title ? ', ' + person.job_title.replace(/['"]+/g, '') : '';
  }
  if (queryTries < 2) {
    query += person.company_name ? ', ' + person.company_name.replace(/['"]+/g, '') : '';
  }
  return query;
}

async function modifyPersonInfo(linkedinPage, link, person) {
  return new Promise(resolve => {
    linkedinPage.then(async (page) => {
      try {
        await page.goto(link);
        await page.evaluate(() => {
          window.scrollBy(0, window.innerHeight);
        });
        /* get job information */
        // let jobInfo = '';
        try {
          // aqui es dónde mas falla https://github.com/GoogleChrome/puppeteer/issues/1694 (fuck)
          await page.waitForSelector('#experience-section');
          const experience = await page.$eval('#experience-section', el => el.innerText);
          let jobInfoBase = experience.split(/\r?\n/);
          setCompanyAndTitle(jobInfoBase, person);
        } catch (error) {
          console.log('Error: failed finding experience section');
          // throw error;
        }

        /* get the state */
        // let profileInfo = '';
        try {
          await page.waitForSelector('section.pv-profile-section');
          const profile = await page.$eval('section.pv-profile-section h3.pv-top-card-section__location', el => el.innerText);
          let profileInfo = profile.split(/\r?\n/);
          setCityAndState(profileInfo, person);
        } catch (error) {
          console.log('Error: failed finding profile section');
        }

        // person.title_update = jobInfo.title;
        // person.company_update = jobInfo.company;
        // person.city_update = profileInfo.city;
        // person.state_update = profileInfo.state;
        person.log = 'Successfully updated';
        setTimeout(() => {
          resolve('updated ' + person.first_name + ' ' + person.last_name);
        }, 100);
      } catch (error) {
        console.log('An error occurred while updating person');
        return true;
      }
    });
  });
}

function setCompanyAndTitle(jobInfo, person) {
  if (jobInfo[1] === 'Company Name') {
    person.company_update = jobInfo[2];
    let titleIndex = jobInfo.indexOf('Title');
    person.title_update = jobInfo[titleIndex + 1];
  } else {
    person.title_update = jobInfo[1];
    person.company_update = jobInfo[3];
  }
}

function setCityAndState(info, person) {
  let profileInfo = info[0].split(',');

  if (profileInfo[0]) {
    person.city_update = profileInfo[0];
  } else {
    person.city_update = 'No city in the profile '
  }
  if (profileInfo[1]) {
    person.state_update = profileInfo[1];
  } else {
    person.state_update = 'No state in the profile'
  }
}

async function lookForMatch(linkedinPage, link, person) {
  return new Promise(resolve => {
    linkedinPage.then(async (page) => {
      try {
        await page.goto(link);
        await page.evaluate(() => {
          window.scrollBy(0, window.innerHeight);
        });
        /* get job information */
        await page.waitForSelector('#experience-section', { timeout: 1000 });
        const experience = await page.$eval('#experience-section', el => el.innerText);
        let jobInfoBase = experience.split(/\r?\n/);
        let isThePerson = confirmPerson(jobInfoBase, person);
        resolve(isThePerson);

      } catch (error) {
        console.log('An error occurred while looking for the person: ', error);
      }
    });
  });
}

function confirmPerson(jobInfo, person) {
  let isThePerson = false;
  jobInfo.forEach((info, index) => {
    try {
      if (info === 'Company Name') {
        if (jobInfo[index + 1].toLowerCase().trim() == person.company_name.toLowerCase().trim()) {
          isThePerson = true;
        }
      }
    } catch (error) {
      console.log('did not found the company', error)
    }
  });
  return isThePerson;
}