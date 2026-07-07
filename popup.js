const sourceLang = document.getElementById("sourceLang");
const targetLang = document.getElementById("targetLang");
const result = document.getElementById("result");
const statusText = document.getElementById("status");

const translateSelectionButton = document.getElementById("translateSelection");
const translatePageButton = document.getElementById("translatePage");
const copyResultButton = document.getElementById("copyResult");
const openOptionsButton = document.getElementById("openOptions");
const apiInfo = document.getElementById("apiInfo");

loadProviderInfo();

translateSelectionButton.addEventListener("click", () => {
  sendCommandToCurrentTab("translate-selection");
});

translatePageButton.addEventListener("click", () => {
  sendCommandToCurrentTab("translate-page");
});

copyResultButton.addEventListener("click", async () => {
  const text = result.textContent.trim();

  if (!text || text === "译文会显示在这里。") {
    setStatus("No text");
    return;
  }

  await navigator.clipboard.writeText(text);
  setStatus("Copied");
});

openOptionsButton.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

async function sendCommandToCurrentTab(action) {
  setLoading(true);
  setStatus("Working");
  result.textContent = "正在处理...";

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

    if (!tab?.id) {
      throw new Error("没有找到当前标签页");
    }

    chrome.tabs.sendMessage(
      tab.id,
      {
        action,
        sourceLang: sourceLang.value,
        targetLang: targetLang.value,
        pageMode: getPageMode()
      },
      (response) => {
        setLoading(false);

        if (chrome.runtime.lastError) {
          result.textContent = "无法访问当前页面，请刷新页面后重试。";
          setStatus("Error");
          return;
        }

        if (!response?.ok) {
          result.textContent = response?.message || "操作失败";
          setStatus("Error");
          return;
        }

        result.textContent = response.message || response.translatedText || "完成";
        setStatus("Done");
      }
    );
  } catch (error) {
    setLoading(false);
    result.textContent = error.message || "发生未知错误";
    setStatus("Error");
  }
}

function setLoading(isLoading) {
  document.body.classList.toggle("is-loading", isLoading);

  translateSelectionButton.disabled = isLoading;
  translatePageButton.disabled = isLoading;
  copyResultButton.disabled = isLoading;
}

function setStatus(text) {
  statusText.textContent = text;
}

function getPageMode() {
  return document.querySelector("input[name='pageMode']:checked")?.value || "replace";
}

async function loadProviderInfo() {
  const data = await chrome.storage.local.get("translatorSettings");
  const settings = data.translatorSettings || {};

  if (settings.provider === "openai-compatible") {
    apiInfo.textContent = settings.model
      ? `大模型：${settings.model}`
      : "大模型接口";
    return;
  }

  apiInfo.textContent = "MyMemory API";
}
