import React, { Component } from 'react';

class PageOne extends Component {
    render() {
        // test new window link
        return (
            <>
                <h2 id="test">Page 1</h2>
                <a href="https://lclpnet.work" target="_blank" rel="noopener noreferrer">LCLPNetwork</a>
                <br/>
                <a href="#test">Anchor</a>
                <br/>
                <a href="test.html">OTHER INTERNAL PAGE</a>
                <br/>
                <button type='button' className='btn btn-primary' onClick={() => window.open('https://lclpnet.work')}>Window</button>
            </>
        );
    }
}

export default PageOne;