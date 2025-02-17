# Griptape Chrome Extension

This project is a Chrome extension that provides a panel for interacting with the Griptape Cloud API. The panel allows users to input their API key, the ID for a Griptape Cloud Structure, select options, and submit requests to a Griptape Structure that include the content of the selected browser tab in the request payload.

## Project Structure

- **src/**
  - **background.js**: Background script managing events and communication between content scripts and the panel.
  - **content.js**: Content script that reads the current web page's content and sends it to the panel.
  - **panel.js**: Logic for the panel, handling user interactions and API requests.
  - **panel.html**: HTML structure for the panel, including the logo, input fields, and buttons.
  - **panel.css**: Styles for the panel, ensuring a black background with white text and a scrollable content area.
  - **sidepanel.html**: HTML structure for the side panel, including the logo, input fields, and buttons.
  - **sidepanel.css**: Styles for the sidepanel, ensuring a black background with white text and a scrollable content area.
  
- **images/**
  - **logo.png**: Logo image for Griptape branding used in the panel.
  - **icon16.png**: Icons in various sizes used in the Chrome extension UI.
  - **icon48.png**
  - **icon128.png**

- **manifest.json**: Configuration file for the Chrome extension, defining metadata, permissions, and scripts.

## Setup Instructions

1. Clone the repository to your local machine.
1. Open Chrome and navigate to `chrome://extensions/`.
1. Enable "Developer mode" in the top right corner.
1. Click on "Load unpacked" and select the directory containing the extension files.
1. The extension should now be loaded and visible in your extensions list.
1. Deploy the Griptape Cloud Structure using the guided walkthrough linked in the next section ⬇

## Griptape Cloud Setup

The browser extension requries a Griptape Cloud API key together with a Structure ID for a deployed Structure that will respond to requests from the extension. There is a lot of flexiblity in the precise configuration of the Structure, allowing for experimentation with different models, different prompts and different Tools. 

A sample Structure is included in [griptape-cloud-structure/structure.py](griptape-cloud-structure/structure.py), together with a guided walkthrough showing you how to deploy that Structure to Griptape Cloud in [griptape-cloud-structure/README.md](griptape-cloud-structure/README.md) 

In this sample I use an Agent Structure that is initialized as follows:

```python
with GriptapeCloudStructure():
    cloud_conversation_driver = GriptapeCloudConversationMemoryDriver(
        api_key=os.environ["GT_CLOUD_API_KEY"],
        alias="griptape_browser_extension_thread",
    )
    structure = Agent(
        prompt_driver=OpenAiChatPromptDriver(model="gpt-4o-mini", stream=True),
        tools=[CalculatorTool(off_prompt=False), PromptSummaryTool(off_prompt=True)],
        conversation_memory=ConversationMemory(
            conversation_memory_driver=cloud_conversation_driver
        ),
    )
    structure.run(input)
```

Note that conversation memory is required for the Quiz Me prompt to function and correctly generate a different set of questions each time the Quiz Me button is clicked. For the *Reset Quiz* feature to work, the alias for the conversion memory must be set to `griptape_browser_extension_thread`. 

## Usage Guidelines

1. Click on the extension icon to open the panel. If you want to open the side-panel, which is recommended, right click on the extension icon and select 'Open side panel' from the dropdown menu
1. Enter your Griptape Cloud API key in the provided field.
1. Enter the Structure ID for the Griptape Cloud Structure that you wish to invoke  
1. Select an option from the dropdown menu ("Ask a Question" or "Quiz Me" for example).
1. Click the submit button to send the content and the prompt to Griptape Cloud.
1. Results will be displayed in the scrollable area at the bottom of the panel.
1. When the Quiz Me option is selected, clicking the *Reset Questions* button will reset conversation memory, allowing you to generate the same or similar questions again.

## License

This project is licensed under the Apache 2.0 License. See the LICENSE file for more details.
