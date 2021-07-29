import { Carousel } from "bootstrap";
import React, { Component } from "react";
import App from "../../../../../common/types/App";
import YouTube, { Options as YoutubeOptions } from "react-youtube";
import AppPreviewItem from "../../../../../common/types/AppPreviewItem";


interface Props {
    app: App,
    previewData: AppPreviewItem[]
}

class AppPreview extends Component<Props> {
    protected playController: PlayListener = new PlayListener();

    render() {
        return (
            <div className="d-flex rounded bg-dark shadow" id="appPreviewContainer">
                <div className="w-50">
                    <div id="appPreviewCarousel" className="carousel slide" data-bs-ride="false" data-bs-pause="hover">
                        <div className="carousel-indicators preview-controls">
                            {
                                this.props.previewData.map((item, index) => <CarouselSlideButton key={item.id} item={item} index={index} />)
                            }
                        </div>
                        <div className="carousel-inner">
                            {
                                this.props.previewData.map((item, index) => <CarouselSlide key={item.id} item={item} index={index} playManager={this.playController} setPreviewControlsVisible={visible => this.setPreviewControlsVisible(visible)} />)
                            }
                        </div>
                        <button className="carousel-control-prev preview-controls cursor-pointer" type="button" data-bs-target="#appPreviewCarousel" data-bs-slide="prev">
                            <span className="carousel-control-prev-icon preview-controls" aria-hidden="true" />
                            <span className="visually-hidden preview-controls">Previous</span>
                        </button>
                        <button className="carousel-control-next preview-controls cursor-pointer" type="button" data-bs-target="#appPreviewCarousel" data-bs-slide="next">
                            <span className="carousel-control-next-icon preview-controls" aria-hidden="true" />
                            <span className="visually-hidden preview-controls">Next</span>
                        </button>
                    </div>
                </div>
                <div className="w-50"></div>
            </div>
        );
    }

    componentDidMount() {
        const carousel = document.getElementById('appPreviewCarousel');
        if (carousel) {
            new Carousel(carousel, {
                slide: false,
                pause: 'hover'
            });
            carousel.addEventListener('slide.bs.carousel', () => {
                this.playController.setPlaying(false);
            });

            const previews = this.getElementsByQuery('.preview');
            previews.forEach(elem => {
                elem.addEventListener('mouseenter', () => {
                    this.setPreviewControlsVisible(false);
                });
                elem.addEventListener('mouseleave', () => {
                    if(!this.playController.isPlaying()) this.setPreviewControlsVisible(true);
                });
            });
        }
    }

    setPreviewControlsVisible(visible: boolean) {
        this.getElementsByQuery('.preview-controls').forEach(element => element.hidden = !visible);
    }

    getElementsByQuery(selector: string): HTMLElement[] {
        return Array.from(document.querySelectorAll(selector))
            .filter(element => element instanceof HTMLElement)
            .map(element => element as HTMLElement);
    }
}

class CarouselSlideButton extends Component<{ item: AppPreviewItem, index: number }> {
    render() {
        let first = this.props.index <= 0;
        return <button type="button" data-bs-target="#appPreviewCarousel" data-bs-slide-to={this.props.index} aria-label="Preview"
            className={first ? 'preview-controls active' : 'preview-controls'} aria-current={first ? "true" : undefined} />;
    }
}

class PlayListener {
    protected readonly players: any[] = [];

    onPlay(player: any) {
        this.players.push(player);
    }
    
    onPause(player: any) {
        const idx = this.players.indexOf(player);
        if(idx >= 0) this.players.splice(idx, 1);
    }

    setPlaying(shouldPlay: boolean) {
        this.players.forEach(player => {
            if(!player) return;
            if (shouldPlay) player.playVideo();
            else player.pauseVideo();
        });
    }

    isPlaying(): boolean {
        return this.players.filter(player => player && player.getPlayerState && player.getPlayerState() === 1).length > 0;
    }
}

interface SlideProps {
    item: AppPreviewItem,
    index: number,
    playManager: PlayListener,
    setPreviewControlsVisible: (visible: boolean) => void
}

class CarouselSlide extends Component<SlideProps> {
    render() {
        let first = this.props.index <= 0;
        let content: JSX.Element | undefined = undefined;
        if(this.props.item.type === 'youtube') {
            const ytOptions = {
                playerVars: {
                    autoplay: 0,
                    mute: 1
                }
            } as YoutubeOptions;
            content = <YouTube videoId={this.props.item.content} className="preview-youtube" opts={ytOptions} onPlay={event => this.onVideoPlay(event)} onPause={() => this.onVideoPause()} onEnd={() => this.onVideoPause()} />
        }
        return <div className={first ? 'carousel-item preview active' : 'carousel-item preview'}>{content}</div>;
    }

    protected player: any;

    onVideoPlay(event: any) {
        this.player = event.target;
        this.props.playManager.onPlay(this.player);
        const carousel = document.getElementById('appPreviewCarousel');
        if (carousel) {
            const instance = Carousel.getInstance(carousel);
            instance.pause();
            this.props.setPreviewControlsVisible(false);
        }
    }

    onVideoPause() {
        this.props.playManager.onPause(this.player);
        const carousel = document.getElementById('appPreviewCarousel');
        if (carousel) {
            const instance = Carousel.getInstance(carousel);
            instance.cycle();
            this.props.setPreviewControlsVisible(true);
        }
    }
}

export default AppPreview;