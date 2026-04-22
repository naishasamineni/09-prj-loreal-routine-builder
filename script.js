const WORKER_URL = "https://bold-fog-4096.naisha-loreal.workers.dev/";

const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutineBtn = document.getElementById("generateRoutine");
const clearSelectionsBtn = document.getElementById("clearSelections");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const newChatBtn = document.getElementById("newChatBtn");
const resultsCount = document.getElementById("resultsCount");
const webSearchToggle = document.getElementById("webSearchToggle");
const rtlToggle = document.getElementById("rtlToggle");

const STORAGE_KEYS = {
  selectedProducts: "loreal_selected_products_v1",
  webSearch: "loreal_web_search_v1",
  rtl: "loreal_rtl_mode_v1",
};

let allProducts = [];
let selectedProducts = [];
let chatHistory = [];
let routineGenerated = false;
let isLoading = false;

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatCategory(category = "") {
  return category
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function saveSelections() {
  localStorage.setItem(
    STORAGE_KEYS.selectedProducts,
    JSON.stringify(selectedProducts),
  );
}

function loadSelections() {
  const saved = localStorage.getItem(STORAGE_KEYS.selectedProducts);
  if (!saved) return;

  try {
    selectedProducts = JSON.parse(saved);
  } catch (error) {
    selectedProducts = [];
  }
}

function savePreferences() {
  localStorage.setItem(
    STORAGE_KEYS.webSearch,
    JSON.stringify(webSearchToggle.checked),
  );
  localStorage.setItem(STORAGE_KEYS.rtl, JSON.stringify(rtlToggle.checked));
}

function loadPreferences() {
  const savedWebSearch = localStorage.getItem(STORAGE_KEYS.webSearch);
  const savedRtl = localStorage.getItem(STORAGE_KEYS.rtl);

  if (savedWebSearch !== null) {
    webSearchToggle.checked = JSON.parse(savedWebSearch);
  }

  if (savedRtl !== null) {
    rtlToggle.checked = JSON.parse(savedRtl);
  }

  applyDirection();
}

function applyDirection() {
  const isRtl = rtlToggle.checked;
  document.body.classList.toggle("rtl", isRtl);
  document.documentElement.setAttribute("dir", isRtl ? "rtl" : "ltr");
  document.documentElement.setAttribute("lang", "en");
}

async function loadProducts() {
  const response = await fetch("products.json");

  if (!response.ok) {
    throw new Error("Could not load products.json");
  }

  const data = await response.json();
  return data.products || [];
}

function isSelected(productId) {
  return selectedProducts.some((product) => product.id === productId);
}

function toggleProductSelection(productId) {
  const product = allProducts.find((item) => item.id === productId);
  if (!product) return;

  if (isSelected(productId)) {
    selectedProducts = selectedProducts.filter((item) => item.id !== productId);
  } else {
    selectedProducts.push(product);
  }

  saveSelections();
  renderSelectedProducts();
  renderProducts();
}

function removeSelectedProduct(productId) {
  selectedProducts = selectedProducts.filter((item) => item.id !== productId);
  saveSelections();
  renderSelectedProducts();
  renderProducts();
}

function clearAllSelections() {
  selectedProducts = [];
  saveSelections();
  renderSelectedProducts();
  renderProducts();
  addSystemMessage("All selected products were cleared.");
}

function getFilteredProducts() {
  const selectedCategory = categoryFilter.value.trim().toLowerCase();
  const keyword = productSearch.value.trim().toLowerCase();

  return allProducts.filter((product) => {
    const matchesCategory = selectedCategory
      ? product.category.toLowerCase() === selectedCategory
      : true;

    const searchableText = [
      product.name,
      product.brand,
      product.category,
      product.description,
    ]
      .join(" ")
      .toLowerCase();

    const matchesKeyword = keyword ? searchableText.includes(keyword) : true;

    return matchesCategory && matchesKeyword;
  });
}

function createProductCard(product) {
  const selectedClass = isSelected(product.id) ? "selected" : "";
  const isPicked = isSelected(product.id);

  return `
    <article class="product-card ${selectedClass}" data-id="${product.id}">
      <div class="product-image-wrap">
        <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" />
      </div>

      <div class="product-body">
        <p class="product-brand">${escapeHtml(product.brand)}</p>
        <h3>${escapeHtml(product.name)}</h3>
        <p class="product-category">${escapeHtml(formatCategory(product.category))}</p>

        <div class="product-actions">
          <button
            class="card-btn primary select-btn"
            type="button"
            data-id="${product.id}"
          >
            ${isPicked ? "Unselect" : "Select Product"}
          </button>

          <button
            class="card-btn secondary description-btn"
            type="button"
            data-id="${product.id}"
          >
            View Description
          </button>
        </div>

        <div class="product-description" id="description-${product.id}" hidden>
          ${escapeHtml(product.description)}
        </div>
      </div>
    </article>
  `;
}

function renderProducts() {
  const filteredProducts = getFilteredProducts();

  if (!filteredProducts.length) {
    productsContainer.innerHTML = `
      <div class="empty-state">
        No products match your current filters. Try another category or search term.
      </div>
    `;
    resultsCount.textContent = "0 products shown";
    return;
  }

  productsContainer.innerHTML = filteredProducts
    .map((product) => createProductCard(product))
    .join("");

  resultsCount.textContent = `${filteredProducts.length} product${
    filteredProducts.length === 1 ? "" : "s"
  } shown`;
}

function renderSelectedProducts() {
  if (!selectedProducts.length) {
    selectedProductsList.innerHTML = `
      <div class="empty-state">
        No products selected yet. Click a product card's select button to add it here.
      </div>
    `;
    return;
  }

  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
      <div class="selected-chip">
        <div class="selected-chip-content">
          <strong>${escapeHtml(product.name)}</strong>
          <span>${escapeHtml(product.brand)} • ${escapeHtml(
            formatCategory(product.category),
          )}</span>
        </div>
        <button
          class="remove-chip-btn"
          type="button"
          title="Remove ${escapeHtml(product.name)}"
          aria-label="Remove ${escapeHtml(product.name)}"
          data-id="${product.id}"
        >
          ×
        </button>
      </div>
    `,
    )
    .join("");
}

function renderInitialChatState() {
  chatWindow.innerHTML = "";
  addSystemMessage(
    "Select products, then click “Generate Routine.” After that, you can ask follow-up questions about your routine, skincare, haircare, makeup, fragrance, and related beauty topics.",
  );
}

function scrollChatToBottom() {
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function createSourcesHtml(sources = []) {
  if (!sources.length) return "";

  const uniqueSources = [];
  const seen = new Set();

  for (const source of sources) {
    const key = `${source.url}__${source.title}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueSources.push(source);
    }
  }

  return `
    <div class="sources-box">
      <div class="sources-title">Sources</div>
      <div class="sources-list">
        ${uniqueSources
          .map(
            (source) => `
              <a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">
                ${escapeHtml(source.title || source.url)}
              </a>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function addMessage(role, text, sources = []) {
  const message = document.createElement("div");
  message.className = `chat-message ${role}`;
  message.innerHTML = `
    <div>${escapeHtml(text)}</div>
    ${createSourcesHtml(sources)}
  `;
  chatWindow.appendChild(message);
  scrollChatToBottom();
}

