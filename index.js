const connection = require("./connection");

const csv = require("fast-csv");
const fs = require('fs');
const linkedinConnection = connection.connect;

var contacts = [], contactsStart = 0, contactsEnd = 10, maxTries = 3, queryTries = 0, reRun = false;

var stream = fs.createReadStream("contacts-to-populate-test.csv");

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
      csvStream.write(contact);
      return false;
    }
    // get the profile link 
    let link = '';
    try {
      let query = getQueryStringForGoogle(contact);
      link = await searchPersonAndGetLinkFromGoogle(contact, page, query);

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

  if (contact.first_name === '' || contact.last_name === '') {
    contact.log = 'Not Updated - empty name';
    filter = true;
  }

  if(contact.log === 'Successfully updated') {
    filter = true;
  }

  return filter;
}

let searchPersonAndGetLinkFromGoogle = (person, linkedinPage, query) => {
  return new Promise(resolve => {
    linkedinPage.then(async (page) => {
      try {
        let searchUrl = 'https://www.google.com/search?q=' + query;
        await page.goto(searchUrl);
        console.log(person.first_name, ' - ', person.last_name);

        let links = await getPossiblePeopleFromGoogle(page);

        if (links && links.length > 0) {
          if(isDomain(links[0])){
            console.log('jueputa it is', links[0]);
            resolve(links[0]);
          }
        } else {
          person.log = 'Not updated - Not found';
          resolve('');
        }
        resolve('');
      } catch (error) {
        console.log('Error searching the person')
        resolve('');
      }

    });
  });
};

function isDomain(url) {
  return ( /(ftp|http|https):\/\/?(?:www\.)?linkedin.com(\w+:{0,1}\w*@)?(\S+)(:([0-9])+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/.test(url));
}
 
let getPossiblePeopleFromGoogle = async (page) => {
  let peopleLinks = void 0;
  try {
    await page.waitForSelector('.r > a', { timeout: 1000 });
    peopleLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('.r > a'));
      return links.map(link => link.href).slice(0, 10);
    });
  } catch (error) {
    console.log('Error, Person Not Found');
  }
  return peopleLinks;
};

function getQueryStringForGoogle(person) {
  let query = '';
  query += person.email ? person.email.replace(/['"]+/g, '') + ',' : '';
  query += person.first_name ? person.first_name.replace(/['"]+/g, '') : '';
  query += person.last_name ? ', ' + person.last_name.replace(/['"]+/g, '') : '';
  query += ',linkedin'

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