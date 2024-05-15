let map = L.map('map').setView([60.223671, 25.078039], 13);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

const markergroup = L.layerGroup().addTo(map);

const restaurants = [];
const usercoords = [];
const userIcon = L.divIcon({className: 'user-div-icon'});
const restIcon = L.divIcon({className: 'rest-div-icon'});

(async function () {
  try {
    await Promise.all([getUserPos(), getRestaurants()]);
    console.log('Promises resolved');

    // etäisyys ravintoloihin ja niiden lajottelu
    restaurants.forEach((resta) => {
      if (
        resta.location &&
        resta.location.coordinates &&
        usercoords.length === 2
      ) {
        resta.distance = map.distance(
          [usercoords[0], usercoords[1]],
          [resta.location.coordinates[1], resta.location.coordinates[0]]
        );
      } else {
        resta.distance = Infinity;
      }
    });
    restaurants.sort((a, b) => a.distance - b.distance);
    console.log('Restaurants sorted');
    refreshRestRestaurants();
  } catch (error) {
    console.error(error);
    window.alert('Encountered an error. :(');
  }
})();

/** Modal Menu Maker */
const menumaker = async (restaurant, modal) => {
  const topbar = elementMaker('div', '', 'topbar');
  modal.appendChild(topbar);
  const closebutton = elementMaker('button', 'X', 'closeButton');
  closebutton.onclick = function () {
    modal.close();
  };
  topbar.appendChild(closebutton);
  const namefield = elementMaker('h2', restaurant.name);
  topbar.appendChild(namefield);
  const menubody = elementMaker('div', '', 'menubody');
  modal.appendChild(menubody);
  let dailylist;
  let weeklylist;

  // Get daily and weekly menudata
  const data = await getRestaurantMenu(restaurant._id);
  if (data) {
    const [dailydata, weeklydata] = [data[0], data[1]];

    /* Daily menu */
    dailylist = elementMaker('ul', '', 'dailymenu');
    if (dailydata.error) {
      dailylist.appendChild(elementMaker('li', dailydata.error));
    } else {
      dailydata.courses.forEach((dish) => {
        const li = elementMaker('li', '');
        li.appendChild(elementMaker('h3', dish.name ? dish.name : 'No name'));
        li.appendChild(elementMaker('p', dish.price ? dish.price : 'No price'));
        li.appendChild(
          elementMaker('p', dish.diets ? dish.diets : 'No allergens')
        );
        dailylist.appendChild(li);
      });
    }
    menubody.appendChild(dailylist);

    /* Weekly menu */
    const weeklydiv = elementMaker('div', '', 'weeklydiv');
    if (!weeklydata.days || weeklydata.days.length === 0) {
      weeklydiv.appendChild(elementMaker('h4', weeklydata.error));
    } else {
      weeklydata.days.forEach(async (day) => {
        const card = await makeWeeklyCard(day);
        weeklydiv.appendChild(card);
      });
    }
    weeklydiv.style.display = 'none';
    menubody.appendChild(weeklydiv);

    const dailybutton = elementMaker('button', 'Daily', 'dailyButton');
    dailybutton.onclick = function () {
      dailylist.style.display = 'flex';
      weeklydiv.style.display = 'none';
    };
    topbar.appendChild(dailybutton);

    const weeklybutton = elementMaker('button', 'Weekly', 'weeklyButton');
    weeklybutton.onclick = function () {
      dailylist.style.display = 'none';
      weeklydiv.style.display = 'flex';
    };
    topbar.appendChild(weeklybutton);
  } else {
    console.error('Restaurant data is not ready:', data);
  }
};

/**
 * Get restaurant menu from API by ID
 * @param {string} id - restaurant id
 * @returns {object} restaurant menu
 */
const getRestaurantMenu = async (id) => {
  try {
    const requestdaily = await fetch(
      `https://10.120.32.94/restaurant/api/v1/restaurants/daily/${id}/fi`
    ).then((response) => response.json());
    if (requestdaily.courses.length === 0) {
      requestdaily.error = 'Daily menu not available';
    }

    const requestweekly = await fetch(
      `https://10.120.32.94/restaurant/api/v1/restaurants/weekly/${id}/fi`
    ).then((response) => response.json());
    if (requestweekly.days.length === 0) {
      requestweekly.error = 'Weekly menu not available';
    }

    return [requestdaily, requestweekly];
  } catch (error) {
    console.error('Error fetching menu:', error);
  }
};

