(() => {
  'use strict';

  const DEFAULT_TEXT = "apple, pear, banana, melon, lemon, grape, kiwi, mango, orange, peach, berry, cherry, date, fig, guava, lime, plum, quince, raisin, strawberry, tomato, vanilla, water, xylophone, yam, zucchini, apricot, blueberry, coconut, durian, elderberry, grapefruit, honeydew, jackfruit, kumquat, lychee, mulberry, nectarine, olive, papaya, raspberry, tangerine, watermelon, avocado, boysenberry, cantaloupe, dragonfruit, persimmon, pomegranate, starfruit, bilberry, blackberry, clementine, cranberry, currant, damson, date, dragonfruit, elderberry, feijoa, fig, goji, gooseberry, grape, grapefruit, guava, huckleberry, jabuticaba, jackfruit, jambul, jujube, kiwi, kumquat, lemon, lime, loganberry, loquat, lychee, mandarin, mango, mangosteen, marionberry, melon, cantaloupe, honeydew, watermelon, miracle fruit, mulberry, nectarine, olive, orange, blood orange, clementine, mandarine, tangerine, papaya, passionfruit, peach, pear, persimmon, plantain, plum, prune, pineapple, pineberry, plumcot, pomegranate, pomelo, purple mangosteen, quince, raspberry, salmonberry, rambutan, redcurrant, salal, salak, satsuma, soursop, star apple, star fruit, strawberry, surinam cherry, tamarillo, tamarind, tangelo, tayberry, tomatillo, ugli fruit, white currant, white sapote, yuzu";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const state = {
    batches: [{ id: 1, text: DEFAULT_TEXT, results: null }],
    currentBatchIndex: 0,
    toastTimeout: null,
    running: false
  };

  const el = {
    wordInput: $('#wordInput'),
    wordCount: $('#wordCount'),
    uniqueCount: $('#uniqueCount'),
    batchLabel: $('#batchLabel'),
    batchSubLabel: $('#batchSubLabel'),
    prevBatchBtn: $('#prevBatchBtn'),
    nextBatchBtn: $('#nextBatchBtn'),
    optimizeBtn: $('#optimizeBtn'),
    clearBtn: $('#clearBtn'),
    loadSampleBtn: $('#loadSampleBtn'),
    emptyLoadSampleBtn: $('#emptyLoadSampleBtn'),
    effortSelect: $('#effortSelect'),
    summaryLine: $('#summaryLine'),
    statusBadge: $('#statusBadge'),
    resultsNotice: $('#resultsNotice'),
    resultsList: $('#resultsList'),
    copyAllBtn: $('#copyAllBtn'),
    downloadReportBtn: $('#downloadReportBtn'),
    statUnique: $('#statUnique'),
    statUsed: $('#statUsed'),
    statChains: $('#statChains'),
    statLeftovers: $('#statLeftovers'),
    geminiApiKey: $('#geminiApiKey'),
    geminiModel: $('#geminiModel'),
    testGeminiBtn: $('#testGeminiBtn'),
    toggleApiKey: $('#toggleApiKey'),
    saveApiKeyBtn: $('#saveApiKeyBtn'),
    removeApiKeyBtn: $('#removeApiKeyBtn'),
    apiKeyStorageStatus: $('#apiKeyStorageStatus'),
    geminiConnectionStatus: $('#geminiConnectionStatus'),
    geminiStatusMessage: $('#geminiStatusMessage'),
    toast: $('#toast')
  };

  const API_KEY_STORAGE_KEY = 'wordpathStudio.geminiApiKey';

  const GEMINI_MODEL_LABELS = {
    'gemini-3.8-flash': 'Gemini 3.8 Flash',
    'gemini-3.7-flash': 'Gemini 3.7 Flash',
    'gemini-3.5-flash': 'Gemini 3.5 Flash',
    'gemini-3.1-pro-preview': 'Gemini 3.1 Pro Preview',
    'gemini-3.1-flash-lite': 'Gemini 3.1 Flash-Lite',
    'gemini-3-flash-preview': 'Gemini 3 Flash Preview'
  };

  function parseWords(text) {
    const entries = String(text || '').split(/[,;\n\r]+/).map(word => word.trim()).filter(Boolean);
    const seen = new Set();
    const unique = [];
    for (const word of entries) {
      const key = word.toLocaleLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(word);
      }
    }
    return { entries, unique, duplicateCount: entries.length - unique.length };
  }

  function currentBatch() {
    return state.batches[state.currentBatchIndex];
  }

  function setStatus(label, variant = 'idle') {
    el.statusBadge.className = `status-pill status-${variant}`;
    const text = document.createTextNode(label);
    el.statusBadge.replaceChildren(document.createElement('span'), text);
  }

  function updateInputMetrics() {
    const parsed = parseWords(el.wordInput.value);
    el.wordCount.textContent = parsed.entries.length.toLocaleString();
    el.uniqueCount.textContent = parsed.unique.length.toLocaleString();
    el.statUnique.textContent = parsed.unique.length.toLocaleString();
    const batch = currentBatch();
    if (batch.results) {
      const result = batch.results;
      const used = result.chains.reduce((sum, chain) => sum + chain.length, 0);
      el.statUsed.textContent = used.toLocaleString();
      el.statChains.textContent = result.chains.length.toLocaleString();
      el.statLeftovers.textContent = result.leftovers.length.toLocaleString();
      if (result.stale) {
        setStatus('Needs refresh', 'stale');
        el.summaryLine.textContent = 'The input changed after the last run. Optimize again to refresh this report.';
      } else {
        setStatus('Optimized', 'complete');
        el.summaryLine.textContent = `${result.chains.length} chain${result.chains.length === 1 ? '' : 's'} created from ${result.uniqueCount} unique words.`;
      }
    } else {
      el.statUsed.textContent = '0';
      el.statChains.textContent = '0';
      el.statLeftovers.textContent = '0';
      setStatus('Ready', 'idle');
      el.summaryLine.textContent = parsed.unique.length
        ? 'Your word list is ready. Run the optimizer to build your first chains.'
        : 'Add your words, then optimize to see the best chains.';
    }
    const hasAnyResults = state.batches.some(item => item.results);
    el.copyAllBtn.hidden = !hasAnyResults;
    el.downloadReportBtn.hidden = !hasAnyResults;
    el.batchSubLabel.textContent = `${state.batches.length} batch${state.batches.length === 1 ? '' : 'es'}`;
  }

  function renderInputView() {
    const batch = currentBatch();
    el.wordInput.value = batch.text;
    el.batchLabel.textContent = `Batch ${batch.id}`;
    el.prevBatchBtn.disabled = state.currentBatchIndex === 0 || state.running;
    el.nextBatchBtn.disabled = state.running;
    el.nextBatchBtn.setAttribute('aria-label', state.currentBatchIndex === state.batches.length - 1 ? 'Create next batch' : 'Open next batch');
    el.batchSubLabel.textContent = `${state.batches.length} batch${state.batches.length === 1 ? '' : 'es'}`;
    updateInputMetrics();
    renderResults();
  }

  function updateCurrentBatchText(value) {
    const batch = currentBatch();
    batch.text = value;
    if (batch.results) batch.results.stale = true;
    updateInputMetrics();
  }

  function prevBatch() {
    if (state.running || state.currentBatchIndex <= 0) return;
    state.currentBatchIndex--;
    renderInputView();
  }

  function nextBatch() {
    if (state.running) return;
    if (state.currentBatchIndex === state.batches.length - 1) {
      state.batches.push({ id: state.batches.length + 1, text: '', results: null });
    }
    state.currentBatchIndex++;
    renderInputView();
    el.wordInput.focus();
  }

  function clearCurrentBatch() {
    const batch = currentBatch();
    batch.text = '';
    batch.results = null;
    el.wordInput.value = '';
    hideNotice();
    updateInputMetrics();
    renderResults();
    showToast('Current batch cleared.');
  }

  function loadSample() {
    const batch = currentBatch();
    batch.text = DEFAULT_TEXT;
    if (batch.results) batch.results.stale = true;
    el.wordInput.value = DEFAULT_TEXT;
    updateInputMetrics();
    showToast('Sample word list loaded.');
  }

  function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  function runPathLogic(wordList, minLength, maxLength) {
    const pool = wordList.map(word => ({ original: word, lower: word.toLocaleLowerCase() }));
    const successes = [];
    const failures = [];

    while (pool.length > 0) {
      if (pool.length < minLength) {
        failures.push(...pool.map(item => item.original));
        break;
      }

      const startIndex = Math.floor(Math.random() * pool.length);
      const start = pool.splice(startIndex, 1)[0];
      const currentChain = [{ obj: start, entryIndex: null }];

      for (let i = 0; i < maxLength - 1; i++) {
        const currentLink = currentChain[currentChain.length - 1];
        const word = currentLink.obj.lower;
        const entryIndex = currentLink.entryIndex;
        const bannedChars = new Set();

        if (entryIndex !== null) {
          bannedChars.add(word[entryIndex]);
          if (entryIndex > 0) bannedChars.add(word[entryIndex - 1]);
          if (entryIndex < word.length - 1) bannedChars.add(word[entryIndex + 1]);
        }

        let potentialChars = [...new Set(word.split('').filter(char => !bannedChars.has(char)))];
        shuffleArray(potentialChars);
        let foundNextWord = false;

        for (const char of potentialChars) {
          const candidates = [];
          for (let p = 0; p < pool.length; p++) {
            if (pool[p].lower.includes(char)) candidates.push(p);
          }
          if (candidates.length === 0) continue;

          const chosenPoolIndex = candidates[Math.floor(Math.random() * candidates.length)];
          const nextWord = pool[chosenPoolIndex];
          const possibleEntryIndices = [];
          for (let c = 0; c < nextWord.lower.length; c++) {
            if (nextWord.lower[c] === char) possibleEntryIndices.push(c);
          }
          const chosenEntryIndex = possibleEntryIndices[Math.floor(Math.random() * possibleEntryIndices.length)];
          pool.splice(chosenPoolIndex, 1);
          currentChain.push({ obj: nextWord, entryIndex: chosenEntryIndex });
          foundNextWord = true;
          break;
        }
        if (!foundNextWord) break;
      }

      if (currentChain.length >= minLength) successes.push(currentChain);
      else failures.push(...currentChain.map(item => item.obj.original));
    }
    return { successes, leftovers: failures };
  }

  function findBestGeneration(allWords, attempts) {
    let bestConfig = null;
    let minLeftoverCount = Infinity;
    let bestChainCount = -1;
    const stageTwoAttempts = 10;

    for (let i = 0; i < attempts; i++) {
      const stageOne = runPathLogic([...allWords], 10, 10);
      let bestStageTwo = null;
      let minStageTwoLeftovers = Infinity;
      let stageTwoChainCount = -1;

      for (let j = 0; j < stageTwoAttempts; j++) {
        const stageTwo = runPathLogic([...stageOne.leftovers], 7, 10);
        if (stageTwo.leftovers.length < minStageTwoLeftovers ||
          (stageTwo.leftovers.length === minStageTwoLeftovers && stageTwo.successes.length > stageTwoChainCount)) {
          minStageTwoLeftovers = stageTwo.leftovers.length;
          stageTwoChainCount = stageTwo.successes.length;
          bestStageTwo = stageTwo;
        }
      }

      const chainCount = stageOne.successes.length + bestStageTwo.successes.length;
      if (bestStageTwo.leftovers.length < minLeftoverCount ||
        (bestStageTwo.leftovers.length === minLeftoverCount && chainCount > bestChainCount)) {
        minLeftoverCount = bestStageTwo.leftovers.length;
        bestChainCount = chainCount;
        bestConfig = {
          chains: [...stageOne.successes, ...bestStageTwo.successes],
          leftovers: bestStageTwo.leftovers
        };
      }
    }
    return bestConfig || { chains: [], leftovers: [...allWords] };
  }

  function createEl(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function createIconButton(label, className = 'chain-copy') {
    const button = createEl('button', className, label);
    button.type = 'button';
    button.setAttribute('aria-label', label);
    return button;
  }

  function formatCrosswordText(result) {
    const title = String(result.title || 'Crossword Wordlist').trim();
    const wordLine = `Source words: ${result.words.join(', ')}`;
    const clueLines = result.words.map(word => {
      const clue = result.clues[word.toLocaleLowerCase()] || 'A clue is not available for this word.';
      return `${word}: ${clue}`;
    });
    return `${title}\n\n${wordLine}\n\n${clueLines.join('\n')}`;
  }

  function renderCrosswordOutput(chain) {
    const result = chain.crossword && chain.crossword.result;
    const wrap = createEl('div', 'crossword-output');
    if (chain.crossword && chain.crossword.loading) {
      wrap.classList.add('crossword-loading');
      wrap.append(createEl('span', 'ai-loading-dot'), createEl('span', '', 'Gemini is writing your title and clues…'));
      return wrap;
    }
    if (chain.crossword && chain.crossword.error) {
      wrap.classList.add('crossword-error');
      wrap.append(createEl('strong', '', 'Could not generate this wordlist'), createEl('p', '', chain.crossword.error));
      return wrap;
    }
    if (!result) return null;

    const header = createEl('div', 'crossword-output-head');
    const heading = createEl('h4', '', result.title || 'Crossword Wordlist');
    const copy = createEl('button', 'button button-copy-content', 'Copy full content');
    copy.type = 'button';
    copy.addEventListener('click', () => copyText(formatCrosswordText(result), 'Crossword title and clues copied.'));
    header.append(heading, copy);

    const fromLine = createEl('div', 'crossword-from-line', `From: ${result.words.join(', ')} To`);
    const clueList = createEl('dl', 'crossword-clue-list');
    result.words.forEach(word => {
      const term = createEl('dt', '', word);
      const definition = createEl('dd', '', result.clues[word.toLocaleLowerCase()] || 'A clue is not available for this word.');
      clueList.append(term, definition);
    });
    const generatedBy = createEl('p', 'crossword-generated-by', `Generated with ${result.modelLabel}`);
    wrap.append(header, fromLine, clueList, generatedBy);
    return wrap;
  }

  function renderChainCard(chain, number, batchIndex) {
    const words = chain.map(item => item.obj.original);
    const plainText = words.join(', ');
    const cardClass = chain.length >= 10 ? 'chain-card chain-strong' : (chain.length >= 8 ? 'chain-card chain-medium' : 'chain-card chain-short');
    const card = createEl('article', cardClass);
    const head = createEl('div', 'chain-card-head');
    const meta = createEl('div', 'chain-card-name');
    meta.append(createEl('strong', '', `Chain ${number}`), createEl('span', 'chain-count', `${chain.length} words`));
    const copy = createIconButton('Copy', 'chain-copy');
    copy.setAttribute('aria-label', `Copy chain ${number} from batch ${state.batches[batchIndex].id}`);
    copy.addEventListener('click', () => copyText(plainText, 'Chain copied.'));
    head.append(meta, copy);

    const flow = createEl('div', 'chain-flow');
    flow.setAttribute('aria-label', `Chain ${number}: ${plainText}`);
    words.forEach((word, index) => {
      flow.appendChild(createEl('span', 'word-node', word));
      if (index < words.length - 1) flow.appendChild(createEl('span', 'chain-arrow', '→'));
    });
    const preview = createEl('div', 'plain-preview', plainText);

    const aiButton = createEl('button', 'button button-ai-generate', chain.crossword && chain.crossword.result ? 'Regenerate crossword wordlist' : 'Generate wordlist (for crossword)');
    aiButton.type = 'button';
    aiButton.disabled = Boolean(chain.crossword && chain.crossword.loading);
    if (aiButton.disabled) aiButton.textContent = 'Generating wordlist…';
    aiButton.addEventListener('click', () => generateCrosswordWordlist(chain, batchIndex));
    const aiActions = createEl('div', 'crossword-card-actions');
    aiActions.append(aiButton);

    card.append(head, flow, preview, aiActions);
    const aiOutput = renderCrosswordOutput(chain);
    if (aiOutput) card.appendChild(aiOutput);
    return card;
  }
  function renderLeftoverCard(words, batchIndex) {
    const card = createEl('article', 'chain-card leftover-card');
    const head = createEl('div', 'chain-card-head');
    const meta = createEl('div', 'chain-card-name');
    meta.append(createEl('strong', '', 'Unused words'), createEl('span', 'chain-count', `${words.length} items`));
    const copy = createIconButton('Copy', 'chain-copy');
    copy.setAttribute('aria-label', `Copy unused words from batch ${state.batches[batchIndex].id}`);
    copy.addEventListener('click', () => copyText(words.join(', '), 'Unused words copied.'));
    head.append(meta, copy);

    const canRetry = words.length >= 7;
    const content = createEl('div', 'plain-preview', words.join(', '));
    card.appendChild(head);
    if (canRetry) {
      const retry = createEl('button', 'retry-button');
      retry.type = 'button';
      retry.append(document.createTextNode('↻  Retry these leftovers'));
      retry.addEventListener('click', () => processLeftoversManual(batchIndex));
      card.appendChild(retry);
    }
    card.appendChild(content);
    return card;
  }

  function renderBatchResults(batch, batchIndex) {
    const results = batch.results;
    const section = createEl('section', 'batch-results');
    section.setAttribute('aria-label', `Results for batch ${batch.id}`);
    const header = createEl('div', 'batch-results-header');
    const titleWrap = createEl('div', 'batch-results-title');
    const titleContent = createEl('div');
    titleContent.append(createEl('h3', '', `Batch ${batch.id}`));
    titleContent.append(createEl('p', '', `${results.uniqueCount} unique input words${results.stale ? ' · last run shown' : ''}`));
    titleWrap.append(titleContent);
    const total = createEl('span', 'batch-total', `${results.chains.length} chains · ${results.leftovers.length} unused`);
    header.append(titleWrap, total);
    section.appendChild(header);

    if (results.stale) {
      const stale = createEl('div', 'notice');
      stale.textContent = 'This is the previous result for this batch. The input has changed since it was optimized.';
      section.appendChild(stale);
    }

    const grid = createEl('div', 'chains-grid');
    const sortedChains = [...results.chains].sort((a, b) => b.length - a.length);
    sortedChains.forEach((chain, index) => grid.appendChild(renderChainCard(chain, index + 1, batchIndex)));
    if (results.leftovers.length > 0) grid.appendChild(renderLeftoverCard(results.leftovers, batchIndex));
    else if (results.chains.length > 0) grid.appendChild(createEl('div', 'no-leftovers', 'Great result. Every unique input word was placed into a chain.'));
    if (!results.chains.length && results.leftovers.length) {
      const noChains = createEl('div', 'notice');
      noChains.textContent = 'No chain met the minimum length on this run. Try Deep optimization or adjust the word list.';
      section.appendChild(noChains);
    }
    section.appendChild(grid);
    return section;
  }

  function renderResults() {
    el.resultsList.replaceChildren();
    const completed = state.batches.map((batch, index) => ({ batch, index })).filter(item => item.batch.results);
    if (!completed.length) {
      const empty = createEl('div', 'empty-state');
      empty.id = 'emptyState';
      const illustration = createEl('div', 'empty-illustration');
      illustration.setAttribute('aria-hidden', 'true');
      illustration.append(createEl('span', 'empty-letter letter-a', 'A'), createEl('span', 'empty-letter letter-b', 'B'), createEl('span', 'empty-letter letter-c', 'C'));
      const svgHolder = createEl('span');
      svgHolder.innerHTML = '<svg viewBox="0 0 96 52"><path d="M13 27h25m20 0h25M38 27l8-8 12 8-12 8-8-8Z"/></svg>';
      illustration.appendChild(svgHolder.firstElementChild);
      const heading = createEl('h3', '', 'Your next great chain starts here.');
      const description = createEl('p', '', 'Enter a word list and run the optimizer. Your chains and any unused words will appear here, ready to copy or export.');
      const sample = createEl('button', 'button button-secondary', 'Try the sample list');
      sample.type = 'button';
      sample.addEventListener('click', loadSample);
      empty.append(illustration, heading, description, sample);
      el.resultsList.appendChild(empty);
    } else {
      completed.forEach(({ batch, index }) => el.resultsList.appendChild(renderBatchResults(batch, index)));
    }
  }

  function selectedGeminiModel() {
    return el.geminiModel.value;
  }

  function setGeminiStatus(label, kind, message) {
    el.geminiConnectionStatus.className = `ai-status ai-status-${kind}`;
    el.geminiConnectionStatus.textContent = label;
    if (message) el.geminiStatusMessage.textContent = message;
  }

  function updateApiKeyStorageStatus() {
    const currentKey = el.geminiApiKey.value.trim();
    let savedKey;
    try {
      savedKey = window.localStorage.getItem(API_KEY_STORAGE_KEY);
    } catch (_) {
      el.apiKeyStorageStatus.textContent = 'Browser storage is unavailable here. The key will only be available while this page is open.';
      el.removeApiKeyBtn.disabled = true;
      return;
    }

    const hasSavedKey = Boolean(savedKey);
    el.removeApiKeyBtn.disabled = !hasSavedKey;
    if (hasSavedKey && currentKey === savedKey) {
      el.apiKeyStorageStatus.textContent = 'This key is saved in this browser until you remove it or clear this site’s browser data.';
    } else if (hasSavedKey && currentKey) {
      el.apiKeyStorageStatus.textContent = 'The key in the field is different from the saved key. Select “Save key in this browser” to update the saved copy.';
    } else if (hasSavedKey) {
      el.apiKeyStorageStatus.textContent = 'A key is still saved in this browser. Select “Remove saved key” to delete it.';
    } else if (currentKey) {
      el.apiKeyStorageStatus.textContent = 'This key is not saved yet. Select “Save key in this browser” to keep it for future visits.';
    } else {
      el.apiKeyStorageStatus.textContent = 'No API key saved in this browser.';
    }
  }

  function loadSavedApiKey() {
    try {
      const savedKey = window.localStorage.getItem(API_KEY_STORAGE_KEY);
      if (savedKey) {
        el.geminiApiKey.value = savedKey;
        setGeminiStatus('Saved key loaded', 'neutral', 'A saved key was loaded from this browser. Test the connection before generating clues.');
      }
    } catch (_) {
      // The application remains usable without browser storage.
    }
    updateApiKeyStorageStatus();
  }

  function saveApiKey() {
    const apiKey = el.geminiApiKey.value.trim();
    if (!apiKey) {
      setGeminiStatus('API key needed', 'error', 'Paste a Gemini API key before saving it.');
      el.geminiApiKey.focus();
      showToast('Paste an API key before saving.');
      updateApiKeyStorageStatus();
      return;
    }
    try {
      window.localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
      updateApiKeyStorageStatus();
      setGeminiStatus('Not tested', 'neutral', 'API key saved in this browser. Test the connection to verify access.');
      showToast('API key saved in this browser.');
    } catch (_) {
      el.apiKeyStorageStatus.textContent = 'Could not save the key. Browser storage may be blocked or unavailable. The key remains only in the current page field.';
      showToast('Browser storage blocked the save.');
    }
  }

  function removeSavedApiKey() {
    try {
      window.localStorage.removeItem(API_KEY_STORAGE_KEY);
      el.geminiApiKey.value = '';
      updateApiKeyStorageStatus();
      setGeminiStatus('Not tested', 'neutral', 'Saved API key removed. Enter a key again when you want to generate AI clues.');
      showToast('Saved API key removed and input cleared.');
    } catch (_) {
      el.apiKeyStorageStatus.textContent = 'Could not remove the saved key because browser storage is unavailable. Try clearing this site’s data in browser settings.';
      showToast('Browser storage blocked removal.');
    }
  }

  function friendlyGeminiError(message, status) {
    const raw = String(message || 'The request failed.').replace(/https?:\/\/[^\s]+/gi, '').trim();
    const lower = raw.toLocaleLowerCase();
    if (status === 400 && (lower.includes('api key') || lower.includes('key') || lower.includes('api_key_invalid'))) return 'Google rejected this API key. Create a current key in Google AI Studio, or make sure your standard key is restricted to the Gemini API. Check the key and try again.';
    if (status === 401 || status === 403 || lower.includes('permission')) return 'Access was denied. Check the key, project permissions, and Gemini API access. A current authorization key or a Gemini-API-restricted standard key may be required.';
    if (status === 404 || lower.includes('not found')) return 'This model endpoint was not found or is unavailable to this API key. Try another model from the menu.';
    if (status === 429 || lower.includes('quota') || lower.includes('rate')) return 'The model quota or rate limit was reached. Check your Google AI Studio quota and try again later.';
    if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('load failed')) return 'The browser could not reach Google. Check your internet connection and retry. If the file was opened directly, try running it from localhost or a static web host.';
    return raw.length > 240 ? `${raw.slice(0, 237)}…` : raw;
  }

  async function requestGemini(prompt, options = {}) {
    const apiKey = el.geminiApiKey.value.trim();
    if (!apiKey) throw new Error('Paste a Gemini API key first.');
    const model = options.model || selectedGeminiModel();
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const generationConfig = { maxOutputTokens: options.maxOutputTokens || 1800 };
    generationConfig.temperature = 0.35;
    if (options.jsonSchema) {
      generationConfig.responseFormat = {
        text: { mimeType: 'APPLICATION_JSON', schema: options.jsonSchema }
      };
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), options.timeoutMs || 60000);
    let response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig
        }),
        signal: controller.signal
      });
    } catch (error) {
      if (error && error.name === 'AbortError') {
        throw new Error('The request timed out. Check your connection, then retry or choose a faster model.');
      }
      throw new Error(friendlyGeminiError(error && error.message ? error.message : 'NetworkError'));
    } finally {
      window.clearTimeout(timeoutId);
    }

    let payload;
    try { payload = await response.json(); }
    catch (_) { payload = {}; }
    if (!response.ok) {
      const apiMessage = payload && payload.error && payload.error.message ? payload.error.message : `Gemini request failed (${response.status}).`;
      throw new Error(friendlyGeminiError(apiMessage, response.status));
    }
    const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
    const answer = candidates
      .flatMap(candidate => candidate && candidate.content && Array.isArray(candidate.content.parts) ? candidate.content.parts : [])
      .map(part => part && typeof part.text === 'string' ? part.text : '')
      .join('\n')
      .trim();
    if (!answer) {
      const blockReason = payload.promptFeedback && payload.promptFeedback.blockReason;
      const reason = candidates[0] && candidates[0].finishReason;
      if (blockReason) throw new Error(`Google blocked this request (${blockReason}). Try a different prompt or model.`);
      throw new Error(reason ? `Gemini returned no text (${reason}). Try another model or a shorter input.` : 'Gemini returned an empty response. Please retry.');
    }
    return answer;
  }

  async function testGeminiConnection() {
    const apiKey = el.geminiApiKey.value.trim();
    if (!apiKey) {
      setGeminiStatus('API key needed', 'error', 'Paste your Gemini API key to test this model.');
      el.geminiApiKey.focus();
      return;
    }
    const model = selectedGeminiModel();
    el.testGeminiBtn.disabled = true;
    el.testGeminiBtn.classList.add('is-loading');
    el.testGeminiBtn.querySelector('span')?.remove();
    el.testGeminiBtn.setAttribute('aria-busy', 'true');
    const originalLabel = 'Test connection';
    el.testGeminiBtn.dataset.originalLabel = originalLabel;
    el.testGeminiBtn.lastChild.textContent = 'Testing…';
    setGeminiStatus('Connecting…', 'working', `Checking access to ${GEMINI_MODEL_LABELS[model] || model}…`);
    try {
      const answer = await requestGemini('Reply with exactly this text and nothing else: WORDPATH_OK', { model, maxOutputTokens: 40 });
      if (!answer.toLocaleUpperCase().includes('WORDPATH_OK')) {
        throw new Error('The model responded, but the quick check was unexpected. You can still try generating a wordlist.');
      }
      setGeminiStatus('Connected', 'success', `Connection successful. ${GEMINI_MODEL_LABELS[model]} is responding and ready for crossword wordlists.`);
      showToast('Gemini connection test passed.');
    } catch (error) {
      const message = friendlyGeminiError(error && error.message ? error.message : 'Connection failed');
      setGeminiStatus('Connection failed', 'error', message);
    } finally {
      el.testGeminiBtn.disabled = false;
      el.testGeminiBtn.classList.remove('is-loading');
      el.testGeminiBtn.removeAttribute('aria-busy');
      el.testGeminiBtn.replaceChildren();
      const iconHolder = document.createElement('span');
      iconHolder.className = 'button-ai-test-icon';
      iconHolder.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5 12 7.8l5.5 2.2-5.5 2.2L10 17.5l-2-5.3L2.5 10 8 7.8 10 2.5Z"/><path d="m16.2 2 .6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6.6-1.4Z"/></svg>';
      el.testGeminiBtn.append(iconHolder, document.createTextNode('Test connection'));
    }
  }

  const CLUE_LENGTHS = {
    short: 'Keep every clue very brief: 2 to 5 words, like a classic crossword clue.',
    medium: 'Keep each clue to a concise phrase or one short sentence, about 6 to 12 words.',
    long: 'Write fuller clues of about 12 to 20 words, adding helpful context without giving away the answer.',
    descriptive: 'Write descriptive clues of one or two complete sentences (roughly 20 to 35 words), with helpful context and detail but without giving away the answer.'
  };
  function clueLengthInstruction() {
    const select = $('#clueLength');
    return CLUE_LENGTHS[select ? select.value : 'medium'] || CLUE_LENGTHS.medium;
  }

  async function generateCrosswordWordlist(chain, batchIndex) {
    if (chain.crossword && chain.crossword.loading) return;
    const words = chain.map(item => item.obj.original);
    if (!words.length) return;
    if (!el.geminiApiKey.value.trim()) {
      setGeminiStatus('API key needed', 'error', 'Paste a Gemini API key and test the connection before generating a wordlist.');
      el.geminiApiKey.focus();
      showToast('Add your Gemini API key first.');
      return;
    }

    const model = selectedGeminiModel();
    chain.crossword = { loading: true, error: null, result: null };
    renderResults();
    setGeminiStatus('Generating…', 'working', `Gemini is creating a title and ${words.length} clues using ${GEMINI_MODEL_LABELS[model] || model}.`);
    const schema = {
      type: 'object',
      properties: {
        title: { type: 'string' },
        entries: {
          type: 'array',
          items: {
            type: 'object',
            properties: { word: { type: 'string' }, clue: { type: 'string' } },
            required: ['word', 'clue'],
            additionalProperties: false
          }
        }
      },
      required: ['title', 'entries'],
      additionalProperties: false
    };
    const prompt = `Create a polished, ready-to-use crossword wordlist from the exact words below.\n\nRequirements:\n1. Write one short, appealing title that fits this word set.\n2. Write one accurate, clear crossword-style clue for every word. ${clueLengthInstruction()}\n3. Keep all input words exactly as supplied, with their spelling and spacing unchanged. Include each input word exactly once and preserve the original order. Do not add any words.\n4. Clues should identify the meaning naturally without simply repeating the answer. Use common, age-appropriate language. Avoid inventing details when a word is ambiguous.\n5. Return only the requested JSON structure, with title and entries (each entry has word and clue).\n\nWords:\n${JSON.stringify(words)}`;
    try {
      const raw = await requestGemini(prompt, { model, maxOutputTokens: Math.min(8000, 900 + words.length * ((($('#clueLength') || {}).value === 'descriptive') ? 200 : 110)), jsonSchema: schema });
      let parsed;
      try {
        const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
        parsed = JSON.parse(clean);
      } catch (_) {
        throw new Error('Gemini responded, but the clue list was not in the expected format. Please try generating it again.');
      }
      if (!parsed || !Array.isArray(parsed.entries)) throw new Error('Gemini returned an incomplete wordlist. Please try again.');
      const clues = {};
      const responseEntries = new Map();
      parsed.entries.forEach(entry => {
        if (entry && typeof entry.word === 'string' && typeof entry.clue === 'string') {
          responseEntries.set(entry.word.trim().toLocaleLowerCase(), entry.clue.trim());
        }
      });
      const missing = words.filter(word => {
        const clue = responseEntries.get(word.toLocaleLowerCase());
        return !clue || !clue.trim();
      });
      if (missing.length) throw new Error(`Gemini missed a usable clue for ${missing.length} word${missing.length === 1 ? '' : 's'}. Generate again for a complete list.`);
      words.forEach(word => { clues[word.toLocaleLowerCase()] = responseEntries.get(word.toLocaleLowerCase()).trim(); });
      const safeTitle = String(parsed.title || 'Crossword Wordlist').trim().slice(0, 140) || 'Crossword Wordlist';
      chain.crossword = {
        loading: false,
        error: null,
        result: { title: safeTitle, words, clues, model, modelLabel: GEMINI_MODEL_LABELS[model] || model, timestamp: new Date() }
      };
      setGeminiStatus('Connected', 'success', `Wordlist generated successfully with ${GEMINI_MODEL_LABELS[model] || model}. Your generated content is ready to copy.`);
      renderResults();
      showToast('Crossword wordlist generated.');
    } catch (error) {
      const message = friendlyGeminiError(error && error.message ? error.message : 'Generation failed');
      chain.crossword = { loading: false, error: message, result: null };
      setGeminiStatus('Generation failed', 'error', message);
      renderResults();
    }
  }

  function showNotice(message, kind = 'success') {
    el.resultsNotice.textContent = message;
    el.resultsNotice.className = `notice ${kind === 'error' ? 'notice-error' : (kind === 'success' ? 'notice-success' : '')}`;
    el.resultsNotice.hidden = false;
  }

  function hideNotice() {
    el.resultsNotice.hidden = true;
    el.resultsNotice.textContent = '';
    el.resultsNotice.className = 'notice';
  }

  function startOptimizedGeneration() {
    if (state.running) return;
    const batch = currentBatch();
    const parsed = parseWords(batch.text);
    if (!parsed.unique.length) {
      showNotice('Add at least one word before running the optimizer.', 'error');
      el.wordInput.focus();
      return;
    }

    const attempts = Number(el.effortSelect.value) || 50;
    state.running = true;
    el.optimizeBtn.disabled = true;
    el.prevBatchBtn.disabled = true;
    el.nextBatchBtn.disabled = true;
    el.optimizeBtn.querySelector('span').textContent = 'Optimizing…';
    setStatus('Working', 'working');
    el.summaryLine.textContent = `Exploring ${attempts} optimization passes across your unique words…`;
    hideNotice();

    window.setTimeout(() => {
      const start = performance.now();
      try {
        const best = findBestGeneration(parsed.unique, attempts);
        best.chains.sort((a, b) => b.length - a.length);
        batch.results = {
          chains: best.chains,
          leftovers: best.leftovers,
          uniqueCount: parsed.unique.length,
          inputCount: parsed.entries.length,
          attempts,
          elapsedMs: Math.round(performance.now() - start),
          stale: false,
          timestamp: new Date()
        };
        renderInputView();
        const elapsed = batch.results.elapsedMs;
        showNotice(`Optimization complete in ${elapsed < 1000 ? `${elapsed} ms` : `${(elapsed / 1000).toFixed(1)} s`}. ${parsed.duplicateCount ? `${parsed.duplicateCount} duplicate entr${parsed.duplicateCount === 1 ? 'y was' : 'ies were'} skipped. ` : ''}${best.leftovers.length ? `${best.leftovers.length} word${best.leftovers.length === 1 ? '' : 's'} left unused.` : 'All unique words were placed into chains.'}`, 'success');
      } catch (error) {
        console.error('WordPath optimization failed:', error);
        showNotice('Something went wrong while optimizing this list. Try a smaller batch or choose Quick mode.', 'error');
        setStatus('Error', 'stale');
      } finally {
        state.running = false;
        el.optimizeBtn.disabled = false;
        el.optimizeBtn.querySelector('span').textContent = 'Optimize word paths';
        el.prevBatchBtn.disabled = state.currentBatchIndex === 0;
        el.nextBatchBtn.disabled = false;
      }
    }, 35);
  }

  function processLeftoversManual(batchIndex) {
    const batch = state.batches[batchIndex];
    if (!batch || !batch.results || batch.results.leftovers.length < 7 || state.running) return;
    const leftoverWords = [...batch.results.leftovers];
    const retried = runPathLogic(leftoverWords, 7, 10);
    if (!retried.successes.length) {
      showToast('No additional chain found. Try Deep optimization.');
      return;
    }
    batch.results.chains.push(...retried.successes);
    batch.results.leftovers = retried.leftovers;
    batch.results.stale = false;
    batch.results.timestamp = new Date();
    if (batchIndex === state.currentBatchIndex) updateInputMetrics();
    renderResults();
    showNotice(`Leftover retry created ${retried.successes.length} additional chain${retried.successes.length === 1 ? '' : 's'}.`, 'success');
  }

  function buildReport() {
    const lines = ['WORDPATH OPTIMIZER STUDIO', `Generated: ${new Date().toLocaleString()}`, ''];
    let found = false;
    state.batches.forEach(batch => {
      if (!batch.results) return;
      found = true;
      lines.push(`=== BATCH ${batch.id} ===`);
      lines.push(`Unique input words: ${batch.results.uniqueCount}`);
      lines.push(`Optimization effort: ${batch.results.attempts} passes`);
      lines.push(`Chains created: ${batch.results.chains.length}`);
      lines.push('');
      const chains = [...batch.results.chains].sort((a, b) => b.length - a.length);
      chains.forEach((chain, index) => {
        lines.push(`Chain ${index + 1} (${chain.length} words): ${chain.map(item => item.obj.original).join(' → ')}`);
        if (chain.crossword && chain.crossword.result) {
          lines.push('');
          lines.push(formatCrosswordText(chain.crossword.result));
        }
      });
      if (batch.results.leftovers.length) lines.push(`Unused words: ${batch.results.leftovers.join(', ')}`);
      else lines.push('Unused words: None');
      if (batch.results.stale) lines.push('NOTE: This report reflects the last run before the input was edited.');
      lines.push('');
    });
    if (!found) return 'No optimization results yet.';
    return lines.join('\n').trim();
  }

  async function copyText(text, successMessage = 'Copied to clipboard.') {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const helper = document.createElement('textarea');
        helper.value = text;
        helper.setAttribute('readonly', '');
        helper.style.position = 'fixed';
        helper.style.opacity = '0';
        document.body.appendChild(helper);
        helper.select();
        const ok = document.execCommand('copy');
        helper.remove();
        if (!ok) throw new Error('Clipboard copy command failed');
      }
      showToast(successMessage);
    } catch (error) {
      console.warn('Clipboard access failed:', error);
      showToast('Clipboard access was blocked by the browser.');
    }
  }

  function copyAllResults() {
    copyText(buildReport(), 'Full report copied.');
  }

  function downloadReport() {
    const report = buildReport();
    if (report === 'No optimization results yet.') {
      showToast('Run the optimizer before exporting a report.');
      return;
    }
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'wordpath-optimization-report.txt';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Report exported as a text file.');
  }

  function showToast(message) {
    window.clearTimeout(state.toastTimeout);
    el.toast.textContent = message;
    el.toast.classList.add('show');
    state.toastTimeout = window.setTimeout(() => el.toast.classList.remove('show'), 2700);
  }

  el.wordInput.addEventListener('input', event => updateCurrentBatchText(event.target.value));
  el.prevBatchBtn.addEventListener('click', prevBatch);
  el.nextBatchBtn.addEventListener('click', nextBatch);
  el.optimizeBtn.addEventListener('click', startOptimizedGeneration);
  el.clearBtn.addEventListener('click', clearCurrentBatch);
  el.loadSampleBtn.addEventListener('click', loadSample);
  el.emptyLoadSampleBtn.addEventListener('click', loadSample);
  el.copyAllBtn.addEventListener('click', copyAllResults);
  el.downloadReportBtn.addEventListener('click', downloadReport);
  el.testGeminiBtn.addEventListener('click', testGeminiConnection);
  el.saveApiKeyBtn.addEventListener('click', saveApiKey);
  el.removeApiKeyBtn.addEventListener('click', removeSavedApiKey);
  el.toggleApiKey.addEventListener('click', () => {
    const reveal = el.geminiApiKey.type === 'password';
    el.geminiApiKey.type = reveal ? 'text' : 'password';
    el.toggleApiKey.textContent = reveal ? 'Hide' : 'Show';
    el.toggleApiKey.setAttribute('aria-label', reveal ? 'Hide API key' : 'Show API key');
    el.toggleApiKey.setAttribute('aria-pressed', String(reveal));
  });
  el.geminiApiKey.addEventListener('input', () => {
    setGeminiStatus('Not tested', 'neutral', el.geminiApiKey.value.trim() ? 'API key changed. Test the connection to verify access.' : 'Enter a current Gemini API key, then test the selected model before generating.');
    updateApiKeyStorageStatus();
  });
  el.geminiModel.addEventListener('change', () => {
    setGeminiStatus('Not tested', 'neutral', `Selected ${GEMINI_MODEL_LABELS[selectedGeminiModel()] || selectedGeminiModel()}. Test the connection to verify availability.`);
  });

  loadSavedApiKey();
  renderInputView();
})();
