/**
 * Default config
 */
const API_URL = 'https://papertrailapp.com/api/v1/searches.json';
const TOKEN_NAME = 'pt_personal_token';
const MAX_SUGGESTIONS = 10;

const headers = new Headers();
const parameters = {
  method: 'GET',
  headers,
  mode: 'cors',
  cache: 'default'
};

/**
 * Object contained cached suggestions
 */
let suggestionsCache = [];

/**
 * Filters a papertrails results response to match Chrome suggestions object
 *
 * @param {array} data
 * @returns
 */
function formatAsSuggestion(data) {
  return {
    content: data._links.html_search.href,
    description: `[${data.group.name}] ${data.name} -`
  }
}

/**
 * Navigates to given URL
 *
 * @param {string} url
 */
function navigate(url) {
  try {
    new URL(url);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.update(tabs[0].id, { url: url });
    });
  } catch (e) { }
}

/*
 * Fetch searches after extension keyword is entered (once per session)
 */
chrome.omnibox.onInputStarted.addListener(
  () => {
    chrome.storage.sync.get({
      [TOKEN_NAME]: ''
    }, async item => {
      if (item[TOKEN_NAME]) {
        parameters.headers.set('X-Papertrail-Token', item[TOKEN_NAME]);
        suggestionsCache = await search(parameters);
      }
    });
  }
);

chrome.omnibox.onInputChanged.addListener(
  (text, suggest) => {
    chrome.storage.sync.get({
      [TOKEN_NAME]: ''
    }, async item => {
      if (suggestionsCache.length) {
        suggest(highlightResults(text, suggestionsCache));
      } else {
        if (item[TOKEN_NAME]) {
          parameters.headers.set('X-Papertrail-Token', item[TOKEN_NAME]);
          suggestionsCache = await search(parameters);
          suggest(highlightResults(text, suggestionsCache));
        }
      }
    });
  }
);

/*
 * Redirects user to the selected suggestion URL
 */
chrome.omnibox.onInputEntered.addListener(
  (url, disposition) => {
    navigate(url);
  }
);

/**
 * Highlights matched text
 *
 * @param {string} text
 * @param {array} results
 * @returns
 */
function highlightResults(text, results) {
  const searchTextRegExp = new RegExp(text, 'i');

  return results
    .filter(suggestion => searchTextRegExp.test(suggestion.description))
    .slice(0, MAX_SUGGESTIONS)
    .map(res => {
      const match = res.description.replace(searchTextRegExp, `<match>$&</match>`);
      return {
        content: res.content,
        description: `<dim>${match}</dim> <url>${res.content}</url>`
      }
    });
}

/**
 * Fetches Papertrail saved searches
 *
 * @param {any} params
 * @returns
 */
async function search(params) {
  try {
    const data = await (await fetch(API_URL, params)).json();
    return data.map(formatAsSuggestion);
  }
  catch (e) {
    throw e;
  }
}
