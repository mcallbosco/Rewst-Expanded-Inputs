# Rewst Multiline Editor & Viewer

A user script to improve editing long text and JSON within `app.rewst.io`.

---

## What It Does

This script adds two main features to the Rewst UI:

1.  **Multiline Editor**: Adds an "Edit" button to certain input fields (like "Default Value"). This opens a large pop-up editor, making it easier to work with long text or code.
2.  **Multiline Viewer**: Adds a "View" button to table cells that contain a lot of text. This opens a pop-up to display the full content in a clean, readable format.

The script also automatically formats JSON content for better readability.

## Installation

You will need a user script manager extension for your browser, such as [Tampermonkey](https://www.tampermonkey.net/).

1.  **Install Tampermonkey** for your browser (Chrome, Firefox, Edge, etc.).
2.  **Install this script**:
    * Go to the `script.user.js` file in this repository.
    * Click the **"Raw"** button.
    * Tampermonkey will open and prompt you to install the script. Click **"Install"**.

The script will now run automatically on `app.rewst.io`.

## How to Use

### Editing Fields

* Find an input field labeled **"Default Value"** or **"Value"**.
* Click the new **"Edit"** button on the right side of the field.
* Make your changes in the pop-up and click **"Save & Close"**.

### Viewing Table Cells

* In a data table, if a cell in the second column has a lot of text, a **"View"** button will appear.
* Click it to see the full content in a pop-up.