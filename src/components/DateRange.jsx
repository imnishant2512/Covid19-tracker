import { FormControl, MenuItem, Select } from "@mui/material";
import { ALL_TIME, CUSTOM, PRESETS, formatWeek } from "../lib/range";
import "./DateRange.css";

/** A custom range starts from the last three months, matching the middle preset. */
const DEFAULT_CUSTOM_WEEKS = 13;

/**
 * Chooses the reporting period the dashboard shows.
 *
 * Custom ranges pick from WHO's actual reporting weeks rather than free dates,
 * so every choice lines up with the data and nothing has to be silently
 * rounded to a week behind the user's back.
 *
 * @param {object} props
 * @param {string[]} props.weeks Reporting weeks, ascending.
 * @param {import("../lib/range").Range|null} props.range The resolved range, or null for all time.
 * @param {(query: import("../lib/range").RangeQuery) => void} props.onChange
 */
function DateRange({ weeks, range, onChange }) {
  const period = range ? (range.preset ?? CUSTOM) : ALL_TIME;
  const disabled = weeks.length === 0;

  const choosePeriod = (/** @type {string} */ value) => {
    if (value === ALL_TIME) onChange({});
    else if (value === CUSTOM) {
      // Start from whatever is in view, so switching to custom refines it
      // rather than jumping somewhere else.
      const last = weeks.length - 1;
      onChange({
        from: range?.from ?? weeks[Math.max(0, last - DEFAULT_CUSTOM_WEEKS + 1)],
        to: range?.to ?? weeks[last],
      });
    } else onChange({ period: value });
  };

  return (
    <div className="dateRange">
      <FormControl size="small" className="dateRange__period">
        <Select
          variant="outlined"
          value={period}
          onChange={(event) => choosePeriod(event.target.value)}
          inputProps={{ "aria-label": "Time period" }}
          disabled={disabled}
        >
          <MenuItem value={ALL_TIME}>All time</MenuItem>
          {PRESETS.map((preset) => (
            <MenuItem key={preset.id} value={preset.id}>
              {preset.label}
            </MenuItem>
          ))}
          <MenuItem value={CUSTOM}>Custom range</MenuItem>
        </Select>
      </FormControl>

      {period === CUSTOM && range && (
        <>
          <FormControl size="small" className="dateRange__week">
            <Select
              variant="outlined"
              value={range.from}
              onChange={(event) => onChange({ from: event.target.value, to: range.to })}
              inputProps={{ "aria-label": "From week" }}
            >
              {weeks
                .filter((week) => week <= range.to)
                .map((week) => (
                  <MenuItem key={week} value={week}>
                    {formatWeek(week)}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
          <span className="dateRange__to" aria-hidden="true">
            to
          </span>
          <FormControl size="small" className="dateRange__week">
            <Select
              variant="outlined"
              value={range.to}
              onChange={(event) => onChange({ from: range.from, to: event.target.value })}
              inputProps={{ "aria-label": "To week" }}
            >
              {weeks
                .filter((week) => week >= range.from)
                .map((week) => (
                  <MenuItem key={week} value={week}>
                    {formatWeek(week)}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
        </>
      )}
    </div>
  );
}

export default DateRange;
