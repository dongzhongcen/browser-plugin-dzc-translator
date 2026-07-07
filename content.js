chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "translate-selection") {
    translateSelection(message.sourceLang, message.targetLang)
      .then((result) => sendResponse(result))
      .catch((error) => {
        sendResponse({
          ok: false,
          message: error.message || "翻译选中文字失败"
        });
      });

    return true;
  }

  if (message.action === "translate-page") {
    translatePage(message.sourceLang, message.targetLang, message.pageMode)
      .then((result) => sendResponse(result))
      .catch((error) => {
        sendResponse({
          ok: false,
          message: error.message || "翻译当前页面失败"
        });
      });

    return true;
  }
});

async function translateSelection(sourceLang, targetLang) {
  const selectedText = window.getSelection().toString().trim();

  if (!selectedText) {
    return {
      ok: false,
      message: "请先在网页上选中文字"
    };
  }

  const translatedText = await requestTranslate(selectedText, sourceLang, targetLang);

  showFloatingResult({
    originalText: selectedText,
    translatedText
  });

  return {
    ok: true,
    message: translatedText,
    translatedText
  };
}

async function translatePage(sourceLang, targetLang, pageMode = "replace") {
  const textNodes = getVisibleTextNodes(document.body)
    .filter((node) => shouldTranslateText(node.nodeValue))
    .filter((node) => !isAlreadyTranslatedNode(node));
  const translationItems = pageMode === "compare"
    ? buildCompareItems(textNodes)
    : textNodes.map((node) => ({
        node,
        text: node.nodeValue.trim()
      }));

  if (!translationItems.length) {
    return {
      ok: false,
      message: "当前页面没有找到可翻译的文字"
    };
  }

  let successCount = 0;

  const originalTexts = translationItems.map((item) => item.text);

  try {
    const translatedTexts = await requestTranslateBatch(originalTexts, sourceLang, targetLang);

    translationItems.forEach((item, index) => {
      const translatedText = translatedTexts[index];

      if (!translatedText) return;

      if (applyTranslationItem(item, translatedText, pageMode)) {
        successCount += 1;
      }
    });
  } catch (error) {
    console.warn("Batch translate failed, fallback to single node translation:", error);

    for (const item of translationItems) {
      try {
        const translatedText = await requestTranslate(item.text, sourceLang, targetLang);

        if (applyTranslationItem(item, translatedText, pageMode)) {
          successCount += 1;
        }
      } catch (nodeError) {
        console.warn("Translate item failed:", nodeError);
      }
    }
  }

  return {
    ok: true,
    message: pageMode === "compare"
      ? `已生成 ${successCount} 段对照翻译`
      : `已替换 ${successCount} 段文字`
  };
}

function buildCompareItems(textNodes) {
  const groups = new Map();

  for (const node of textNodes) {
    const anchor = findCompareAnchor(node.parentElement);

    if (!anchor || anchor.dataset.swtTranslated === "true") {
      continue;
    }

    const text = node.nodeValue.trim();

    if (!groups.has(anchor)) {
      groups.set(anchor, {
        anchor,
        node,
        parts: []
      });
    }

    groups.get(anchor).parts.push(text);
  }

  return Array.from(groups.values())
    .map((item) => ({
      ...item,
      text: normalizeCompareText(item.parts.join("\n"))
    }))
    .filter((item) => shouldTranslateText(item.text, 2400));
}