/**
 * Refresh restaurants on map and on the list
 */
function refreshRestRestaurants() {
  markergroup.clearLayers();

  // Päivitä käyttäjän markkeri
  if (usercoords.length === 2) {
    L.marker(usercoords, {icon: userIcon}).addTo(markergroup);
  } else {
    console.error('error:', usercoords);
  }

  const list = elementMaker('ul', '', 'restList');
  restaurants.forEach((restaurant) => {
    if (restaurant.location && restaurant.location.coordinates) {
      const lat = restaurant.location.coordinates[1];
      const lng = restaurant.location.coordinates[0];
      if (lat && lng) {
        const marker = L.marker([lat, lng], {icon: restIcon}).addTo(
          markergroup
        );
        console.log(`Added marker for ${restaurant.name}`);

        const modal = elementMaker('dialog', '', 'menuModal');
        menumaker(restaurant, modal);
        document.body.appendChild(modal);

        marker.on('click', function () {
          modal.showModal();
          console.log(restaurant);
        });

        const li2 = elementMaker('ul');
        li2.onclick = function () {
          map.setView([lat, lng], 13);
        };
        li2.appendChild(elementMaker('li', restaurant.name));
        li2.appendChild(
          elementMaker('li', `${restaurant.address}, ${restaurant.city}`)
        );
        li2.appendChild(
          elementMaker('li', (restaurant.distance / 1000).toFixed(2) + ' km')
        );
        li2.appendChild(elementMaker('li', restaurant.company));
        list.appendChild(li2);
      } else {
        console.error('Invalid restaurant coordinates for:', restaurant.name);
      }
    }
  });

  const restlist = document.getElementById('restlist');
  if (restlist) {
    restlist.replaceWith(list);
  } else {
    document.body.appendChild(list);
  }
}

/**
 * Get restaurants from API
 */
async function getRestaurants() {
  try {
    console.log('Fetching restaurants...');
    const response = await fetch(
      'https://10.120.32.94/restaurant/api/v1/restaurants',
      {signal: AbortSignal.timeout(2000)}
    );
    if (!response.ok) {
      throw new Error('HTTP error ' + response.status);
    }
    const data = await response.json();
    console.log(data); // Tarkista data konsolista
    // Lisää ravintolat taulukkoon
    data.forEach((restaurant) => {
      restaurants.push(restaurant);
    });
    return 'Restaurants fetched';
  } catch (error) {
    console.error(error);
    window.alert('Error fetching restaurants (REFRESH the Page)');
  }
}

function error(err) {
  console.warn(`ERROR(${err.code}): ${err.message}`);
}

function success(pos) {
  usercoords.length = 0;
  usercoords.push(pos.coords.latitude, pos.coords.longitude);
  map.setView(usercoords, 13);
  L.marker(usercoords, {icon: userIcon}).addTo(markergroup);
  console.log(usercoords);
}

async function getUserPos() {
  const options = {
    enableHighAccuracy: true,
    timeout: 5000,
    maximumAge: 0,
  };

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(success, error, options);
  } else {
    console.error('Geolocation is not supported by this browser.');
    window.alert('Geolocation is not supported by this browser.');
  }
}

/**
 * Helper function to create DOM elements with specified attributes
 * @param {string} tag -
 * @param {string} [innerHTML]
 * @param {string} [className]
 * @returns {HTMLElement}
 */
const elementMaker = (tag, innerHTML = '', className = '') => {
  const element = document.createElement(tag);
  if (innerHTML) element.innerHTML = innerHTML;
  if (className) element.className = className;
  return element;
};

/**
 * Create weekly card element for the menu
 * @param {object} day -
 * @returns {Promise<HTMLElement>}
 */
const makeWeeklyCard = async (day) => {
  const card = elementMaker('div', '', 'weeklycard');
  const dayName = elementMaker('h4', day.dayName);
  card.appendChild(dayName);

  if (day.courses && day.courses.length > 0) {
    day.courses.forEach((dish) => {
      const dishName = elementMaker('h5', dish.name ? dish.name : 'No name');
      const dishPrice = elementMaker('p', dish.price ? dish.price : 'No price');
      const dishDiets = elementMaker(
        'p',
        dish.diets ? dish.diets : 'No allergens'
      );
      card.appendChild(dishName);
      card.appendChild(dishPrice);
      card.appendChild(dishDiets);
    });
  } else {
    card.appendChild(elementMaker('p', 'No courses available'));
  }

  return card;
};
