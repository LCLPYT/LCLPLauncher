import React, { Component } from 'react';
import { translate as t } from '../../../common/utils/i18n';

class CollapsableDescription extends Component<{ id: string, content: string }> {
    render() {
        return <>
            <p id={`dummy_${this.props.id}`} hidden>{this.props.content}</p>
            <p className="collapse text-lighter collapseDesc" id={`desc_${this.props.id}`} aria-expanded="false">{this.props.content}</p>
            <div className="text-center">
                <button className="btn btn-sm btn-primary mb-2 collapseDescToggler" id={`toggle_${this.props.id}`} type="button" data-bs-toggle="collapse" 
                    data-bs-target={`#desc_${this.props.id}`} aria-expanded="false" aria-controls={`desc_${this.props.id}`} hidden>
                    {t('component.collapsable.show_more')}
                </button>
            </div>
        </>;
    }

    componentDidMount() {
        const desc = document.getElementById(`desc_${this.props.id}`);
        const descDummy = document.getElementById(`dummy_${this.props.id}`);
        const descToggler = document.getElementById(`toggle_${this.props.id}`);

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
            if (descToggler) descToggler.innerHTML = t('component.collapsable.show_less');
        });

        desc?.addEventListener('hide.bs.collapse', () => {
            if (descToggler) descToggler.innerHTML = t('component.collapsable.show_more');
        });

        window.addEventListener('resize', () => onResize());
    }
}

export default CollapsableDescription;