import React, { Component } from 'react';
import App from "../../../../../common/types/App";
import { translate as t } from '../../../../../common/utils/i18n';
import { LIBRARY } from '../../../../utils/ipc';

interface Props {
    app: App,
    onClick: () => void;
}

interface State {
    btnState?: 'loading' | 'added'
}

class BuyButton extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {} as State;
    }

    render() {
        const isAppFree = this.props.app.cost !== undefined && this.props.app.cost <= 0.00;

        let btnContent: JSX.Element | undefined = undefined;
        if (!this.state.btnState) btnContent = (
        <span id="buyBtnText" className="animated-underline">{t(isAppFree ? 'page.store.add_to_library' : 'page.store.add_to_cart')}</span>
        );
        else if (this.state.btnState === 'loading') btnContent = (
            <div id="buyBtnLoading" className="d-flex align-items-center">
                <div className="spinner-border spinner-border-sm" role="status">
                    <span className="visually-hidden">{t('loading')}...</span>
                </div>
                <div className="ms-2">{t('loading')}</div>
            </div>
        );
        else if (this.state.btnState === 'added') btnContent = (
            <div id="buyBtnChecked" className="d-flex align-items-center">
                <span className="text-success big-emoji">✔</span>
                <div className="ms-2 animated-underline">{t('page.store.show_in_library')}</div>
            </div>
        );

        return <button id="buyBtn" className="buy-btn rounded-pill px-3 py-2 me-5 shadow d-flex align-items-center cursor-pointer">{btnContent}</button>
    }

    componentDidMount() {
        const buyBtn = document.getElementById('buyBtn');

        buyBtn?.addEventListener('mouseenter', () => buyBtn.querySelector('.animated-underline')?.classList.add('active'));
        buyBtn?.addEventListener('mouseleave', () => buyBtn.querySelector('.animated-underline')?.classList.remove('active'));
        buyBtn?.addEventListener('click', () => {
            if (this.state.btnState && this.state.btnState === 'added') {
                this.props.onClick();
                return;
            }

            if (this.props.app.cost && this.props.app.cost > 0) {
                alert('Purchases are not yet implemented.');
                return;
            }

            this.setState({ btnState: 'loading' });

            LIBRARY.addAppToLibrary(this.props.app).then(success => {
                // this.setState({ btnState: success ? 'added' : undefined })
                if (success) this.props.onClick(); // execute action directly
            });
        });

        LIBRARY.isAppInLibrary(this.props.app).then(inLibrary => this.setState({ btnState: inLibrary ? 'added' : undefined }));
    }
}

export default BuyButton;