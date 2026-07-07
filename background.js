const MYMEMORY_API = "https://api.mymemory.translated.net/get";
const DEFAULT_SETTINGS = {
  provider: "mymemory",
  apiBaseUrl: "https://api.openai.com/v1",
  apiMode: "chat-completions",
  apiKey: "",
  model: "gpt-4o-mini",
  systemPrompt: "You are a precise translation engine. Only return the translated text, without explanations.",
  temperature: 0.2
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "test-provider") {
    testProvider(message.settings)
      .then((result) => sendResponse(result))
      .catch((error) => {
        sendResponse({
          ok: false,
          error: formatFetchError(error)
        });
      });

    return true;
  }

  if (message.action === "translate-batch") {
    translateBatch({
      texts: message.texts,
      targetLang: message.targetLang || "zh-CN",
      sourceLang: message.sourceLang || "en"
    })
      .then((translatedTexts) => {
        sendResponse({
          ok: true,
          translatedTexts
        });
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: formatFetchError(error)
        });
      });

    return true;
  }

  if (message.action !== "translate") {
    return;
  }

  translateText({
    text: message.text,
    targetLang: message.targetLang || "zh-CN",
    sourceLang: message.sourceLang || "en"
  })
    .then((translatedText) => {
      sendResponse({
        ok: true,
        translatedText
      });
    })
    .catch((error) => {
      sendResponse({
        ok: false,
        error: formatFetchError(error)
      });
    });

  return true;
});

async function translateText({ text, sourceLang, targetLang }) {
  const cleanText = String(text || "").trim();

  if (!cleanText) {
    throw new Error("没有可翻译的文字");
  }

  if (cleanText.length > 450) {
    throw new Error("文字太长，请先选中较短的一段");
  }

  const settings = await getSettings();
  const cacheKey = `translate:${settings.provider}:${settings.model}:${sourceLang}:${targetLang}:${cleanText}`;
  const cached = await chrome.storage.local.get(cacheKey);

  if (cached[cacheKey]) {
    return cached[cacheKey];
  }

  const translatedText =
    settings.provider === "openai-compatible"
      ? await translateWithLargeModel({
          text: cleanText,
          sourceLang,
          targetLang,
          settings
        })
      : await translateWithMyMemory({
          text: cleanText,
          sourceLang,
          targetLang
        });

  await chrome.storage.local.set({
    [cacheKey]: translatedText
  });

  return translatedText;
}

async function translateBatch({ texts, sourceLang, targetLang }) {
  const cleanTexts = Array.isArray(texts)
    ? texts.map((text) => String(text || "").trim()).filter(Boolean)
    : [];

  if (!cleanTexts.length) {
    throw new Error("没有可翻译的文字");
  }

  const settings = await getSettings();

  if (settings.provider !== "openai-compatible") {
    const translatedTexts = [];

    for (const text of cleanTexts) {
      translatedTexts.push(
        await translateText({
          text,
          sourceLang,
          targetLang
        })
      );
    }

    return translatedTexts;
  }

  const cacheKey = `translate-batch:${settings.provider}:${settings.model}:${settings.apiMode}:${sourceLang}:${targetLang}:${JSON.stringify(cleanTexts)}`;
  const cached = await chrome.storage.local.get(cacheKey);

  if (cached[cacheKey]) {
    return cached[cacheKey];
  }

  const translatedTexts = await translateBatchWithLargeModel({
    texts: cleanTexts,
    sourceLang,
    targetLang,
    settings
  });

  await chrome.storage.local.set({
    [cacheKey]: translatedTexts
  });

  return translatedTexts;
}

async function getSettings() {
  const data = await chrome.storage.local.get("translatorSettings");
  return {
    ...DEFAULT_SETTINGS,
    ...(data.translatorSettings || {})
  };
}

async function translateWithMyMemory({ text, sourceLang, targetLang }) {
  const url = new URL(MYMEMORY_API);
  const myMemorySourceLang = sourceLang === "auto" ? "en" : sourceLang;

  url.searchParams.set("q", text);
  url.searchParams.set("langpair", `${myMemorySourceLang}|${targetLang}`);

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`接口请求失败：${response.status}`);
  }

  const data = await response.json();

  const translatedText = data?.responseData?.translatedText;

  if (!translatedText) {
    throw new Error("接口没有返回译文");
  }

  return translatedText;
}

async function translateWithLargeModel({ text, sourceLang, targetLang, settings }) {
  if (!settings.apiBaseUrl) {
    throw new Error("请先在设置里填写 API 地址");
  }

  if (!settings.apiKey) {
    throw new Error("请先在设置里填写 API Key");
  }

  if (!settings.model) {
    throw new Error("请先在设置里填写模型名");
  }

  const endpoint = getLargeModelEndpoint(settings);
  const body =
    settings.apiMode === "responses"
      ? buildResponsesPayload({ text, sourceLang, targetLang, settings })
      : buildChatCompletionsPayload({ text, sourceLang, targetLang, settings });

  let response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify(body)
    });
  } catch (error) {
    throw new Error(`无法连接到接口：${endpoint}。请检查网络、域名证书、CORS 或扩展是否已重新加载。原始错误：${error.message}`);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error?.message || `大模型接口请求失败：${response.status}`);
  }

  const translatedText = extractTranslatedText(data, settings.apiMode);

  if (!translatedText) {
    throw new Error("大模型接口没有返回译文");
  }

  return translatedText;
}

