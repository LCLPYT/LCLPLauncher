import React, { Component } from 'react';
import { Carousel } from 'bootstrap';
import tippy, { followCursor } from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/animations/scale.css';
import { getBackendHost } from '../../../../common/utils/settings';
import { translate } from '../../../../main/utils/i18n';

class FeaturedItems extends Component<{ items: FeaturedItem[] }> {
    render() {
        return (
            <div className="card shadow">
                <div className="card-header no-border text-light">{translate('components.featured.title')}</div>
                <div className="card-body p-0">
                    <div id="featuredSlider" className="carousel slide" data-bs-ride="carousel">
                        <div className="carousel-indicators">
                            {
                                this.props.items.map((item, index) => <CarouselSlideButton item={item} index={index} key={item.id} />)
                            }
                        </div>
                        <div className="carousel-inner">
                            {
                                this.props.items.map((item, index) => <CarouselSlide item={item} first={index <= 0} key={item.id} />)
                            }
                        </div>
                        <button className="carousel-control-prev cursor-pointer" type="button" data-bs-target="#featuredSlider" data-bs-slide="prev">
                            <span className="carousel-control-prev-icon" aria-hidden="true" />
                            <span className="visually-hidden">Previous</span>
                        </button>
                        <button className="carousel-control-next cursor-pointer" type="button" data-bs-target="#featuredSlider" data-bs-slide="next">
                            <span className="carousel-control-next-icon" aria-hidden="true" />
                            <span className="visually-hidden">Next</span>
                        </button>
                    </div>
                </div>
                <div id="featured-description" className="card-footer no-border p-3">
                    {/* populated by script */}
                </div>
            </div>
        );
    }

    componentDidMount() {
        const featuredSlider = document.getElementById('featuredSlider');
        const featuredDescription = document.getElementById('featured-description');

        function updateDescription(node: HTMLElement, transition: boolean) {
            const children = Array.from(node.children);
            let descSource: HTMLElement | null = null;

            for (const child of children) {
                if ((child as HTMLElement).classList.contains('carousel-item-desc')) {
                    descSource = child as HTMLElement;
                    break;
                }
            }

            if (featuredDescription) {
                const desc = descSource === null ? '' : descSource.innerHTML;

                if (transition) {
                    featuredDescription.style.opacity = '0';

                    setTimeout(() => {
                        featuredDescription.innerHTML = desc;
                        featuredDescription.style.opacity = '1';
                    }, 300);
                } else {
                    featuredDescription.innerHTML = desc;
                }
            }
        }

        featuredSlider?.addEventListener('slide.bs.carousel', event => {
            const carouselEvent = (event as unknown) as Carousel.Event;
            updateDescription(carouselEvent.relatedTarget as HTMLElement, true);
        });

        const activeSlide = document.querySelector('.carousel-item.active');
        if (activeSlide) updateDescription(activeSlide as HTMLElement, false);

        if (featuredSlider) {
            new Carousel(featuredSlider, {
                interval: 5000
            });
        }
    }
}

class CarouselSlide extends Component<{ first: boolean, item: FeaturedItem }> {
    uniqueId?: string;

    render() {
        const item = this.props.item;
        this.uniqueId = `${item.id}`;
        const img = <img src={item.banner} id={`banner${this.uniqueId}`} className={'d-block w-100 featured-banner' + (item.link ? ' pointer-click' : '')} alt="Featured banner" />;
        return (
            <div className={'carousel-item' + (this.props.first ? ' active' : '')}>
                {
                    item.link ? <a href={item.link}>{img}</a> : img
                }
                <div className="carousel-item-desc d-none">
                    <h4 className="card-title text-lighter">{item.title}</h4>
                    <p className="card-text ws-pre-line text-lighter">{item.description}</p>
                </div>
            </div>
        );
    }

    componentDidMount() {
        if (this.uniqueId) {
            const img = document.getElementById(`banner${this.uniqueId}`);
            if (img && img.parentElement && img.parentElement instanceof HTMLAnchorElement) {
                tippy(img, {
                    content: 'Click to view',
                    followCursor: true,
                    plugins: [followCursor],
                    animation: 'scale',
                    delay: [300, 0]
                });
            }
        }
    }
}

class CarouselSlideButton extends Component<{ item: FeaturedItem, index: number }> {
    render() {
        let first = this.props.index <= 0;
        return <button type="button" data-bs-target="#featuredSlider" data-bs-slide-to={this.props.index} aria-label={this.props.item.title}
            className={first ? "active" : undefined} aria-current={first ? "true" : undefined} />
    }
}

export type FeaturedItem = {
    banner?: string;
    description: string;
    id: number;
    link?: string;
    title: string;
    page: number;
}

export async function fetchFeaturedItems(): Promise<FeaturedItem[]> {
    const response = await fetch(`${getBackendHost()}/api/lclplauncher/featured`);
    const data = await response.json();
    return data as FeaturedItem[];
}

export default FeaturedItems;