const DEFAULT_SETTINGS = {
  provider: "mymemory",
  apiBaseUrl: "https://api.openai.com/v1",
  apiMode: "chat-completions",
  apiKey: "",
  model: "gpt-4o-mini",
  systemPrompt: "You are a precise translation engine. Only return the translated text, without explanations.",
  temperature: 0.2
};

const fields = {
  provider: document.getElementById("provider"),
  apiBaseUrl: document.getElementById("apiBaseUrl"),
  apiMode: document.getElementById("apiMode"),
  apiKey: document.getElementById("apiKey"),
  model: document.getElementById("model"),
  systemPrompt: document.getElementById("systemPrompt"),
  temperature: document.getElementById("temperature")
};

const statusText = document.getElementById("status");
const saveButton = document.getElementById("saveSettings");
const testButton = document.getElementById("testSettings");
const resetButton = document.getElementById("resetSettings");
const modelFields = Array.from(document.querySelectorAll(".model-field"));

init();

fields.provider.addEventListener("change", updateProviderVisibility);
saveButton.addEventListener("click", saveSettings);
testButton.addEventListener("click", testSettings);
resetButton.addEventListener("click", resetSettings);

async function init() {
  const data = await chrome.storage.local.get("translatorSettings");
  renderSettings({
    ...DEFAULT_SETTINGS,
    ...(data.translatorSettings || {})
  });
}

function renderSettings(settings) {
  fields.provider.value = settings.provider;
  fields.apiBaseUrl.value = settings.apiBaseUrl;
  fields.apiMode.value = settings.apiMode || DEFAULT_SETTINGS.apiMode;
  fields.apiKey.value = settings.apiKey;
  fields.model.value = settings.model;
  fields.systemPrompt.value = settings.systemPrompt;
  fields.temperature.value = settings.temperature;
  updateProviderVisibility();
}

async function saveSettings() {
  const settings = getCurrentSettings();

  if (!validateSettings(settings)) {
    return;
  }

  await chrome.storage.local.set({
    translatorSettings: settings
  });

  setStatus("已保存");
}

async function testSettings() {
  const settings = getCurrentSettings();

  if (settings.provider !== "openai-compatible") {
    setStatus("MyMemory 不需要测试大模型连接。");
    return;
  }

  if (!validateSettings(settings)) {
    return;
  }

  testButton.disabled = true;
  setStatus("正在测试...");

  chrome.runtime.sendMessage(
    {
      action: "test-provider",
      settings
    },
    (response) => {
      testButton.disabled = false;

      if (chrome.runtime.lastError) {
        setStatus(chrome.runtime.lastError.message, true);
        return;
      }

      if (!response?.ok) {
        setStatus(response?.error || "测试失败", true);
        return;
      }

      setStatus(response.message || "连接成功");
    }
  );
}

function getCurrentSettings() {
  return {
    provider: fields.provider.value,
    apiBaseUrl: fields.apiBaseUrl.value.trim(),
    apiMode: fields.apiMode.value,
    apiKey: fields.apiKey.value.trim(),
    model: fields.model.value.trim(),
    systemPrompt: fields.systemPrompt.value.trim() || DEFAULT_SETTINGS.systemPrompt,
    temperature: Number(fields.temperature.value) || DEFAULT_SETTINGS.temperature
  };
}

function validateSettings(settings) {
  if (settings.provider === "openai-compatible") {
    if (!settings.apiBaseUrl || !settings.apiKey || !settings.model) {
      setStatus("请填写 API 地址、API Key 和模型名。", true);
      return false;
    }
  }

  return true;
}

async function resetSettings() {
  await chrome.storage.local.set({
    translatorSettings: DEFAULT_SETTINGS
  });

  renderSettings(DEFAULT_SETTINGS);
  setStatus("已恢复默认");
}

function updateProviderVisibility() {
  const usesModel = fields.provider.value === "openai-compatible";

  modelFields.forEach((field) => {
    field.hidden = !usesModel;
  });
}

function setStatus(text, isError = false) {
  statusText.textContent = text;
  statusText.classList.toggle("error", isError);
}
