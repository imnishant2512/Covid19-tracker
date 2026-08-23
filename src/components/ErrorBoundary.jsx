import { Component } from "react";
import "./ErrorBoundary.css";

/**
 * Keeps a render-time crash in the map or chart from blanking the whole page.
 */
class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Unhandled UI error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="errorBoundary" role="alert">
          {this.props.fallback ?? "Something went wrong displaying this panel."}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
