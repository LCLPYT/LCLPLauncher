import React, { Component } from 'react';

class CollapsableDescription extends Component<{ content: string }> {
    render() {
        return <>
            <p id="descriptionDummy" hidden>{this.props.content}</p>
            <p className="collapse text-lighter" id="description" aria-expanded="false">{this.props.content}</p>
            <div className="text-center">
                <button className="btn btn-sm btn-primary mb-2" id="descToggler" type="button" data-bs-toggle="collapse" data-bs-target="#description" aria-expanded="false" aria-controls="description" hidden>Show more</button>
            </div>
        </>;
    }

    componentDidMount() {
        const desc = document.getElementById('description');
        const descDummy = document.getElementById('descriptionDummy');
        const descToggler = document.getElementById('descToggler');

        function onResize() {
            // Collapse
            if (desc && descDummy && descToggler) {
                descDummy.hidden = false;
                const descHeight = descDummy.getBoundingClientRect().height;
                descDummy.hidden = true;

                descToggler.hidden = descHeight <= 24 * 4;
            }
        }

        onResize();

        desc?.addEventListener('show.bs.collapse', () => {
            if (descToggler) descToggler.innerHTML = 'Show less';
        });

        desc?.addEventListener('hide.bs.collapse', () => {
            if (descToggler) descToggler.innerHTML = 'Show more';
        });

        window.addEventListener('resize', () => onResize());
    }
}

export default CollapsableDescription;