function getPageContent() {
    const bodyContent = document.body.innerText || "";
    return bodyContent; // You can implement a markdown conversion here if needed
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "fetchContent") {
        const content = getPageContent();
        sendResponse({ content: content });
    }
});