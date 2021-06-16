import React, { Component } from 'react';
import '../../style/pages/home.css';
import featuredBanner from '../../img/ls5_feature.jpg';
import { Carousel } from 'bootstrap';

class Home extends Component {
    render() {
        return (
            <>
                <div className="container-lg mt-3">
                    <div className="card shadow">
                        <div className="card-header text-muted">Featured</div>
                        <div className="card-body p-0">
                            <div id="featuredSlider" className="carousel slide" data-bs-ride="carousel">
                                <div className="carousel-indicators">
                                    <button type="button" data-bs-target="#featuredSlider" data-bs-slide-to="0" className="active" aria-current="true" aria-label="Slide 1"></button>
                                    <button type="button" data-bs-target="#featuredSlider" data-bs-slide-to="1" aria-label="Slide 2"></button>
                                </div>
                                <div className="carousel-inner">
                                    <div className="carousel-item active">
                                        {/* aspect ratio should be 13:4 and min resolution 1300x400 */}
                                        <img src={featuredBanner} className="d-block w-100" alt="Featured banner" />
                                        <div className="carousel-item-desc d-none">
                                            <h4 className="card-title">LCLPServer 5.0</h4>
                                            <p className="card-text">The 5th gen MMO-RPG Minecraft server by LCLPNetwork.</p>
                                        </div>
                                    </div>
                                    <div className="carousel-item">
                                        <img src={featuredBanner} className="d-block w-100" alt="Featured banner" />
                                        <div className="carousel-item-desc d-none">
                                            <h4 className="card-title">LCLPServer 5.0</h4>
                                            <p className="card-text">The 5th gen MMO-RPG Minecraft server by LCLPNetwork.</p>
                                        </div>
                                    </div>
                                </div>
                                <button className="carousel-control-prev" type="button" data-bs-target="#featuredSlider" data-bs-slide="prev">
                                    <span className="carousel-control-prev-icon" aria-hidden="true"></span>
                                    <span className="visually-hidden">Previous</span>
                                </button>
                                <button className="carousel-control-next" type="button" data-bs-target="#featuredSlider" data-bs-slide="next">
                                    <span className="carousel-control-next-icon" aria-hidden="true"></span>
                                    <span className="visually-hidden">Next</span>
                                </button>
                            </div>
                        </div>
                        <div id="featured-description" className="card-footer p-3">
                            <h4 className="card-title">LCLPServer 5.0</h4>
                            <p className="card-text">The 5th gen MMO-RPG Minecraft server by LCLPNetwork.</p>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    componentDidMount() {
        const featuredSlider = document.getElementById('featuredSlider');
        const featuredDescription = document.getElementById('featured-description');

        featuredSlider?.addEventListener('slide.bs.carousel', event => {
            const carouselEvent = (event as unknown) as Carousel.Event;
            const node = carouselEvent.relatedTarget as HTMLElement;

            const children = Array.from(node.children);
            let descSource: HTMLElement | null = null;

            for (const child of children) {
                if ((child as HTMLElement).classList.contains('carousel-item-desc')) {
                    descSource = child as HTMLElement;
                    break;
                }
            }

            if(featuredDescription) {
                const desc = descSource === null ? '' : descSource.innerHTML;

                featuredDescription.style.opacity = '0';

                setTimeout(() => {
                    featuredDescription.innerHTML = desc;
                    featuredDescription.style.opacity = '1';
                }, 300);
            }
        });
    }
}

export default Home;