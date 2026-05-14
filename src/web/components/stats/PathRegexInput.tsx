import type { FormEvent } from "react";

export function PathRegexInput({
  value,
  onChange,
  onApply,
}: {
  value: string;
  onChange: (value: string) => void;
  onApply: () => void;
}) {
  function submit(event: FormEvent) {
    event.preventDefault();
    onApply();
  }

  return (
    <form className="stats-regex" onSubmit={submit}>
      <label className="auth-label" htmlFor="stats-path-regex">
        Path regex
      </label>
      <div className="stats-regex__row">
        <input
          id="stats-path-regex"
          className="auth-input"
          type="text"
          inputMode="text"
          maxLength={180}
          placeholder="^/team-"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button className="btn btn--ghost" type="submit">
          Apply
        </button>
      </div>
    </form>
  );
}
