import { useLanguage } from "../i18n/LanguageContext.js";
import type { MessageKey } from "../i18n/messages.js";

export interface StepDefinition {
  labelKey: MessageKey;
}

export interface StepWizardProps {
  steps: StepDefinition[];
  currentStep: number;
  onStepClick: (index: number) => void;
}

export function StepWizard({ steps, currentStep, onStepClick }: StepWizardProps) {
  const { t } = useLanguage();

  return (
    <ol className="steps" role="list">
      {steps.map((step, index) => (
        <li key={index} aria-current={index === currentStep ? "step" : undefined}>
          <button
            type="button"
            className="step-btn"
            onClick={() => onStepClick(index)}
            aria-pressed={index === currentStep}
          >
            <span className="step-num">{index + 1}</span>
            <span>{t(step.labelKey)}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}
