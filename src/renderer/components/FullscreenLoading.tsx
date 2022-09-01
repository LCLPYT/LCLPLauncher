import React, {Component} from "react";
import LoadingSpinner from "./utility/LoadingSpinner";

export default class FullscreenLoading extends Component {
    render() {
        return (
            <div className="w-100 h-100 d-flex justify-content-center align-items-center">
                <LoadingSpinner growing={true} />
            </div>
        );
    };
}