import { useId, useState, type KeyboardEvent } from "react";

type TagInputProps = {
  id?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
};

function cleanTag(value: string) {
  return value.trim();
}

export function TagInput({ id, value, onChange, disabled }: TagInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [draft, setDraft] = useState("");

  function addTag(raw: string) {
    const tag = cleanTag(raw);
    if (!tag || tag.length > 20 || value.length >= 10) return;
    if (value.some((existing) => existing.toLowerCase() === tag.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...value, tag]);
    setDraft("");
  }

  function removeTag(tag: string) {
    onChange(value.filter((item) => item !== tag));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(draft);
    } else if (event.key === "Backspace" && !draft && value.length) {
      removeTag(value[value.length - 1]!);
    }
  }

  return (
    <div className="tag-input">
      <label className="auth-label" htmlFor={inputId}>
        Tags
      </label>
      <div className="tag-input__box">
        {value.map((tag) => (
          <span className="tag-chip" key={tag}>
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              onClick={() => removeTag(tag)}
              disabled={disabled}
            >
              x
            </button>
          </span>
        ))}
        <input
          id={inputId}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => addTag(draft)}
          placeholder={value.length ? "Add tag" : "Add tag"}
          disabled={disabled || value.length >= 10}
          maxLength={20}
        />
      </div>
    </div>
  );
}
