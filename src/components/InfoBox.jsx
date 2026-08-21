import { Card, CardActionArea, CardContent, Typography } from "@mui/material";
import "./InfoBox.css";

/** Join class names, dropping falsy entries (`false`/`undefined` never reach the DOM). */
const cx = (...names) => names.filter(Boolean).join(" ");

function InfoBox({
  title,
  isRed,
  isGrey,
  active,
  cases,
  total,
  isLoading,
  onSelect,
}) {
  return (
    <Card
      className={cx(
        "infoBox",
        active && "infoBox--selected",
        isRed && "infoBox--red",
        isGrey && "infoBox--grey"
      )}
    >
      <CardActionArea
        onClick={onSelect}
        aria-pressed={active}
        aria-label={`Show ${title.toLowerCase()} on the map and chart`}
      >
        <CardContent>
          <Typography className="infoBox__title" color="textSecondary">
            {title}
          </Typography>

          <h2
            className={cx(
              "infoBox__cases",
              !isRed && "infoBox__cases--green",
              isGrey && "infoBox__cases--grey"
            )}
          >
            {isLoading ? (
              <span className="infoBox__spinner" role="status" aria-label="Loading" />
            ) : (
              cases
            )}
          </h2>

          <Typography className="infoBox__total" color="textSecondary">
            {total} Total
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export default InfoBox;