async function translateBatchWithLargeModel({ texts, sourceLang, targetLang, settings }) {
  if (!settings.apiBaseUrl) {
    throw new Error("请先在设置里填写 API 地址");
  }

  if (!settings.apiKey) {
    throw new Error("请先在设置里填写 API Key");
  }

  if (!settings.model) {
    throw new Error("请先在设置里填写模型名");
  }

  const endpoint = getLargeModelEndpoint(settings);
  const body =
    settings.apiMode === "responses"
      ? buildBatchResponsesPayload({ texts, sourceLang, targetLang, settings })
      : buildBatchChatCompletionsPayload({ texts, sourceLang, targetLang, settings });

  let response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify(body)
    });
  } catch (error) {
    throw new Error(`无法连接到接口：${endpoint}。请检查网络、域名证书、CORS 或扩展是否已重新加载。原始错误：${error.message}`);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error?.message || `大模型接口请求失败：${response.status}`);
  }

  const rawText = extractTranslatedText(data, settings.apiMode);
  const translatedTexts = parseBatchTranslation(rawText, texts.length);

  if (translatedTexts.length !== texts.length) {
    throw new Error("批量译文数量不匹配");
  }

  return translatedTexts;
}

function getLargeModelEndpoint(settings) {
  const baseUrl = settings.apiBaseUrl.replace(/\/+$/, "");

  if (settings.apiMode === "responses") {
    return `${baseUrl}/responses`;
  }

  return `${baseUrl}/chat/completions`;
}

function buildChatCompletionsPayload({ text, sourceLang, targetLang, settings }) {
  return {
    model: settings.model,
    temperature: Number(settings.temperature) || 0.2,
    messages: [
      {
        role: "system",
        content: settings.systemPrompt || DEFAULT_SETTINGS.systemPrompt
      },
      {
        role: "user",
        content: `Translate the following text from ${sourceLang || "auto"} to ${targetLang}. Return only the translation.\n\n${text}`
      }
    ]
  };
}

function buildResponsesPayload({ text, sourceLang, targetLang, settings }) {
  return {
    model: settings.model,
    temperature: Number(settings.temperature) || 0.2,
    instructions: settings.systemPrompt || DEFAULT_SETTINGS.systemPrompt,
    input: `Translate the following text from ${sourceLang || "auto"} to ${targetLang}. Return only the translation.\n\n${text}`
  };
}

function buildBatchChatCompletionsPayload({ texts, sourceLang, targetLang, settings }) {
  return {
    model: settings.model,
    temperature: Number(settings.temperature) || 0.2,
    messages: [
      {
        role: "system",
        content: "You are a precise batch translation engine. Return only a valid JSON array of translated strings. Do not include markdown, explanations, keys, or extra text."
      },
      {
        role: "user",
        content: `Translate each item from ${sourceLang || "auto"} to ${targetLang}. Keep the same order and return exactly ${texts.length} strings as a JSON array.\n\n${JSON.stringify(texts)}`
      }
    ]
  };
}

function buildBatchResponsesPayload({ texts, sourceLang, targetLang, settings }) {
  return {
    model: settings.model,
    temperature: Number(settings.temperature) || 0.2,
    instructions: "You are a precise batch translation engine. Return only a valid JSON array of translated strings. Do not include markdown, explanations, keys, or extra text.",
    input: `Translate each item from ${sourceLang || "auto"} to ${targetLang}. Keep the same order and return exactly ${texts.length} strings as a JSON array.\n\n${JSON.stringify(texts)}`
  };
}

function parseBatchTranslation(rawText, expectedCount) {
  const cleanText = String(rawText || "")
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  const parsed = JSON.parse(cleanText);

  if (!Array.isArray(parsed)) {
    throw new Error("批量译文不是 JSON 数组");
  }

  return parsed.slice(0, expectedCount).map((item) => String(item || "").trim());
}

function extractTranslatedText(data, apiMode) {
  if (apiMode === "responses") {
    const outputText = data?.output_text?.trim();

    if (outputText) {
      return outputText;
    }

    const messageContent = data?.output
      ?.flatMap((item) => item?.content || [])
      ?.map((content) => content?.text)
      ?.filter(Boolean)
      ?.join("\n")
      ?.trim();

    return messageContent || "";
  }

  return data?.choices?.[0]?.message?.content?.trim() || "";
}

async function testProvider(settings) {
  const translatedText = await translateWithLargeModel({
    text: "Hello",
    sourceLang: "en",
    targetLang: "zh-CN",
    settings: {
      ...DEFAULT_SETTINGS,
      ...settings,
      provider: "openai-compatible"
    }
  });

  return {
    ok: true,
    message: `连接成功：${translatedText}`
  };
}

function formatFetchError(error) {
  return error?.message || "翻译失败";
}
