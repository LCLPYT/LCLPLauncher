import React from "react";
import ReactDOM from "react-dom";
import FullscreenLoading from "./components/FullscreenLoading";
import TitleBar from "./components/Titlebar";

export function renderCustomTitleBar() {
    /* Create custom toolbar */
    const toolbarDiv: HTMLDivElement = document.createElement('div');
    toolbarDiv.id = 'titlebar';
    document.body.insertBefore(toolbarDiv, document.body.firstChild);

    /* Render react components */
    ReactDOM.render(<TitleBar maximizable={true} />, toolbarDiv);
}

export function renderLoadingSpinner() {
    ReactDOM.render(<FullscreenLoading />, document.getElementById('app'));
}