function normalizeCompareText(text) {
  return String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function applyTranslationItem(item, translatedText, pageMode) {
  if (pageMode === "compare") {
    return insertCompareTranslation(item, translatedText);
  }

  item.node.nodeValue = item.node.nodeValue.replace(item.text, translatedText);
  return true;
}

function applyTranslation(node, originalText, translatedText, pageMode) {
  if (pageMode === "compare") {
    return insertCompareTranslation({
      node,
      anchor: findCompareAnchor(node.parentElement),
      text: originalText
    }, translatedText);
  }

  node.nodeValue = node.nodeValue.replace(originalText, translatedText);
  return true;
}

function insertCompareTranslation(item, translatedText) {
  const parent = item.node?.parentElement;
  const anchor = item.anchor || findCompareAnchor(parent);

  if (!parent || !anchor || anchor.dataset.swtTranslated === "true") {
    return false;
  }

  const parentStyle = window.getComputedStyle(parent);
  const anchorStyle = window.getComputedStyle(anchor);
  const translation = document.createElement(isTableRowElement(anchor) ? "tr" : "div");
  const textHolder = isTableRowElement(anchor) ? document.createElement("td") : translation;

  if (isTableRowElement(anchor)) {
    textHolder.colSpan = Math.max(anchor.children.length, 1);
    translation.appendChild(textHolder);
  }

  translation.className = "simple-web-translator-compare";
  translation.dataset.swtTranslation = "true";
  textHolder.className = "simple-web-translator-compare-text";
  textHolder.textContent = translatedText;

  applyCompareTheme(textHolder, parentStyle, anchorStyle);

  ensureCompareStyle();

  anchor.insertAdjacentElement("afterend", translation);

  anchor.dataset.swtTranslated = "true";
  return true;
}

function ensureCompareStyle() {
  if (document.getElementById("simple-web-translator-compare-style")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "simple-web-translator-compare-style";
  style.textContent = `
    .simple-web-translator-compare {
      display: block !important;
      position: static !important;
      clear: both !important;
      width: auto !important;
      max-width: 100% !important;
      min-height: 0 !important;
      height: auto !important;
      margin: 6px 0 8px !important;
      padding: 0 !important;
      transform: none !important;
      z-index: auto !important;
      pointer-events: none !important;
      contain: layout style !important;
    }

    tr.simple-web-translator-compare {
      display: table-row !important;
    }

    .simple-web-translator-compare-text {
      display: block !important;
      box-sizing: border-box !important;
      max-width: 100% !important;
      overflow-wrap: anywhere !important;
      word-break: break-word !important;
      white-space: normal !important;
      margin: 0 !important;
      padding: 6px 9px !important;
      border-left: 3px solid currentColor !important;
      border-radius: 6px !important;
      font-size: 0.92em !important;
      line-height: 1.55 !important;
      opacity: 0.92 !important;
    }
  `;

  document.documentElement.appendChild(style);
}

function findCompareAnchor(element) {
  let current = element;

  while (current && current !== document.body && current !== document.documentElement) {
    const style = window.getComputedStyle(current);

    if (isTableRowElement(current)) {
      return current;
    }

    if (isLayoutSensitiveElement(current, style)) {
      current = current.parentElement;
      continue;
    }

    if (style.display !== "inline") {
      return current;
    }

    current = current.parentElement;
  }

  return element;
}

function isLayoutSensitiveElement(element, style) {
  return (
    style.position === "absolute" ||
    style.position === "fixed" ||
    style.display === "inline" ||
    style.display === "contents" ||
    element.tagName === "A" ||
    element.tagName === "BUTTON" ||
    element.tagName === "LABEL"
  );
}

function isTableRowElement(element) {
  return element?.tagName === "TR";
}

function applyCompareTheme(element, parentStyle, anchorStyle) {
  const sourceColor = parentStyle.color || anchorStyle.color || "rgb(21, 21, 21)";
  const sourceBackground = firstUsableBackground(parentStyle, anchorStyle);
  const accentColor = readableAccentColor(sourceColor, sourceBackground);
  const backgroundColor = translucentBackground(accentColor, sourceBackground);

  element.style.color = accentColor;
  element.style.background = backgroundColor;
  element.style.fontFamily = parentStyle.fontFamily;
  element.style.fontWeight = lighterFontWeight(parentStyle.fontWeight);
}

function firstUsableBackground(...styles) {
  for (const style of styles) {
    if (style.backgroundColor && style.backgroundColor !== "rgba(0, 0, 0, 0)" && style.backgroundColor !== "transparent") {
      return style.backgroundColor;
    }
  }

  return window.getComputedStyle(document.body).backgroundColor || "rgb(255, 255, 255)";
}

function readableAccentColor(color, background) {
  const text = parseRgb(color);
  const bg = parseRgb(background);

  if (!text || !bg) {
    return "#7a3f33";
  }

  const mixed = mixRgb(text, bg, luminance(bg) > 0.55 ? 0.78 : 0.66);
  const adjusted = luminance(bg) > 0.55
    ? darkenRgb(mixed, 0.2)
    : lightenRgb(mixed, 0.28);

  return rgbToCss(adjusted);
}

function translucentBackground(color, background) {
  const accent = parseRgb(color);
  const bg = parseRgb(background);

  if (!accent || !bg) {
    return "rgba(232, 93, 63, 0.08)";
  }

  const alpha = luminance(bg) > 0.55 ? 0.08 : 0.16;
  return `rgba(${accent.r}, ${accent.g}, ${accent.b}, ${alpha})`;
}

function parseRgb(value) {
  const match = String(value || "").match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);

  if (!match) {
    return null;
  }

  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3])
  };
}

