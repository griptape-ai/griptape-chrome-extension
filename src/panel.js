document.addEventListener('DOMContentLoaded', () => { // set up all our listeners
    const apiKeyInput = document.getElementById('api-key');
    const structureIdInput = document.getElementById('structure-id');
    const dropdown = document.getElementById('dropdown');
    const questionTextInput = document.getElementById('question-text');
    const clearMemory = document.getElementById('clear-memory');
    const submitButton = document.getElementById('submit-button');
    const contentArea = document.getElementById('content-area');
    const increaseTextSizeButton = document.getElementById('increase-text-size');
    const decreaseTextSizeButton = document.getElementById('decrease-text-size');

    const griptapeApiUrl = 'https://cloud.griptape.ai/api';

    // Toggle visibility of question text input based on dropdown selection
    dropdown.addEventListener('change', () => {
        if (dropdown.value === 'question') { // for the Question button, toggling question text input visibility
            questionTextInput.style.display = 'block';
        } else {
            questionTextInput.style.display = 'none';
        }
        if (dropdown.value === 'quiz-me') { // for the Quiz Me button, toggling reset questions button visibility
            clearMemory.style.display = 'block';
        } else {
            clearMemory.style.display = 'none';
        }
    });

    // Initialize visibility on page load
    if (dropdown.value === 'question') { // for the Question button, toggling question text input visibility
        questionTextInput.style.display = 'block';
    } else {
        questionTextInput.style.display = 'none';
    }
    if (dropdown.value === 'quiz-me') { // for the Quiz Me button, toggling reset questions button visibility
        clearMemory.style.display = 'block';
    } else {
        clearMemory.style.display = 'none';
    }

    // Trigger submit button click on Enter key press in question text input
    questionTextInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent form submission if inside a form
            submitButton.click();
        }
    });

    // Handler for the clicking on the submit button
    submitButton.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value;
        const selectedOption = dropdown.value;
        const structureId = structureIdInput.value;
        const questionText = questionTextInput.value;

        chrome.runtime.sendMessage({ action: 'getPageContent' }, async (response) => {
            if (response && response.content) {
                const processedContent = await processContent(response.content);
                const result = await callAgent(apiKey, structureId, griptapeApiUrl, processedContent, selectedOption, questionText);
                displayContent(result);
            } else {
                displayContent(response.error || 'Failed to fetch content. Try refreshing the tab.');
            }
        });
    });

    // Handler for the clicking on the 'Reset Questions' button
    clearMemory.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value;
        const alias = "griptape_browser_extension_thread"
        const result = await deleteThreadByAlias(alias, apiKey, griptapeApiUrl);
    });

    // handler for the increase (+) text size button
    increaseTextSizeButton.addEventListener('click', () => {
        adjustTextSize(contentArea, 1);
    });

    // handler for the increase (-) text size button
    decreaseTextSizeButton.addEventListener('click', () => {
        adjustTextSize(contentArea, -1);
    });

    // function to adjust the text size in element 
    function adjustTextSize(element, increment) {
        const currentSize = parseFloat(window.getComputedStyle(element, null).getPropertyValue('font-size'));
        element.style.fontSize = (currentSize + increment) + 'px';
    }

    // functions to interact with Griptape API

    // parent function to run a Structure in Griptape Cloud, poll that structure for events, collect response chunks and
    // append these to the contentArea.innerHTML element for display in the UI. Once the final event is received, retreive 
    // the complete output and return it for display it in the contentArea.innerHTML element 

    async function runStructure(prompt, apiKey, structureId, griptapeApiUrl) {
        try {
            // Initialize the Griptape API client and create a structure run
            const runId = await createStructureRun({"args": [prompt]}, apiKey, structureId, griptapeApiUrl);
            // print the run ID for debugging
            console.log('Run created:', runId);
            
            // Poll the event endpoint for the status of the run
            let result;
            let finished = false;
            let offset = 0;
            let waitingForFirstChunk = true;
            do {
                result = await pollEventEndpoint(runId, offset, apiKey, griptapeApiUrl);
                if (waitingForFirstChunk) {contentArea.innerHTML += '.'}; // append . to the initial text in the content area to indicate that we are polling
                offset = result.next_offset;
                result.events.forEach(event => {
                    if (event.type === "TextChunkEvent") { // we got our first TextChunkEvent with content
                        if (waitingForFirstChunk) {contentArea.innerHTML += '\n\n'}; // add two newlines
                        waitingForFirstChunk = false; // no more waiting for the first chunk, so no more . character will be appended
                        contentArea.innerHTML += event.payload.token; // append the payload.token content to the HTML in the content area
                    }
                });
                await new Promise(resolve => setTimeout(resolve, 250)); // Wait before next poll .25 seconds
                if (result.events.length > 0) { 
                    if (result.events[result.events.length - 1].type === 'StructureRunCompleted') { // check whether the event type indicates that we're done
                        finished = true
                    };
                }
            } while (finished === false);
            
            const output = await getStructureRunOutput(runId, apiKey, griptapeApiUrl); // get the complete output
    
            return output.output.value; // return the complete output
    
        } catch (error) {
            console.error('Error:', error.message);
        }
    };

    // create a structure one. return the run ID
    async function createStructureRun(data, apiKey, structureId, griptapeApiUrl) {
        try {
            const url = new URL(`${griptapeApiUrl}/structures/${structureId}/runs`);
            url.search = new URLSearchParams({
                'path': JSON.stringify({ 'structure_id': `${structureId}` })
            });
    
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
    
            if (!response.ok) {
                throw new Error(`Error creating structure run: ${response.statusText}`);
            }
    
            const responseData = await response.json();
            return responseData.structure_run_id;
        } catch (error) {
            console.error('Error creating structure run:', error);
            throw error;
        }
    }
    
    // poll for the status of a Structure run that is in progress
    async function pollEventEndpoint(runId, offset, apiKey, griptapeApiUrl) {
        try {
            const url = new URL(`${griptapeApiUrl}/structure-runs/${runId}/events`);
            url.search = new URLSearchParams({
                'offset': offset,
                'limit': 100
            });
    
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            });
    
            if (!response.ok) {
                throw new Error(`Error polling event endpoint: ${response.statusText}`);
            }
    
            const responseData = await response.json();
            return responseData;
        } catch (error) {
            console.error('Error polling event endpoint:', error);
            throw error;
        }
    }
    
    // get the output from a completed Structure run
    async function getStructureRunOutput(runId, apiKey, griptapeApiUrl) {
        try {
            const url = `${griptapeApiUrl}/structure-runs/${runId}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
    
            if (!response.ok) {
                throw new Error(`Error getting run detail: ${response.statusText}`);
            }
    
            const responseData = await response.json();
            return responseData;
        } catch (error) {
            console.error('Error getting run detail:', error);
            throw error;
        }
    }

    // get a Thread ID from its Alias
    async function getThreadIdByAlias(alias, apiKey, griptapeApiUrl) {
        try {
            const url = new URL(`${griptapeApiUrl}/threads`);
            url.search = new URLSearchParams({
                'alias': alias
            });
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
    
            if (!response.ok) {
                throw new Error(`Error getting conversation memory ID: ${response.statusText}`);
            }
    
            const responseData = await response.json();
            return responseData.threads[0].thread_id;
        } catch (error) {
            console.error('Error getting conversation memory ID:', error);
            throw error;
        }
    }
    
    // delete a Thread by ID
    async function deleteThreadById(threadId, apiKey, griptapeApiUrl) {
        try {
            const url = `${griptapeApiUrl}/threads/${threadId}`;
            const response = await fetch(url, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
    
            if (!response.ok) {
                throw new Error(`Error deleting thread with ID: ${response.statusText}`);
            }
    
            return true;
        } catch (error) {
            console.error('Error deleting thread with ID:', error);
            throw error;
        }
    }
    
    // combine functions to delete a Thead using its Alias
    async function deleteThreadByAlias(alias, apiKey, griptapeApiUrl) {
        try {
            const threadId = await getThreadIdByAlias(alias, apiKey, griptapeApiUrl);
            const result = await deleteThreadById(threadId, apiKey, griptapeApiUrl);
            return result;
        } catch (error) {
            console.error('Error deleting thread with ID:', error);
            throw error;
        }
    }


    function processContent(content) {
        // Implement your content processing logic here. Unused for now
        // maybe results could be improved with pre-processing, if so, do it here
        return content; // Placeholder for actual markdown conversion
    }

    async function callAgent(apiKey, structureIdInput, griptapeApiUrl, pageContent, selectedOption, questionText) {
        // this is where we figure out what we want to do and create a prompt
        contentArea.innerHTML = `Thinking about: ${selectedOption} ...`;
        let prompt = "test";
        switch (selectedOption) {
            case 'write-poem':
                prompt = "Write me a short poem about a heroic Chrome Extension that is well versed in the latest AI technologies";
                break;
            case 'quiz-me':
                prompt = `generate up to three quiz questions related to this content. Do not repeat questions that you have generated previously. Only provide the questions, not the answers: ${pageContent}`;
                break;
            case 'question':
                prompt = `Please give a concise answer this question ${questionText} by referring only to the following content: ${pageContent}`;
                break;
            default:
                throw new Error('Invalid option selected');
        }
        try {
            // send the constructed prompt to a specific Structure running in Griptape Cloud
            const results = await runStructure(prompt, apiKey, structureIdInput, griptapeApiUrl);
            return `${results}`
        } catch (error) {
            contentArea.innerHTML = ('Error running Structure:', error);
            return 'Error fetching converted content';
        } ; 
    }

    // update the HTML in content area
    function displayContent(content) {
        contentArea.innerHTML = content;
    }
});