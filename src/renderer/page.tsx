import ReactDOM from "react-dom";
import TitleBar from "./components/Titlebar";
import React from "react";

export function renderCustomTitleBar() {
    /* Create custom toolbar */
    const toolbarDiv: HTMLDivElement = document.createElement('div');
    toolbarDiv.id = 'titlebar';
    document.body.insertBefore(toolbarDiv, document.body.firstChild);

    /* Render react components */
    ReactDOM.render(<TitleBar maximizable={true} />, toolbarDiv);
}