function mixRgb(foreground, background, amount) {
  return {
    r: Math.round(foreground.r * amount + background.r * (1 - amount)),
    g: Math.round(foreground.g * amount + background.g * (1 - amount)),
    b: Math.round(foreground.b * amount + background.b * (1 - amount))
  };
}

function lightenRgb(color, amount) {
  return {
    r: Math.round(color.r + (255 - color.r) * amount),
    g: Math.round(color.g + (255 - color.g) * amount),
    b: Math.round(color.b + (255 - color.b) * amount)
  };
}

function darkenRgb(color, amount) {
  return {
    r: Math.round(color.r * (1 - amount)),
    g: Math.round(color.g * (1 - amount)),
    b: Math.round(color.b * (1 - amount))
  };
}

function luminance(color) {
  const values = [color.r, color.g, color.b].map((value) => {
    const channel = value / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}

function rgbToCss(color) {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

function lighterFontWeight(fontWeight) {
  const weight = Number(fontWeight);

  if (!Number.isFinite(weight)) {
    return fontWeight;
  }

  return String(Math.max(400, Math.min(weight, 600)));
}

function requestTranslateBatch(texts, sourceLang, targetLang) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        action: "translate-batch",
        texts,
        sourceLang,
        targetLang
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!response?.ok) {
          reject(new Error(response?.error || "批量翻译失败"));
          return;
        }

        resolve(response.translatedTexts || []);
      }
    );
  });
}

function requestTranslate(text, sourceLang, targetLang) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        action: "translate",
        text,
        sourceLang,
        targetLang
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!response?.ok) {
          reject(new Error(response?.error || "翻译失败"));
          return;
        }

        resolve(response.translatedText);
      }
    );
  });
}

function getVisibleTextNodes(root) {
  const nodes = [];

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const text = node.nodeValue.trim();
        const parent = node.parentElement;

        if (!text || !parent) {
          return NodeFilter.FILTER_REJECT;
        }

        if (isIgnoredElement(parent)) {
          return NodeFilter.FILTER_REJECT;
        }

        if (!isTextNodeVisible(node)) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  let node;

  while ((node = walker.nextNode())) {
    nodes.push(node);
  }

  return nodes;
}

function isIgnoredElement(element) {
  const ignoredTags = [
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "TEXTAREA",
    "INPUT",
    "SELECT",
    "OPTION",
    "CODE",
    "PRE"
  ];

  return ignoredTags.includes(element.tagName) || Boolean(element.closest(".simple-web-translator-compare"));
}

