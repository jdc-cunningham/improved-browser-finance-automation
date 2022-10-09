// the end goal of this interface is to produce a JSON interaction structure
// like sample-account.json
// interactions is an array but here it's an object due to the id key
// on save it is turned into an array by order of interaction creation

// temporarily store data until done, then inserted into db
let storage = localStorage.getItem('ibfa-temp-store');
storage = storage ? JSON.parse(storage) : {};

if (!('interactions' in storage)) {
  storage['interactions'] = {};
}

// pop-ui interactive elements
const accountUrl = document.getElementById('account-url');
const selectInteraction = document.getElementById('select-interaction-type');
const addInteraction = document.getElementById('add-interaction');
const addedInteractions = document.getElementById('added-interactions');
const addAccount = document.getElementById('add-account');
const resetButton = document.getElementById('reset');

resetButton.addEventListener('click', () => {
  storage = {};
  saveData();
  loadData(true);
});

const sendMessageToInjectedScript = (msg) => {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, msg, (response) => {
      // not doing anything with response yet
    });
  });
}

const updateValues = (parentId) => {
  Array.from(document.getElementById(parentId).getElementsByTagName('INPUT')).forEach(input => {
    console.log(input.name, input.value);
    storage['interactions'][parentId][input.name] = input.value;
  });
}

// globally bounded event for future elements
// this captures modifications to input elements primarily for interactions
// forms the object and saves, keeps order of interactions
document.addEventListener('keyup', (el) => {
  const parentId = el.target.parentNode.parentNode.id;
  const interactionType = document.getElementById(parentId).getAttribute('data-type');
  console.log('parent id', parentId);
  
  console.log('key up', interactionType);

  if (!(parentId in storage.interactions)) {
    storage.interactions[parentId] = {
      id: parentId,
      type: interactionType
    };
  }

  switch (interactionType) {
    case "input":
    case "button":
    case "2fa option":
    case "2fa input":
    case "balance target":
      updateValues(parentId);
      break;
    default:
      // do nothing
      break;
  }

  saveData();
});

document.addEventListener('click', (el) => {
  if (el.target.nodeName === "BUTTON" && el.target.name === "remove") {
    const parentId = el.target.parentNode.id;
    console.log(parentId, storage);
    storage.interactions[parentId] = undefined;
    document.getElementById(parentId).remove();
    console.log(storage);
    saveData();
  }

  if (el.target.nodeName === "BUTTON" && el.target.name === "element-picker") {
    console.log('pick');
    const parentId = el.target.parentNode.parentNode.id;
    const type = document.getElementById(parentId).querySelector('.type').innerText.split('type: ')[1];

    sendMessageToInjectedScript({
      cmd: 'show-hover-element-picker',
      parentId,
      type
    });
  }
});

