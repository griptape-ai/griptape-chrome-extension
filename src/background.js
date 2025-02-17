chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getPageContent") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (chrome.runtime.lastError || !tabs || !tabs.length) {
                sendResponse({ content: null, error: "No active tab found" });
                return;
            }
            chrome.scripting.executeScript(
                {
                    target: { tabId: tabs[0].id },
                    files: ['src/content.js']
                },
                () => {
                    chrome.tabs.sendMessage(tabs[0].id, { action: "fetchContent" }, (response) => {
                        if (chrome.runtime.lastError || !response) {
                            sendResponse({ content: null, error: "Failed to fetch content" });
                            return;
                        }
                        sendResponse({ content: response.content });
                    });
                }
            );
        });
        return true; // Indicates that the response will be sent asynchronously
    } else if (request.action === "openSidePanel") {
        chrome.sidePanel.setOptions({
            path: 'src/sidepanel.html',
            enabled: true
        }, () => {
            if (chrome.runtime.lastError) {
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
                sendResponse({ success: true });
            }
        });
        return true; // Indicates that the response will be sent asynchronously
    }
});