function addSystemMessage(text) {
  addMessage("system", text);
}

function setLoadingState(loading) {
  isLoading = loading;
  generateRoutineBtn.disabled = loading;
  sendBtn.disabled = loading;
  newChatBtn.disabled = loading;
  clearSelectionsBtn.disabled = loading;

  generateRoutineBtn.innerHTML = loading
    ? `<i class="fa-solid fa-spinner fa-spin"></i> Thinking...`
    : `<i class="fa-solid fa-wand-magic-sparkles"></i> Generate Routine`;
}

function extractConversationForWorker() {
  return chatHistory.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

async function callWorker(payload) {
  if (!WORKER_URL || WORKER_URL === "PASTE_YOUR_CLOUDFLARE_WORKER_URL_HERE") {
    throw new Error("Please paste your Cloudflare Worker URL into script.js");
  }

  const response = await fetch(WORKER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();
  console.log("RAW WORKER RESPONSE:", rawText);

  let data;
  try {
    data = JSON.parse(rawText);
  } catch (error) {
    throw new Error("Worker did not return valid JSON.");
  }

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  if (!data.answer) {
    throw new Error("Worker returned no answer.");
  }

  return data;
}

async function generateRoutine() {
  if (!selectedProducts.length) {
    addSystemMessage(
      "Please select at least one product before generating a routine.",
    );
    return;
  }

  try {
    setLoadingState(true);

    addMessage("user", "Please create a routine using my selected products.");

    const payload = {
      mode: "routine",
      selectedProducts,
      chatHistory: extractConversationForWorker(),
      enableWebSearch: webSearchToggle.checked,
    };

    const data = await callWorker(payload);

    console.log("FINAL DATA:", data);

    routineGenerated = true;

    chatHistory.push({
      role: "user",
      content: "Please create a routine using my selected products.",
    });

    chatHistory.push({
      role: "assistant",
      content: data.answer,
    });

    addMessage("assistant", data.answer, data.sources || []);
    scrollChatToBottom();
  } catch (error) {
    addSystemMessage(`Error: ${error.message}`);
    console.error(error);
  } finally {
    setLoadingState(false);
  }
}

async function sendFollowUp(messageText) {
  if (!routineGenerated) {
    addSystemMessage(
      "Generate a routine first, then ask follow-up questions about it.",
    );
    return;
  }

  try {
    setLoadingState(true);

    addMessage("user", messageText);

    chatHistory.push({
      role: "user",
      content: messageText,
    });

    const payload = {
      mode: "followup",
      selectedProducts,
      chatHistory: extractConversationForWorker(),
      enableWebSearch: webSearchToggle.checked,
    };

    const data = await callWorker(payload);

    console.log("FOLLOW UP DATA:", data);

    chatHistory.push({
      role: "assistant",
      content: data.answer,
    });

    addMessage("assistant", data.answer, data.sources || []);
    scrollChatToBottom();
  } catch (error) {
    addSystemMessage(`Error: ${error.message}`);
    console.error(error);
  } finally {
    setLoadingState(false);
  }
}

function resetChat() {
  chatHistory = [];
  routineGenerated = false;
  renderInitialChatState();
}

productsContainer.addEventListener("click", (event) => {
  const selectBtn = event.target.closest(".select-btn");
  const descriptionBtn = event.target.closest(".description-btn");

  if (selectBtn) {
    const productId = Number(selectBtn.dataset.id);
    toggleProductSelection(productId);
    return;
  }

  if (descriptionBtn) {
    const productId = Number(descriptionBtn.dataset.id);
    const descriptionEl = document.getElementById(`description-${productId}`);
    if (!descriptionEl) return;

    const isHidden = descriptionEl.hasAttribute("hidden");

    if (isHidden) {
      descriptionEl.removeAttribute("hidden");
      descriptionBtn.textContent = "Hide Description";
    } else {
      descriptionEl.setAttribute("hidden", "");
      descriptionBtn.textContent = "View Description";
    }
  }
});

selectedProductsList.addEventListener("click", (event) => {
  const removeBtn = event.target.closest(".remove-chip-btn");
  if (!removeBtn) return;

  const productId = Number(removeBtn.dataset.id);
  removeSelectedProduct(productId);
});

categoryFilter.addEventListener("change", renderProducts);
productSearch.addEventListener("input", renderProducts);

webSearchToggle.addEventListener("change", () => {
  savePreferences();
  addSystemMessage(
    webSearchToggle.checked
      ? "Web search is on. The AI can include current information and sources."
      : "Web search is off. The AI will answer without live web lookup.",
  );
});

rtlToggle.addEventListener("change", () => {
  applyDirection();
  savePreferences();
});

generateRoutineBtn.addEventListener("click", generateRoutine);
clearSelectionsBtn.addEventListener("click", clearAllSelections);

newChatBtn.addEventListener("click", () => {
  resetChat();
  addSystemMessage(
    "Started a fresh chat. Your selected products are still saved.",
  );
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const messageText = userInput.value.trim();
  if (!messageText || isLoading) return;

  userInput.value = "";
  await sendFollowUp(messageText);
});

async function init() {
  try {
    loadSelections();
    loadPreferences();

    allProducts = await loadProducts();

    renderProducts();
    renderSelectedProducts();
    renderInitialChatState();

    if (selectedProducts.length) {
      addSystemMessage(
        "Your previously selected products were restored from localStorage.",
      );
    }
  } catch (error) {
    productsContainer.innerHTML = `
      <div class="empty-state">
        Could not load products. Please make sure products.json is in the project folder.
      </div>
    `;
    renderInitialChatState();
    addSystemMessage(`Error: ${error.message}`);
    console.error(error);
  }
}

init();
