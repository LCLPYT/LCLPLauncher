import React, { Component } from 'react';
import { Carousel } from 'bootstrap';

class FeaturedItems extends Component<Properties> {
    render() {
        return (
            <div className="card shadow">
                <div className="card-header text-muted">Featured</div>
                <div className="card-body p-0">
                    <div id="featuredSlider" className="carousel slide" data-bs-ride="carousel">
                        <div className="carousel-indicators">
                            {
                                this.props.items.map((item, index) => {
                                    let first = index <= 0;
                                    return <button key={item.id} type="button" data-bs-target="#featuredSlider" data-bs-slide-to={index} aria-label={item.title} className={first ? "active" : undefined} aria-current={first ? "true" : undefined} />
                                })
                            }
                        </div>
                        <div className="carousel-inner">
                            {
                                this.props.items.map((item, index) => {
                                    return (
                                        <div key={item.id} className={'carousel-item' + (index <= 0 ? ' active' : '')}>
                                            {
                                                item.link ? (
                                                    <a href={item.link}>
                                                        <img src={item.banner} className="d-block w-100 pointer-click" alt="Featured banner" />
                                                    </a>
                                                ) : (
                                                    <img src={item.banner} className="d-block w-100" alt="Featured banner" />
                                                )
                                            }
                                            <div className="carousel-item-desc d-none">
                                                <h4 className="card-title">{item.title}</h4>
                                                <p className="card-text ws-pre-line">{item.description}</p>
                                            </div>
                                        </div>
                                    );
                                })
                            }
                        </div>
                        <button className="carousel-control-prev" type="button" data-bs-target="#featuredSlider" data-bs-slide="prev">
                            <span className="carousel-control-prev-icon" aria-hidden="true" />
                            <span className="visually-hidden">Previous</span>
                        </button>
                        <button className="carousel-control-next" type="button" data-bs-target="#featuredSlider" data-bs-slide="next">
                            <span className="carousel-control-next-icon" aria-hidden="true" />
                            <span className="visually-hidden">Next</span>
                        </button>
                    </div>
                </div>
                <div id="featured-description" className="card-footer p-3">
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

export async function fetchFeaturedItems(): Promise<FeaturedItem[]> {
    const response = await fetch('https://lclpnet.work/api/lclplauncher/featured');
    const data = await response.json();
    return data as FeaturedItem[];
}

export type Properties = {
    items: FeaturedItem[];
}

export type FeaturedItem = {
    banner?: string;
    description: string;
    id: number;
    link?: string;
    title: string;
    page: number;
}

export default FeaturedItems;