function isTextNodeVisible(node) {
  const parent = node.parentElement;

  if (!parent) {
    return false;
  }

  const range = document.createRange();
  range.selectNodeContents(node);
  const rect = range.getBoundingClientRect();
  range.detach();

  if (rect.width > 0 && rect.height > 0) {
    return isElementStyleVisible(parent);
  }

  return Boolean(findVisibleAncestor(parent));
}

function findVisibleAncestor(element) {
  let current = element;
  let depth = 0;

  while (current && current !== document.documentElement && depth < 4) {
    if (isElementVisible(current)) {
      return current;
    }

    current = current.parentElement;
    depth += 1;
  }

  return null;
}

function isElementStyleVisible(element) {
  const style = window.getComputedStyle(element);

  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    Number(style.opacity) !== 0
  );
}

function isElementVisible(element) {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();

  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    Number(style.opacity) !== 0 &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function shouldTranslateText(text, maxLength = 1200) {
  const cleanText = String(text || "").trim();

  if (cleanText.length < 2) return false;
  if (cleanText.length > maxLength) return false;

  if (/^[\d\s.,:;!?()[\]{}'"“”‘’\-_/\\|]+$/.test(cleanText)) {
    return false;
  }

  return true;
}

function isAlreadyTranslatedNode(node) {
  return Boolean(
    node.parentElement?.dataset.swtTranslated === "true" ||
    node.parentElement?.closest(".simple-web-translator-compare")
  );
}

function showFloatingResult({ originalText, translatedText }) {
  let panel = document.getElementById("simple-web-translator-panel");

  if (!panel) {
    panel = document.createElement("div");
    panel.id = "simple-web-translator-panel";

    panel.innerHTML = `
      <div class="swt-header">
        <span>dzc's translator</span>
        <button class="swt-close" type="button">×</button>
      </div>
      <div class="swt-body">
        <div class="swt-label">原文</div>
        <div class="swt-original"></div>
        <div class="swt-label">译文</div>
        <div class="swt-translated"></div>
      </div>
    `;

    const style = document.createElement("style");
    style.textContent = `
      #simple-web-translator-panel {
        position: fixed;
        right: 20px;
        bottom: 20px;
        z-index: 2147483647;
        width: 360px;
        max-width: calc(100vw - 40px);
        color: #151515;
        background: rgba(255, 255, 255, 0.94);
        border: 1px solid rgba(21, 21, 21, 0.12);
        border-radius: 16px;
        box-shadow: 0 18px 48px rgba(0, 0, 0, 0.24);
        overflow: hidden;
        font-family: Arial, sans-serif;
      }

      #simple-web-translator-panel .swt-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 12px;
        color: #fff;
        background: #151515;
        font-size: 13px;
        font-weight: 700;
      }

      #simple-web-translator-panel .swt-close {
        width: 24px;
        height: 24px;
        border: 0;
        border-radius: 50%;
        color: #fff;
        background: rgba(255, 255, 255, 0.18);
        cursor: pointer;
        font-size: 18px;
        line-height: 20px;
      }

      #simple-web-translator-panel .swt-body {
        padding: 12px;
      }

      #simple-web-translator-panel .swt-label {
        margin: 8px 0 4px;
        color: #6f6a61;
        font-size: 12px;
        font-weight: 700;
      }

      #simple-web-translator-panel .swt-original,
      #simple-web-translator-panel .swt-translated {
        max-height: 120px;
        overflow: auto;
        padding: 10px;
        border-radius: 10px;
        background: #f4f1ea;
        font-size: 13px;
        line-height: 1.5;
        white-space: pre-wrap;
      }
    `;

    document.documentElement.appendChild(style);
    document.body.appendChild(panel);

    panel.querySelector(".swt-close").addEventListener("click", () => {
      panel.remove();
    });
  }

  panel.querySelector(".swt-original").textContent = originalText;
  panel.querySelector(".swt-translated").textContent = translatedText;
}
