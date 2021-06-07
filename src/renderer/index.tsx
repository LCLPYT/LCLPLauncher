import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';

export const isDevelopment = process.env.NODE_ENV !== 'production';

if (!isDevelopment) {
    const contentPolicyMeta: HTMLMetaElement = document.createElement('meta');
    contentPolicyMeta.setAttribute('http-equiv', 'Content-Security-Policy');
    contentPolicyMeta.setAttribute('content', "script-src 'self';");
    document.head.appendChild(contentPolicyMeta);
}

ReactDOM.render(<App />, document.getElementById('app'));