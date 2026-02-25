/**
 * Onboarding Tour Feature
 *
 * Guided tooltip-based tour for first-time trainees using driver.js.
 * Auto-starts after profile completion, can be re-triggered from user menu.
 */

// Components
export { OnboardingTourProvider } from "./components/OnboardingTourProvider";
export { TourTriggerButton } from "./components/TourTriggerButton";

// Actions
export { completeTour } from "./lib/actions/complete-tour";
export { resetTour } from "./lib/actions/reset-tour";
export { updateNutritionAppointmentStatus } from "./lib/actions/update-nutrition-status";