const renderHtml = (interaction, id = "") => {
  const dateNow = Date.now();

  switch (interaction.type) {
    case "input":
      return `<div id="${id || dateNow}" data-type="input" class="interaction-group">
        <p class="bold type">type: ${interaction.type || ""}</p>
        <span>name: <input type="text" name="name" value="${interaction.name || ""}"/></span>
        <span>
          dom target: <input type="text" name="dom_target" value="${interaction.dom_target || ""}"/>
          ${!interaction.dom_target ? `<button type="button" name="element-picker" title="click this then hover over element on website">pick element</button>` : ""}
        </span>
        <span>value lookup: <input type="text" name="value_lookup" value="${interaction.value_lookup || ""}"/></span>
        <button name="remove" type="button">remove</button>
      </div>`; // minor duplicate wrapper code
    case "button":
      return `<div id="${id || dateNow}" data-type="button" class="interaction-group">
        <p class="bold type">type: ${interaction.type || ""}</p>
        <span>name: <input type="text" name="name" value="${interaction.name || ""}"/></span>
        <span>
          dom target: <input type="text" name="dom_target" value="${interaction.dom_target || ""}"/>
          ${!interaction.dom_target ? `<button type="button" name="element-picker" title="click this then hover over element on website">pick element</button>` : ""}
        </span>
        <button name="remove" type="button">remove</button>
      </div>`;
    case "2fa option":
      // url is not really important here but can be used
      // there is also the possiblity of multi select issue that's problematic on puppeteer side
      return `<div id="${id || dateNow}" data-type="2fa option" class="interaction-group">
        <p class="bold type">type: ${interaction.type || ""}</p>
        <span>url: <input type="text" name="url" value="${interaction.url || ""}"/></span>
        <span>
          dom target: <input type="text" name="dom_target" value="${interaction.dom_target || ""}"/>
          ${!interaction.dom_target ? `<button type="button" name="element-picker" title="click this then hover over element on website">pick element</button>` : ""}
        </span>
        <button name="remove" type="button">remove</button>
      </div>`;
    case "2fa input":
      return `<div id="${id || dateNow}" data-type="2fa input" class="interaction-group">
        <p class="bold type">type: ${interaction.type || ""}</p>
        <span>name: <input type="text" name="name" value="${interaction.name || ""}"/></span>
        <span>
          dom target: <input type="text" name="dom_target" value="${interaction.dom_target || ""}"/>
          ${!interaction.dom_target ? `<button type="button" name="element-picker" title="click this then hover over element on website">pick element</button>` : ""}
        </span>
        <span>2fa lookup: <input type="text" name="2fa_lookup" value="${interaction.value_lookup || ""}"/></span>
        <button name="remove" type="button">remove</button>
      </div>`;
    case "balance target":
      return `<div id="${id || dateNow}" data-type="balance target" class="interaction-group">
        <p class="bold type">type: ${interaction.type || ""}</p>
        <span>
          dom target: <input type="text" name="dom_target" value="${interaction.dom_target || ""}"/>
          ${!interaction.dom_target ? `<button type="button" name="element-picker" title="click this then hover over element on website">pick element</button>` : ""}
        </span>
        <span>spreadsheet column: <input type="text" name="spreadsheet_column" value="${interaction.spreadsheet_column || ""}"/></span>
        <button name="remove" type="button">remove</button>
      </div>`;
    default:
      return '<p class="bold">Unknown type</p>';
  }
}

const loadData = (reset = false) => {
  if (reset) {
    accountUrl.value = '';
    addedInteractions.innerHTML = `<h3 class="margin-top">added interactions</h3>`;
  }

  if (Object.keys(storage).length) {
    Object.keys(storage).forEach(key => {
      if (key === 'url') {
        accountUrl.value = storage[key];
      } else if (key === 'interactions') {
        // assumes only interactions
        Object.keys(storage.interactions).forEach(interactionId => {
          addedInteractions.innerHTML += renderHtml(storage.interactions[interactionId], interactionId); // dangerous eg. XSS
        });
      }
    });
  }
};

loadData();

const saveData = () => {
  localStorage.setItem('ibfa-temp-store', JSON.stringify(storage));
}

// could add more but paste makes sense
accountUrl.addEventListener('paste', (e) => {
  console.log('paste');
  storage['url'] = e.clipboardData.getData('text/plain');
  saveData();
});

addInteraction.addEventListener('click', () => {
  const selectedInteraction = selectInteraction.value;

  addedInteractions.innerHTML += renderHtml({ // jank object due to shared renderer
    type: selectedInteraction
  });
});

addAccount.addEventListener('click', () => {
  if (Object.keys(storage.interactions).length) {
    // generate JSON from storage
    const newObj = {};

    newObj['url'] = storage.url;
    newObj['interactions'] = [];

    // assumes sorted but can sort by id (ufo sort)
    Object.keys(storage.interactions).forEach(interaction => {
      const tmpObj = {};

      Object.keys(storage.interactions[interaction]).forEach(key => {
        tmpObj[key] = storage.interactions[interaction][key];
      });

      newObj.interactions.push(tmpObj);
    });

    console.log(newObj);
  } else {
    alert('Please add interaction steps');
  }
});

// receive from dom-interaction.js
chrome.runtime.onMessage.addListener((request, sender, callback) => {
  const msg = request;

  console.log(msg);
  
  if (msg?.elementPath) {
    parentId = msg.parentId;
    // validate what it is and clean, also do it on server side
    document.getElementById(msg.parentId).querySelector('input[name=dom_target]').value = msg.elementPath;

    if (!(parentId in storage.interactions)) {
      storage.interactions[parentId] = {
        id: parentId,
        type: msg.type
      };
    }

    storage.interactions[parentId]['dom_target'] = msg.elementPath;
    saveData();
  }

  // have to call this to avoid error
  callback('poup-ui ack');
});