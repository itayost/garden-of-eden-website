"use client";

import { Component, type ReactNode } from "react";

interface SurveyErrorBoundaryProps {
  children: ReactNode;
}

interface SurveyErrorBoundaryState {
  failed: boolean;
}

/**
 * Keeps a Survey popup or card that fails to render from taking the Trainee's
 * app down with it: on an error it renders nothing and logs. The Survey is a
 * nicety on top of the dashboard, so the page carries on without it.
 *
 * Only render errors land here; a failing click handler is the component's
 * own to handle. The server reads behind the prompt and the card answer with
 * nothing to offer when they fail (loadTraineeOffers), so they never throw.
 */
export class SurveyErrorBoundary extends Component<
  SurveyErrorBoundaryProps,
  SurveyErrorBoundaryState
> {
  state: SurveyErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): SurveyErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error): void {
    console.error("[surveys] render failed:", error.message);
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
