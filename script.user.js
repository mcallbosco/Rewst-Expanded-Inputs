// ==UserScript==
// @name         Rewst Multiline editor.
// @namespace    http://tampermonkey.net/
// @version      2.3
// @description  Adds a multiline editor for long fields and a viewer for table cells that span multiple lines.
// @author       Mcall
// @match        https://app.rewst.io/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // --- Configuration ---
    const TARGET_LABEL_TEXT = "Default Value";
    const TARGET_ARIA_LABEL_TEXT = "Value";
    const TAB_SPACES = 4; // Number of spaces to insert for a tab

    let activeInputElement = null;
    let isEditingJson = false;

    // --- Initialization Check ---
    if (document.getElementById('mle-modal')) {
        console.log('Multiline Editor script already running.');
        return;
    }

    /**
     * Injects the necessary CSS for the modal and buttons into the document head.
     */
    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Style for the popup modal */
            .mle-modal-overlay {
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background-color: rgba(0, 0, 0, 0.7); display: flex;
                justify-content: center; align-items: center; z-index: 99999;
                opacity: 0; visibility: hidden; transition: opacity 0.3s ease, visibility 0.3s ease;
            }
            .mle-modal-overlay.visible { opacity: 1; visibility: visible; }
            .mle-modal-content {
                background-color: #2c2c2c; color: #e0e0e0; padding: 28px;
                border-radius: 12px; width: 70%;
                max-width: 900px;
                box-shadow: 0 5px 20px rgba(0,0,0,0.4); display: flex; flex-direction: column;
                gap: 20px;
                transform: scale(0.95); transition: transform 0.3s ease;
                border: 1px solid #444;
            }
            .mle-modal-overlay.visible .mle-modal-content { transform: scale(1); }
            .mle-modal-title {
                font-size: 24px;
                font-weight: 600; color: #ffffff;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            }
            /* Style for the textarea inside the modal */
            .mle-textarea {
                width: 100%; height: 450px;
                padding: 16px;
                border: 1px solid #555;
                background-color: #1e1e1e; color: #d4d4d4; border-radius: 8px;
                font-family: monospace; font-size: 16px;
                resize: vertical; box-sizing: border-box;
            }
            .mle-textarea[readonly] { background-color: #252526; color: #cccccc; cursor: default; }
            .mle-textarea:focus {
                outline: none; border-color: #007bff;
                box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
            }
            /* Modal buttons container */
            .mle-modal-actions { display: flex; justify-content: flex-end; gap: 12px; }
            .mle-modal-button {
                padding: 12px 24px;
                border: none; border-radius: 8px;
                font-size: 16px; font-weight: 600; cursor: pointer; transition: background-color 0.2s, transform 0.1s;
            }
            .mle-modal-button:active { transform: scale(0.98); }
            .mle-modal-button.primary { background-color: #007bff; color: white; }
            .mle-modal-button.primary:hover { background-color: #0056b3; }
            .mle-modal-button.secondary { background-color: #555; color: #e0e0e0; }
            .mle-modal-button.secondary:hover { background-color: #666; }

            /* Common style for injected "Edit" and "View" buttons */
            .mle-injected-button {
                position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
                padding: 5px 10px;
                border-radius: 6px; cursor: pointer;
                font-size: 13px; font-weight: 500; z-index: 10;
                transition: background-color 0.2s, border-color 0.2s;
            }
            .mle-edit-button {
                background-color: #444; color: #e0e0e0;
                border: 1px solid #666;
            }
            .mle-edit-button:hover { background-color: #555; border-color: #777; }
            .mle-view-button {
                background-color: #3a3a3a; color: #d0d0d0;
                border: 1px solid #555;
            }
            .mle-view-button:hover { background-color: #4a4a4a; border-color: #666; }
        `;
        document.head.appendChild(style);
    }

    /**
     * Creates and appends the modal element to the body.
     * Attaches event listeners for save, cancel, and closing actions.
     */
    function createModal() {
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'mle-modal-overlay';
        modalOverlay.id = 'mle-modal';

        modalOverlay.innerHTML = `
            <div class="mle-modal-content">
                <div class="mle-modal-title">Multiline Editor</div>
                <textarea id="mle-textarea" class="mle-textarea" placeholder="Enter your text here..."></textarea>
                <div class="mle-modal-actions">
                    <button id="mle-cancel-button" class="mle-modal-button secondary">Cancel</button>
                    <button id="mle-save-button" class="mle-modal-button primary">Save & Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(modalOverlay);

        const saveButton = document.getElementById('mle-save-button');
        const cancelButton = document.getElementById('mle-cancel-button');
        const textarea = document.getElementById('mle-textarea');

        // --- UPDATED: Handle special key presses in the textarea ---
        textarea.addEventListener('keydown', function(e) {
            // Handle Ctrl+A (or Cmd+A on Mac) for selecting all text
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
                e.stopPropagation(); // Stop the event from bubbling up to other handlers that might interfere.
                // We do NOT prevent the default action, as we want the browser's "select all" to happen.
                return; // Exit so no other logic here fires
            }

            // Handle Tab key for indentation
            if (e.key === 'Tab') {
                e.preventDefault(); // Prevent default tab behavior (focus change)

                const start = this.selectionStart;
                const end = this.selectionEnd;
                const spaces = ' '.repeat(TAB_SPACES);

                // Insert spaces at the current cursor position
                this.value = this.value.substring(0, start) + spaces + this.value.substring(end);

                // Move cursor to after the inserted spaces
                this.selectionStart = this.selectionEnd = start + spaces.length;
            }
        });

        cancelButton.addEventListener('click', hideModal);
        modalOverlay.addEventListener('click', (e) => e.target === modalOverlay && hideModal());

        saveButton.addEventListener('click', () => {
            if (activeInputElement) {
                let finalValue = textarea.value;
                if (isEditingJson) {
                    const rawText = textarea.value; // Keep user's formatting for now
                    let coreJsonString = rawText.trim(); // Use trimmed version for checks

                    // Attempt to compact and re-serialize valid JSON to ensure correctness
                    try {
                        let jsonToParse = coreJsonString;
                        const isWrapped = coreJsonString.startsWith('{{') && coreJsonString.endsWith('}}');
                        if (isWrapped) {
                            jsonToParse = coreJsonString.substring(2, coreJsonString.length - 2);
                        }
                        const parsedJson = JSON.parse(jsonToParse);
                        const stringifiedJson = JSON.stringify(parsedJson);

                        finalValue = isWrapped ? `{{${stringifiedJson}}}` : stringifiedJson;

                    } catch (e) {
                        console.warn('MLE: Content is not valid JSON. Saving raw text to avoid data loss.');
                        finalValue = rawText; // Save the user's original formatted text if parsing fails
                    }
                }
                // Programmatically set the input value and trigger an event to ensure the web app recognizes the change.
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                nativeInputValueSetter.call(activeInputElement, finalValue);
                activeInputElement.dispatchEvent(new Event('input', { bubbles: true }));
            }
            hideModal();
        });
    }

    /**
     * Displays and configures the modal for either editing or viewing.
     * @param {object} options - The options for the modal.
     * @param {HTMLElement} [options.element=null] - The input element to bind to for saving.
     * @param {string} [options.content=''] - The text content to display.
     * @param {boolean} [options.readOnly=false] - If true, opens the modal in view-only mode.
     */
    function showModal({ element = null, content = '', readOnly = false }) {
        const modal = document.getElementById('mle-modal');
        const textarea = document.getElementById('mle-textarea');
        const saveButton = document.getElementById('mle-save-button');
        const cancelButton = document.getElementById('mle-cancel-button');
        const title = modal.querySelector('.mle-modal-title');

        activeInputElement = element;
        isEditingJson = false;
        const displayContent = content || (element ? element.value : '');

        // Format special {{...}} JSON objects for readability if applicable
        if (displayContent.startsWith('{{') && displayContent.endsWith('}}')) {
            const potentialJson = displayContent.slice(2, -2);
            try {
                const parsedJson = JSON.parse(potentialJson);
                textarea.value = `{{\n${JSON.stringify(parsedJson, null, TAB_SPACES)}\n}}`;
                if (!readOnly) isEditingJson = true;
            } catch (e) {
                textarea.value = displayContent;
            }
        }
        // Format standard JSON objects {} or arrays [] for readability
        else if ((displayContent.trim().startsWith('{') && displayContent.trim().endsWith('}')) ||
                 (displayContent.trim().startsWith('[') && displayContent.trim().endsWith(']'))) {
            try {
                const parsedJson = JSON.parse(displayContent);
                textarea.value = JSON.stringify(parsedJson, null, TAB_SPACES);
                if (!readOnly) isEditingJson = true; // Mark as JSON for saving if it's an editable field
            } catch (e) {
                // Not valid JSON, just show the raw content
                textarea.value = displayContent;
            }
        }
        // Fallback for regular text
        else {
            textarea.value = displayContent;
        }

        // Configure modal for edit vs. view mode
        textarea.readOnly = readOnly;
        if (readOnly) {
            title.textContent = 'View Content';
            saveButton.style.display = 'none';
            cancelButton.textContent = 'Close';
        } else {
            title.textContent = 'Multiline Editor';
            saveButton.style.display = 'block';
            cancelButton.textContent = 'Cancel';
        }

        modal.classList.add('visible');
        textarea.focus();
    }

    /**
     * Hides the modal and resets state variables.
     */
    function hideModal() {
        const modal = document.getElementById('mle-modal');
        modal.classList.remove('visible');
        activeInputElement = null;
        isEditingJson = false;
    }

    // --- Button Injection Logic ---

    /**
     * Adds an "Edit" button to a given input element's wrapper.
     * @param {HTMLInputElement} input - The input element to attach the button to.
     */
    function addEditButtonToInput(input) {
        const wrapper = input.closest('.MuiInputBase-root');
        if (input && wrapper && !wrapper.querySelector('.mle-edit-button')) {
            if (getComputedStyle(wrapper).position === 'static') {
                wrapper.style.position = 'relative';
            }
            const editButton = document.createElement('button');
            editButton.textContent = 'Edit';
            editButton.className = 'mle-injected-button mle-edit-button';
            editButton.type = 'button';
            editButton.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                showModal({ element: input });
            });
            wrapper.appendChild(editButton);
        }
    }

    /**
     * Adds a "View" button to a table cell if its content spans multiple lines.
     * This is determined by comparing the rendered height of the content to its line-height.
     * @param {HTMLTableCellElement} cell - The table cell to process.
     */
    function addViewButtonToCell(cell) {
        // Ensure the cell exists and doesn't already have a button
        if (!cell || cell.querySelector('.mle-view-button')) return;

        const contentDiv = cell.querySelector('div');
        if (!contentDiv) return;

        // Use the 'value' attribute as the primary source of truth for the modal content, fallback to textContent
        const rawValue = cell.getAttribute('value') || contentDiv.textContent;

        // Don't bother with very short content that can't span multiple lines.
        if (rawValue.length < 10) return;

        const style = window.getComputedStyle(contentDiv);
        let lineHeight = parseFloat(style.lineHeight);

        // If lineHeight is "normal" or not a number, calculate a fallback.
        if (isNaN(lineHeight)) {
            lineHeight = parseFloat(style.fontSize) * 1.2; // 1.2 is a common default line-height
        }
        // If we still don't have a valid lineHeight, we can't proceed.
        if (isNaN(lineHeight) || lineHeight === 0) return;

        const divHeight = contentDiv.offsetHeight;
        const lineCount = Math.round(divHeight / lineHeight);

        // Only add the button if the content spans 3 or more visual lines.
        if (lineCount >= 3) {
            if (getComputedStyle(cell).position === 'static') {
                cell.style.position = 'relative';
            }

            const viewButton = document.createElement('button');
            viewButton.textContent = 'View';
            viewButton.className = 'mle-injected-button mle-view-button';
            viewButton.type = 'button';
            viewButton.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                showModal({ content: rawValue, readOnly: true });
            });
            cell.appendChild(viewButton);
        }
    }


    // --- Element Scanning ---

    /**
     * Periodically scans the document for elements that need an "Edit" or "View" button.
     */
    function findAndProcessElements() {
        // Find inputs by label for the "Edit" button
        document.querySelectorAll(`label`).forEach(label => {
            const labelText = (label.querySelector('span')?.textContent || label.textContent).trim();
            if (labelText === TARGET_LABEL_TEXT) {
                const input = label.closest('.MuiFormControl-root')?.querySelector('input[type="text"]');
                if (input) addEditButtonToInput(input);
            }
        });
        // Find inputs by aria-label for the "Edit" button
        document.querySelectorAll(`input[type="text"][aria-label="${TARGET_ARIA_LABEL_TEXT}"]`)
            .forEach(addEditButtonToInput);

        // Find table cells for the "View" button
        document.querySelectorAll('tr.MuiTableRow-root').forEach(row => {
            const cell = row.cells[1]; // Get the second cell in the row
            if (cell) addViewButtonToCell(cell);
        });
    }

    // --- Main Execution ---
    console.log('Starting Multiline Editor script (v2.3)...');
    injectStyles();
    createModal();
    // Use a single interval to scan for all relevant elements
    setInterval(findAndProcessElements, 1000);

})();
