import { useLanguage } from "../i18n/LanguageContext.js";
import type { MessageKey } from "../i18n/messages.js";

export interface OptionCardItem {
  value: string;
  labelKey: MessageKey;
  hintKey: MessageKey;
}

export interface OptionCardsProps {
  name: string;
  legendKey: MessageKey;
  options: OptionCardItem[];
  value: string;
  onChange: (value: string) => void;
}

export function OptionCards({ name, legendKey, options, value, onChange }: OptionCardsProps) {
  const { t } = useLanguage();

  return (
    <fieldset className="option-cards">
      <legend>{t(legendKey)}</legend>
      {options.map((option) => (
        <label key={option.value} className="option-card">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          <span>
            <strong>{t(option.labelKey)}</strong>
            <span>{t(option.hintKey)}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
