import { Card, CardActionArea, CardContent, Typography } from "@mui/material";
import { METRICS } from "../util";
import "./InfoBox.css";

/** Join class names, dropping falsy entries (`false`/`undefined` never reach the DOM). */
const cx = (...names) => names.filter(Boolean).join(" ");

function InfoBox({ title, metric, active, value, context, isLoading, onSelect }) {
  return (
    <Card className={cx("infoBox", active && "infoBox--selected")}>
      <CardActionArea
        onClick={onSelect}
        aria-pressed={active}
        aria-label={`Show ${title.toLowerCase()} on the map and chart`}
      >
        <CardContent>
          <Typography className="infoBox__title" color="textSecondary">
            {title}
          </Typography>

          {/* Deliberately not a heading: this is a bare figure ("1.2m"), and
              exposing it to heading navigation announced a number with no
              context. The card's label lives on the button above. */}
          <p className="infoBox__value" style={{ color: METRICS[metric].hex }}>
            {isLoading ? (
              <span className="infoBox__spinner" role="status" aria-label="Loading" />
            ) : (
              value
            )}
          </p>

          <Typography className="infoBox__context" color="textSecondary">
            {context}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export default InfoBox;
